import React, { useState, useEffect, ReactElement } from 'react'
import { Platform, BackHandler } from 'react-native'
import {
  LogBox,
  View,
  StatusBar,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { RecoilRoot } from 'recoil'
import { QueryClient, QueryClientProvider } from 'react-query'

import {
  useAuthState,
  AuthProvider,
  useConfigState,
  ConfigProvider,
} from 'lib'

import { UTIL } from 'consts'

import { Settings } from 'types'
import { AppProvider } from './useApp'

import AppNavigator from '../navigation'

import useSecurity from './useSecurity'
import useNetworks from './useNetworks'

import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'

import { settings } from 'utils/storage'
import { migrateLegacyKeystore } from 'utils/legacyMigration'
import { backfillTerraOnlyFlag } from 'services/migrateToVault'

import DebugBanner from './DebugBanner'
import GlobalTopNotification from './GlobalTopNotification'

import { useAlertViewState } from './AlertView'

// TODO: migrate InteractionManager callers to requestIdleCallback and drop
// this ignore. Silenced because the warning toast overlay blocks bottom-
// positioned interactive elements in dev builds.
LogBox.ignoreLogs([
  'EventEmitter.removeListener',
  'InteractionManager has been deprecated',
])

const queryClient = new QueryClient()

const App = ({
  settings: { lang, chain, currency, theme },
}: {
  settings: Settings
}): ReactElement => {
  /* drawer */
  const alertViewProps = useAlertViewState()
  const { networks } = useNetworks()

  const chainOption =
    (chain ? networks[chain.name] : networks.mainnet) ||
    networks.mainnet

  /* provider */
  const config = useConfigState({
    lang,
    chain: chainOption,
    currency,
    theme,
  })
  const { current: currentLang = '' } = config.lang
  const { current: currentChainOptions } = config.chain
  const { name: currentChain = '' } = currentChainOptions

  const { getSecurityErrorMessage, securityCheckFailed } =
    useSecurity()

  useEffect(() => {
    if (securityCheckFailed !== undefined) {
      SplashScreen.hideAsync()
      if (securityCheckFailed) {
        const message = getSecurityErrorMessage()

        UTIL.showSystemAlert(message, 'OK', () =>
          BackHandler.exitApp()
        )
      }
    }
  }, [securityCheckFailed])

  /* auth */
  const auth = useAuthState(undefined)

  /* render */
  const ready = !!(currentLang && currentChain)

  const defaultViewStyle = {
    flex: 1,
  }

  // Track keyboard visibility so the root KeyboardAvoidingView can drop its
  // vertical offset to -100 on Android while the IME is up. Android 15
  // edge-to-edge + windowSoftInputMode=adjustResize + KAV behavior="padding"
  // double-pad the bottom by a small margin that stays even after the IME
  // animates out; the conditional offset cancels the extra chrome while the
  // keyboard is visible, then returns to 0 on hide so the layout doesn't
  // end up with a sticky gap at the bottom of the app.
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true)
    )
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false)
    )
    return (): void => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return (
    <>
      {ready && (
        <AppProvider value={{ alertViewProps }}>
          <ConfigProvider value={config}>
            <AuthProvider value={auth}>
              <SafeAreaProvider
                style={{
                  flex: 1,
                  // Hard-coded dark navy so the system nav-bar safe-area
                  // paints the app's dark bg on Android edge-to-edge. The
                  // theme-based bg defaulted to light (#fafbff) on fresh
                  // installs, which made a white strip visible below every
                  // screen (most noticeable after the keyboard closes).
                  backgroundColor: '#02122b',
                }}
              >
                <StatusBar
                  barStyle="light-content"
                  backgroundColor="#02122b"
                />
                {/* Use behavior="padding" on both platforms. "height" on
                    Android double-handled the IME resize with
                    windowSoftInputMode=adjustResize from the manifest, and
                    when the keyboard closed the KAV's own animated height
                    didn't fully restore — leaving a sticky blank strip for
                    the rest of the app's lifetime. "padding" adds an
                    animated paddingBottom instead of shrinking the view,
                    so there's no layout race with the system and the
                    padding always animates cleanly back to 0 on IME hide. */}
                <KeyboardAvoidingView
                  behavior="padding"
                  keyboardVerticalOffset={
                    Platform.OS === 'android' && keyboardVisible
                      ? -100
                      : 0
                  }
                  style={{
                    ...defaultViewStyle,
                    backgroundColor: '#02122b',
                  }}
                >
                  {securityCheckFailed && Platform.OS === 'ios' ? (
                    <View style={{ flex: 1 }} />
                  ) : (
                    <>
                      <AppNavigator />
                      <GlobalTopNotification />
                      {config.chain.current.name !== 'mainnet' && (
                        <DebugBanner
                          title={config.chain.current.name.toUpperCase()}
                        />
                      )}
                    </>
                  )}
                </KeyboardAvoidingView>
              </SafeAreaProvider>
            </AuthProvider>
          </ConfigProvider>
        </AppProvider>
      )}
    </>
  )
}

const clearKeystoreWhenFirstRun = async (): Promise<void> => {
  if (Platform.OS === 'android') return

  const firstRun = await preferences.getBool(PreferencesEnum.firstRun)
  if (firstRun) return

  // On upgrade from old RN app, firstRun is false because it was in MMKV
  // (now inaccessible). We check the NEW expo-secure-store location for
  // existing data. On a genuine upgrade this will be empty (data is still
  // in the old native keychain and hasn't been migrated yet), so the
  // remove() below is a no-op — it only clears the new location.
  //
  // IMPORTANT: This function does NOT touch the old native keychain
  // (service "_secure_storage_service"). Legacy data is preserved for
  // migrateLegacyKeystore() which runs next.
  const existingData = await keystore.read(KeystoreEnum.AuthData)
  if (existingData) {
    // Data already in new location (post-migration or fresh wallet)
    await preferences.setBool(PreferencesEnum.firstRun, true)
    return
  }

  try {
    // Only removes from new expo-secure-store location (no-op on upgrade)
    await keystore.remove(KeystoreEnum.AuthData)
  } finally {
    await preferences.setBool(PreferencesEnum.firstRun, true)
  }
}

export default (): ReactElement => {
  const [local, setLocal] = useState<Settings>()

  useEffect(() => {
    const startup = async (): Promise<void> => {
      const [, loaded] = await Promise.all([
        clearKeystoreWhenFirstRun()
          .then(() => migrateLegacyKeystore())
          .then(() => backfillTerraOnlyFlag()),
        settings.get(),
      ])
      setLocal(loaded)
    }

    startup()
  }, [])

  return (
    <>
      {local ? (
        <QueryClientProvider client={queryClient}>
          <RecoilRoot>
            <App settings={local} />
          </RecoilRoot>
        </QueryClientProvider>
      ) : null}
    </>
  )
}
