import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletList from '../screens/WalletList'
import ExportPrivateKey from '../screens/ExportPrivateKey'
import MigrationNavigator from './MigrationNavigator'
import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'
import type { MigrationMode } from './MigrationNavigator'
import { DevFlags } from '../config/env'

const DevSeedLegacyData = DevFlags.SeedLegacyData
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedLegacyDataAndroidV1 = DevFlags.SeedLegacyDataAndroidV1
  ? require('../components/DevSeedLegacyDataAndroidV1').default
  : null

const DevSeedCorruptData = DevFlags.SeedCorruptData
  ? require('../components/DevSeedCorruptData').default
  : null

const DevVerifyVault = DevFlags.VerifyVault
  ? require('../components/DevVerifyVault').default
  : null

const DevStateReset = DevFlags.StateReset
  ? require('../components/DevStateReset').default
  : null

export type MainStackParams = {
  WalletList: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
  SeedLegacyData: undefined
  SeedLegacyDataAndroidV1: undefined
  SeedCorruptData: undefined
  VerifyVault: undefined
  StateReset: undefined
  Migration: {
    screen:
      | 'MigrationHome'
      | 'VaultSetup'
      | 'VaultEmail'
      | 'MigrationSuccess'
      | 'LegacyMigrate'
    params?: {
      walletName?: string
      walletIndex?: number
      totalWallets?: number
      wallets?: MigrationWallet[]
      results?: MigrationResult[]
      mode?: MigrationMode
      migratedWalletName?: string
      importedVaultName?: string
      address?: string
      encrypted?: string
    }
  }
}

const Stack = createStackNavigator<MainStackParams>()

export default function MainNavigator(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#02122b' },
      }}
    >
      <Stack.Screen name="WalletList" component={WalletList} />
      <Stack.Screen
        name="ExportPrivateKey"
        component={ExportPrivateKey}
      />
      {DevSeedLegacyData && (
        <Stack.Screen
          name="SeedLegacyData"
          component={DevSeedLegacyData}
        />
      )}
      {DevSeedLegacyDataAndroidV1 && (
        <Stack.Screen
          name="SeedLegacyDataAndroidV1"
          component={DevSeedLegacyDataAndroidV1}
        />
      )}
      {DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
      {DevVerifyVault && (
        <Stack.Screen name="VerifyVault" component={DevVerifyVault} />
      )}
      {DevStateReset && (
        <Stack.Screen name="StateReset" component={DevStateReset} />
      )}
      <Stack.Screen name="Migration" component={MigrationNavigator} />
    </Stack.Navigator>
  )
}
