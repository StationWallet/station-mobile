import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletList from '../screens/WalletList'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'
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

const DevSeedCorruptData = DevFlags.SeedCorruptData
  ? require('../components/DevSeedCorruptData').default
  : null

const DevVerifyVault = DevFlags.VerifyVault
  ? require('../components/DevVerifyVault').default
  : null

export type MainStackParams = {
  WalletList: undefined
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
  SeedLegacyData: undefined
  SeedCorruptData: undefined
  VerifyVault: undefined
  Migration: {
    screen:
      | 'MigrationHome'
      | 'VaultSetup'
      | 'VaultEmail'
      | 'MigrationSuccess'
    params?: {
      walletName?: string
      walletIndex?: number
      totalWallets?: number
      wallets?: MigrationWallet[]
      results?: MigrationResult[]
      mode?: MigrationMode
      migratedWalletName?: string
      importedVaultName?: string
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
      <Stack.Screen name="AddWalletMenu" component={AuthMenu} />
      <Stack.Screen name="AddNewWallet" component={NewWalletStack} />
      <Stack.Screen
        name="AddRecoverWallet"
        component={RecoverWalletStack}
      />
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
      {DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
      {DevVerifyVault && (
        <Stack.Screen name="VerifyVault" component={DevVerifyVault} />
      )}
      <Stack.Screen name="Migration" component={MigrationNavigator} />
    </Stack.Navigator>
  )
}
