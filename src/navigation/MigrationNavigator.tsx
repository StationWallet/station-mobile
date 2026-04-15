import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import RiveIntro from '../screens/migration/RiveIntro'
import MigrationHome from '../screens/migration/MigrationHome'
import WalletList from '../screens/WalletList'
import VaultSetup from '../screens/migration/VaultSetup'
import VaultName from '../screens/migration/VaultName'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import VerifyEmail from '../screens/migration/VerifyEmail'
import ImportVault from '../screens/migration/ImportVault'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'

export type MigrationMode = 'migrate' | 'create'

import { DevFlags } from '../config/env'

const DevSeedLegacyData = DevFlags.SeedLegacyData
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = DevFlags.SeedCorruptData
  ? require('../components/DevSeedCorruptData').default
  : null

export type MigrationStackParams = {
  RiveIntro: undefined
  MigrationHome: undefined
  VaultSetup: undefined
  WalletsFound: undefined
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
    importedVaultName?: string
  }
  // Dev-only screens for E2E test data seeding
  SeedLegacyData: undefined
  SeedCorruptData: undefined
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="RiveIntro"
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
        cardStyle: { backgroundColor: '#02122b' },
      }}
    >
      <Stack.Screen name="RiveIntro" component={RiveIntro} />
      <Stack.Screen
        name="MigrationHome"
        component={MigrationHome}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen name="WalletsFound" component={WalletList} />
      <Stack.Screen name="VaultSetup" component={VaultSetup} />
      <Stack.Screen name="VaultName" component={VaultName} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen
        name="KeygenProgress"
        component={KeygenProgress}
      />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
      <Stack.Screen
        name="MigrationSuccess"
        component={MigrationSuccess}
      />
      {DevSeedLegacyData && (
        <Stack.Screen
          name="SeedLegacyData"
          component={DevSeedLegacyData}
        />
      )}
      {DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
    </Stack.Navigator>
  )
}
