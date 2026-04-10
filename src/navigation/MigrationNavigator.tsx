import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import RiveIntro from '../screens/migration/RiveIntro'
import MigrationHome from '../screens/migration/MigrationHome'
import WalletsFound from '../screens/migration/WalletsFound'
import VaultName from '../screens/migration/VaultName'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import VerifyEmail from '../screens/migration/VerifyEmail'
import ImportVault from '../screens/migration/ImportVault'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationMode = 'migrate' | 'create'

const DevSeedLegacyData = __DEV__
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = __DEV__
  ? require('../components/DevSeedCorruptData').default
  : null

const DevSeedPreMigrated = __DEV__
  ? require('../components/DevSeedPreMigrated').default
  : null

export type MigrationStackParams = {
  RiveIntro: undefined
  MigrationHome: undefined
  WalletsFound: {
    wallets: MigrationWallet[]
    results?: MigrationResult[]
  }
  VaultName: undefined
  VaultEmail: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: MigrationMode
    email?: string
  }
  VaultPassword: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: MigrationMode
    email: string
  }
  KeygenProgress: {
    walletName: string
    walletIndex?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    mode: MigrationMode
    email: string
    password: string
  }
  VerifyEmail: {
    walletName: string
    walletIndex?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    mode: MigrationMode
    email: string
    publicKey: string
  }
  ImportVault: undefined
  MigrationSuccess: {
    results?: MigrationResult[]
    wallets?: MigrationWallet[]
    migratedWalletName?: string
  }
  // Dev-only screens for E2E test data seeding
  SeedLegacyData: undefined
  SeedCorruptData: undefined
  SeedPreMigrated: undefined
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="RiveIntro"
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="RiveIntro" component={RiveIntro} />
      <Stack.Screen
        name="MigrationHome"
        component={MigrationHome}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen name="WalletsFound" component={WalletsFound} />
      <Stack.Screen name="VaultName" component={VaultName} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen name="KeygenProgress" component={KeygenProgress} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
      {__DEV__ && DevSeedLegacyData && (
        <Stack.Screen name="SeedLegacyData" component={DevSeedLegacyData} />
      )}
      {__DEV__ && DevSeedCorruptData && (
        <Stack.Screen name="SeedCorruptData" component={DevSeedCorruptData} />
      )}
      {__DEV__ && DevSeedPreMigrated && (
        <Stack.Screen name="SeedPreMigrated" component={DevSeedPreMigrated} />
      )}
    </Stack.Navigator>
  )
}
