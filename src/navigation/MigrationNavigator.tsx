import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import WalletsFound from '../screens/migration/WalletsFound'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import VerifyEmail from '../screens/migration/VerifyEmail'
import MigrationSuccess from '../screens/migration/MigrationSuccess'
import ImportVault from '../screens/migration/ImportVault'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationStackParams = {
  WalletsFound: { wallets: MigrationWallet[] }
  VaultEmail: {
    walletName: string
    mode: 'migrate' | 'create'
    walletIndex?: number
    totalWallets?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    email?: string
  }
  VaultPassword: {
    walletName: string
    mode: 'migrate' | 'create'
    walletIndex?: number
    totalWallets?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    email: string
  }
  KeygenProgress: {
    walletName: string
    mode: 'migrate' | 'create'
    walletIndex?: number
    totalWallets?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    email: string
    password: string
  }
  VerifyEmail: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email: string
    publicKey: string
  }
  MigrationSuccess: { results: MigrationResult[] }
  ImportVault: undefined
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
      <Stack.Screen name="WalletsFound" component={WalletsFound} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen name="KeygenProgress" component={KeygenProgress} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
    </Stack.Navigator>
  )
}
