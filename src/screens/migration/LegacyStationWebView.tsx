import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { WebView } from 'react-native-webview'
import type {
  WebView as WebViewType,
  WebViewMessageEvent,
} from 'react-native-webview'
import Svg, { Path } from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import { MIGRATION } from 'consts/migration'
import { LEGACY_STATION_URL } from 'utils/openLegacyStation'
import {
  parseSpaWalletsJson,
  type SpaLegacyWalletEntry,
} from 'services/spaLegacyDecrypt'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// Bridge contract that the legacy Station SPA expects when running inside a
// React Native WebView. Ported from the deleted src/App/WebViewContainer.tsx
// (commit fb62b3a^). Minimal subset — enough to satisfy the SPA's startup
// handshake so it renders past its Suspense boundary.
const RN_APIS = {
  APP_VERSION: 'APP_VERSION',
  MIGRATE_KEYSTORE: 'MIGRATE_KEYSTORE',
  SET_NETWORK: 'SET_NETWORK',
  SET_THEME: 'SET_THEME',
  CHECK_BIO: 'CHECK_BIO',
  AUTH_BIO: 'AUTH_BIO',
  RECOVER_SESSIONS: 'RECOVER_SESSIONS',
  DISCONNECT_SESSIONS: 'DISCONNECT_SESSIONS',
  READY_CONNECT_WALLET: 'READY_CONNECT_WALLET',
  CONNECT_WALLET: 'CONNECT_WALLET',
  REJECT_SESSION: 'REJECT_SESSION',
} as const

// Injected at content-load time. Three responsibilities:
// 1. Preserve wallet data, clear stale chain config so the SPA refetches.
// 2. Rewrite the chains.json body and outgoing /node_info URLs so the SPA
//    uses LIVE LCDs (the assets.terra.money defaults point at a dead origin
//    and a deprecated Cosmos SDK path).
// 3. Notify React Native of SPA route changes so the host can react.
const INJECTED_JS = `
(function() {
  try {
    var preserve = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      // Wallet data lives under non-chain keys (the SPA uses 'keys', 'user',
      // 'Theme', etc.). Chain config is namespaced under chain/network keys.
      if (k && (k.toLowerCase().indexOf('chain') !== -1 || k.toLowerCase().indexOf('network') !== -1)) {
        // skip (will be cleared)
      } else if (k) {
        preserve[k] = localStorage.getItem(k);
      }
    }
    localStorage.clear();
    Object.keys(preserve).forEach(function(k){ localStorage.setItem(k, preserve[k]); });
  } catch (e) {}

  function postNav() {
    try { window.ReactNativeWebView.postMessage('navigationStateChange'); } catch (e) {}
  }
  function wrap(fn) {
    return function wrapper() {
      var res = fn.apply(this, arguments);
      postNav();
      return res;
    }
  }
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', postNav);

  function rewriteChainsBody(text) {
    try {
      return text
        .split('https://lcd-terra.tfl.foundation').join('https://terra-lcd.publicnode.com')
        .split('https://phoenix-lcd.terra.dev').join('https://terra-lcd.publicnode.com')
        .split('https://phoenix-fcd.terra.dev').join('https://terra-classic-fcd.publicnode.com')
        .split('https://phoenix-api.terra.dev').join('https://terra-classic-public-api.publicnode.com');
    } catch (e) { return text; }
  }
  function isChainsUrl(url) {
    return typeof url === 'string' && url.indexOf('chains.json') !== -1;
  }
  // Translate legacy /node_info path → Cosmos SDK 0.46+ path on the live LCD.
  function rewriteOutgoingUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.indexOf('terra-lcd.publicnode.com/node_info') !== -1 ||
        url.indexOf('terra-classic-lcd.publicnode.com/node_info') !== -1) {
      return url.replace('/node_info', '/cosmos/base/tendermint/v1beta1/node_info');
    }
    return url;
  }

  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var rewrittenUrl = rewriteOutgoingUrl(url);
    if (rewrittenUrl !== url) arguments[0] = rewrittenUrl;
    return origFetch.apply(this, arguments).then(function(res) {
      if (isChainsUrl(url) && res.ok) {
        return res.text().then(function(t) {
          return new Response(rewriteChainsBody(t), { status: res.status, headers: res.headers });
        });
      }
      return res;
    });
  };

  var OrigXHR = window.XMLHttpRequest;
  function WrappedXHR() {
    var xhr = new OrigXHR();
    var info = {};
    var origOpen = xhr.open;
    xhr.open = function(method, url) {
      var rewritten = rewriteOutgoingUrl(url);
      if (rewritten !== url) arguments[1] = rewritten;
      info.url = arguments[1];
      return origOpen.apply(xhr, arguments);
    };
    xhr.addEventListener('load', function() {
      if (isChainsUrl(info.url) && xhr.status >= 200 && xhr.status < 300) {
        try {
          var rewritten = rewriteChainsBody(xhr.responseText);
          if (xhr.responseText !== rewritten) {
            Object.defineProperty(xhr, 'responseText', { value: rewritten, configurable: true });
            Object.defineProperty(xhr, 'response', { value: rewritten, configurable: true });
          }
        } catch (e) {}
      }
    });
    return xhr;
  }
  WrappedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = WrappedXHR;
})();
true;
`

function BackChevron(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export default function LegacyStationWebView(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation =
    useNavigation<
      StackNavigationProp<
        MigrationStackParams,
        'LegacyStationWebView'
      >
    >()
  const webRef = useRef<WebViewType>(null)
  const [loading, setLoading] = useState(true)
  const [spaWallets, setSpaWallets] = useState<
    SpaLegacyWalletEntry[]
  >([])

  // Poll the SPA's localStorage for wallets while the user is on this screen.
  // The injection no-ops if window has no localStorage yet (page not ready).
  useEffect(() => {
    const id = setInterval(() => {
      webRef.current?.injectJavaScript(`
        (function() {
          try {
            var raw = localStorage.getItem('keys');
            if (raw) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({ __spaWallets: true, keys: raw })
              );
            }
          } catch (e) {}
        })();
        true;
      `)
    }, 1500)
    return (): void => clearInterval(id)
  }, [])

  const replyToWebView = useCallback(
    (reqId: unknown, type: string, data: unknown): void => {
      const payload = JSON.stringify({ reqId, type, data })
      const js = `
        (function() {
          var ev = new MessageEvent('message', {
            data: ${JSON.stringify(payload)},
            origin: window.location.origin,
          });
          window.dispatchEvent(ev);
          document.dispatchEvent(ev);
        })();
        true;
      `
      webRef.current?.injectJavaScript(js)
    },
    []
  )

  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      const raw = event.nativeEvent.data
      if (raw === 'navigationStateChange') return

      let parsed: {
        type?: string
        reqId?: unknown
        data?: unknown
        __spaWallets?: boolean
        keys?: string
      }
      try {
        parsed = JSON.parse(raw)
      } catch {
        return
      }

      if (parsed.__spaWallets && typeof parsed.keys === 'string') {
        const found = parseSpaWalletsJson(parsed.keys)
        setSpaWallets((prev) => {
          if (
            prev.length === found.length &&
            prev.every(
              (w, i) =>
                w.name === found[i].name &&
                w.address === found[i].address &&
                w.encrypted === found[i].encrypted
            )
          ) {
            return prev
          }
          return found
        })
        return
      }

      const { type, reqId } = parsed
      switch (type) {
        case RN_APIS.APP_VERSION:
          replyToWebView(reqId, type, 'v5.1.0')
          break
        case RN_APIS.CHECK_BIO:
        case RN_APIS.AUTH_BIO:
          replyToWebView(reqId, type, false)
          break
        case RN_APIS.SET_THEME:
        case RN_APIS.SET_NETWORK:
        case RN_APIS.RECOVER_SESSIONS:
        case RN_APIS.DISCONNECT_SESSIONS:
          replyToWebView(reqId, type, true)
          break
        case RN_APIS.MIGRATE_KEYSTORE:
          // The SPA itself manages legacy-keystore migration via its own UI;
          // we expose the wallets it surfaces in localStorage to native
          // (parseSpaWalletsJson above), so we answer empty here.
          replyToWebView(reqId, type, [])
          break
      }
    },
    [replyToWebView]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          testID="legacy-station-back"
        >
          <BackChevron />
        </Pressable>
        <Text fontType="brockmann-medium" style={styles.title}>
          Legacy Station
        </Text>
        <View style={styles.headerRight} />
      </View>

      <WebView
        ref={webRef}
        source={{
          uri: LEGACY_STATION_URL,
          headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        }}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        applicationNameForUserAgent="StationMobile/5.1.0"
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        originWhitelist={['*']}
        injectedJavaScript={INJECTED_JS}
        onMessage={handleMessage}
        testID="legacy-station-webview"
      />

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator
            size="large"
            color={MIGRATION.textPrimary}
          />
        </View>
      )}

      {spaWallets.length > 0 && (
        <View
          style={[
            styles.migrateBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Text fontType="brockmann" style={styles.migrateBarLabel}>
            {spaWallets.length === 1
              ? `Found “${spaWallets[0].name}” — migrate into a Fast Vault`
              : `Found ${spaWallets.length} legacy wallets to migrate`}
          </Text>
          <Button
            title={
              spaWallets.length === 1
                ? 'Migrate this wallet'
                : `Migrate ${spaWallets[0].name}`
            }
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={() => {
              const w = spaWallets[0]
              navigation.navigate('LegacyMigrate', {
                walletName: w.name,
                address: w.address,
                encrypted: w.encrypted,
              })
            }}
            containerStyle={styles.migrateBarButton}
            testID="legacy-spa-migrate-cta"
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02122b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: MIGRATION.textPrimary,
    fontSize: 16,
  },
  headerRight: {
    width: 24,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 18, 43, 0.5)',
  },
  migrateBar: {
    backgroundColor: MIGRATION.surface1,
    borderTopWidth: 1,
    borderTopColor: MIGRATION.borderLight,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  migrateBarLabel: {
    color: MIGRATION.textTertiary,
    fontSize: 12,
    marginBottom: 8,
  },
  migrateBarButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
