import React, { useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import MigrationNavigator from './MigrationNavigator'
import { MigrationContext } from './MigrationContext'
import { getWallets } from 'utils/wallet'
import { settings } from 'utils/storage'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'
import { COLORS } from 'consts/theme'
import { WalletNavContext } from './hooks'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

export { useWalletCreated, useWalletDisconnected, useWalletNav } from './hooks'

type RootRoute = 'Migration' | 'Auth' | 'Main'

export default function AppNavigator() {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [initialWallet, setInitialWallet] = useState<LocalWallet | undefined>(undefined)
  const [rootRoute, setRootRoute] = useState<RootRoute | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  const loadWallets = useCallback(async () => {
    const loaded = await getWallets()
    setWallets(loaded)
    return loaded
  }, [])

  useEffect(() => {
    const init = async () => {
      const loaded = await loadWallets()
      const vaultsUpgraded = await preferences.getBool(PreferencesEnum.vaultsUpgraded)

      if (loaded.length > 0 && !vaultsUpgraded) {
        setRootRoute('Migration')
      } else if (loaded.length === 0) {
        setRootRoute('Auth')
      } else {
        setRootRoute('Main')
        if (loaded.length === 1) {
          setInitialWallet(loaded[0])
        } else {
          const saved = await settings.get()
          const lastUsed = loaded.find((w) => w.name === saved.walletName)
          if (lastUsed) setInitialWallet(lastUsed)
        }
      }
    }
    init().catch(() => {
      setWallets([])
      setRootRoute('Auth')
    })
  }, [loadWallets])

  const onMigrationComplete = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else if (loaded.length > 1) {
      const saved = await settings.get()
      const lastUsed = loaded.find((w) => w.name === saved.walletName)
      if (lastUsed) setInitialWallet(lastUsed)
    }
    setRootRoute('Main')
  }, [loadWallets])

  const onWalletCreated = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length > 0) {
      setInitialWallet(loaded[loaded.length - 1])
    }
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setInitialWallet(undefined)
      setRootRoute('Auth')
    } else if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else {
      setInitialWallet(undefined)
    }
  }, [loadWallets])

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || COLORS.bg,
    },
  }

  if (rootRoute === null || wallets === null) return null

  return (
    <WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected, wallets }}>
      <MigrationContext.Provider value={{ onMigrationComplete }}>
        <NavigationContainer theme={navTheme}>
          {rootRoute === 'Migration' ? (
            <MigrationNavigator />
          ) : rootRoute === 'Main' ? (
            <MainNavigator initialWallet={initialWallet} />
          ) : (
            <AuthNavigator />
          )}
        </NavigationContainer>
      </MigrationContext.Provider>
    </WalletNavContext.Provider>
  )
}
