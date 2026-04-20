import React, { useState, useEffect, ReactElement } from 'react'
import { Platform, BackHandler } from 'react-native'
import {
  LogBox,
  View,
  StatusBar,
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
                {/* On Android, rely on windowSoftInputMode=adjustResize from
                    the manifest — KeyboardAvoidingView here double-handled
                    the IME resize with the system and left a sticky blank
                    strip at the bottom after the keyboard closed once. iOS
                    still needs KAV (no adjustResize equivalent); its
                    behavior="padding" doesn't have the stickiness. */}
                {Platform.OS === 'ios' ? (
                  <KeyboardAvoidingView
                    behavior="padding"
                    style={{
                      ...defaultViewStyle,
                      backgroundColor: '#02122b',
                    }}
                  >
                    {securityCheckFailed ? (
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
                ) : (
                  <View
                    style={{
                      ...defaultViewStyle,
                      backgroundColor: '#02122b',
                    }}
                  >
                    <AppNavigator />
                    <GlobalTopNotification />
                    {config.chain.current.name !== 'mainnet' && (
                      <DebugBanner
                        title={config.chain.current.name.toUpperCase()}
                      />
                    )}
                  </View>
                )}
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
