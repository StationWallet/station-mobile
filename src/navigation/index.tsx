import React, { useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import { getWallets } from 'utils/wallet'
import { settings } from 'utils/storage'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'
import { WalletNavContext } from './hooks'

export { useWalletCreated, useWalletDisconnected, useWalletNav } from './hooks'

export default function AppNavigator() {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [initialWallet, setInitialWallet] = useState<LocalWallet | undefined>(undefined)
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
      if (loaded.length === 1) {
        setInitialWallet(loaded[0])
      } else if (loaded.length > 1) {
        const saved = await settings.get()
        const lastUsed = loaded.find((w) => w.name === saved.walletName)
        if (lastUsed) {
          setInitialWallet(lastUsed)
        }
        // else: no initialWallet → MainNavigator will show WalletPicker
      }
    }
    init().catch(() => setWallets([]))
  }, [loadWallets])

  const onWalletCreated = useCallback(async () => {
    const loaded = await loadWallets()
    // Auto-select the newest wallet (last in the list)
    if (loaded.length > 0) {
      setInitialWallet(loaded[loaded.length - 1])
    }
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setInitialWallet(undefined)
    } else if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else {
      setInitialWallet(undefined) // will show picker
    }
  }, [loadWallets])

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || '#02122B',
    },
  }

  if (wallets === null) return null // Still loading

  const hasWallet = wallets.length > 0

  return (
    <WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected, wallets }}>
      <NavigationContainer theme={navTheme}>
        {hasWallet ? (
          <MainNavigator initialWallet={initialWallet} />
        ) : (
          <AuthNavigator />
        )}
      </NavigationContainer>
    </WalletNavContext.Provider>
  )
}
