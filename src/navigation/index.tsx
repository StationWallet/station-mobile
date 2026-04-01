import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import { getWallets } from 'utils/wallet'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'

interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
}
const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: () => {},
  onWalletDisconnected: () => {},
})
export const useWalletCreated = () => useContext(WalletNavContext).onWalletCreated
export const useWalletDisconnected = () => useContext(WalletNavContext).onWalletDisconnected

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  useEffect(() => {
    getWallets()
      .then((wallets) => {
        setHasWallet(wallets.length > 0)
      })
      .catch(() => {
        setHasWallet(false)
      })
  }, [])

  const onWalletCreated = useCallback(() => {
    setHasWallet(true)
  }, [])

  const onWalletDisconnected = useCallback(() => {
    setHasWallet(false)
  }, [])

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || '#02122B',
    },
  }

  if (hasWallet === null) return null // Still loading

  return (
    <WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected }}>
      <NavigationContainer theme={navTheme}>
        {hasWallet ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </WalletNavContext.Provider>
  )
}
