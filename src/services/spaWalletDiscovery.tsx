import React, { useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import type {
  WebView as WebViewType,
  WebViewMessageEvent,
} from 'react-native-webview'
import * as SecureStore from 'expo-secure-store'

import { LEGACY_STATION_URL } from 'utils/openLegacyStation'
import {
  parseSpaWalletsJson,
  type SpaLegacyWalletEntry,
} from './spaLegacyDecrypt'

/**
 * Discovery of legacy Terra Station SPA wallets that live in the WebView's
 * localStorage (origin: mobile.station.terra.money).
 *
 * The native app cannot read WebView storage directly — WKWebView keeps it in
 * a sandboxed WebsiteDataStore keyed by origin. The only way to surface this
 * data into native is to mount a WebView at the same origin and read it via
 * injected JS. The data persists across launches and across upgrades for any
 * user who installed in-place on the same bundle ID.
 *
 * This component renders an off-screen 1px WebView that:
 *   1. Loads the legacy SPA origin.
 *   2. Reads `localStorage['keys']` once `domcontentloaded` fires.
 *   3. Parses out `{ name, address, encrypted }[]` entries.
 *   4. Caches them to `expo-secure-store` so subsequent app launches read the
 *      cached list immediately and only refresh in the background.
 *
 * Mount this once near the top of the migration UI (e.g. `MigrationHome`).
 * It is invisible and fire-and-forget.
 */

const CACHE_KEY = 'spa-legacy-wallets'
const CACHE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

// Injected JS that reads `localStorage['keys']` and posts it back. Kept tiny
// — we don't need the chain-config rewrites that the visible LegacyStation
// WebView does, because we're not rendering the SPA's UI.
//
// Belt-and-braces firing:
//   1. fire immediately if the document is already complete
//   2. otherwise on `load`
//   3. and again after 1.5s in case the page never fires `load` (slow CF or
//      partial-network failure) — duplicate sends are idempotent (latest
//      cache write wins).
const DISCOVERY_JS = `
(function() {
  var sent = false;
  function send() {
    if (sent) return;
    sent = true;
    try {
      var raw = localStorage.getItem('keys');
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ __spaDiscovery: true, keys: raw || '' })
      );
    } catch (e) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ __spaDiscovery: true, error: String(e) })
      );
    }
  }
  if (document.readyState === 'complete') send();
  else window.addEventListener('load', send);
  setTimeout(function() {
    if (!sent) send();
  }, 1500);
})();
true;
`

export async function getCachedSpaWallets(): Promise<
  SpaLegacyWalletEntry[]
> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY, CACHE_OPTS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function setCachedSpaWallets(
  wallets: SpaLegacyWalletEntry[]
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      CACHE_KEY,
      JSON.stringify(wallets),
      CACHE_OPTS
    )
  } catch {
    // Cache write failure is non-fatal — the next mount will retry.
  }
}

export async function clearCachedSpaWallets(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY, CACHE_OPTS)
  } catch {
    // Ignore.
  }
}

interface Props {
  onDiscovered?: (wallets: SpaLegacyWalletEntry[]) => void
}

export default function SpaWalletDiscovery({
  onDiscovered,
}: Props): React.ReactElement {
  const ref = useRef<WebViewType>(null)

  // Cleanup safety: prevent stale callbacks after unmount.
  const mounted = useRef(true)
  useEffect(() => {
    return (): void => {
      mounted.current = false
    }
  }, [])

  const handleMessage = async (
    event: WebViewMessageEvent
  ): Promise<void> => {
    let parsed: { __spaDiscovery?: boolean; keys?: string }
    try {
      parsed = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (!parsed.__spaDiscovery) return
    const wallets = parsed.keys
      ? parseSpaWalletsJson(parsed.keys)
      : []
    await setCachedSpaWallets(wallets)
    if (mounted.current && onDiscovered) onDiscovered(wallets)
  }

  // Belt-and-braces against the SPA blocking on first paint: also re-inject
  // the discovery snippet from RN's onLoadEnd hook (independent of the
  // page's own `load` event). Duplicate sends are harmless — latest cache
  // write wins.
  const handleLoadEnd = (): void => {
    ref.current?.injectJavaScript(DISCOVERY_JS)
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ uri: LEGACY_STATION_URL }}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        applicationNameForUserAgent="StationMobile/5.1.0"
        injectedJavaScript={DISCOVERY_JS}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        // Trim the network surface — we only need localStorage, not the SPA.
        cacheEnabled
        domStorageEnabled
        javaScriptEnabled
        originWhitelist={['*']}
        sharedCookiesEnabled
        // Suppress the SPA from running long if it manages to start; we'll
        // tear it down as soon as we have the keys we need.
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        testID="spa-discovery-webview"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -9999,
    left: -9999,
  },
})
