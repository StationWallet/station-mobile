import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import WalletDiscovery from '../screens/migration/WalletDiscovery'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationStackParams = {
  WalletDiscovery: undefined
  VaultEmail: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email?: string
  }
  VaultPassword: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email: string
  }
  KeygenProgress: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email: string
    password: string
  }
  MigrationSuccess: { results: MigrationResult[] }
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="WalletDiscovery" component={WalletDiscovery} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen name="KeygenProgress" component={KeygenProgress} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
    </Stack.Navigator>
  )
}
