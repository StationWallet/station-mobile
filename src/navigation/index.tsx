import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import { getWallets } from 'utils/wallet'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'

type WalletCreatedFn = () => void
const WalletCreatedContext = createContext<WalletCreatedFn>(() => {})
export const useWalletCreated = () => useContext(WalletCreatedContext)

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  useEffect(() => {
    getWallets().then((wallets) => {
      setHasWallet(wallets.length > 0)
    })
  }, [])

  const onWalletCreated = useCallback(() => {
    setHasWallet(true)
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
    <WalletCreatedContext.Provider value={onWalletCreated}>
      <NavigationContainer theme={navTheme}>
        {hasWallet ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </WalletCreatedContext.Provider>
  )
}
