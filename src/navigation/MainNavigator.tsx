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

const CryptoTestScreen = __DEV__
  ? require('../components/CryptoTestScreen').default
  : null

const DevFullE2ETest = __DEV__
  ? require('../components/DevFullE2ETest').default
  : null

const DevSeedLegacyData = __DEV__
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = __DEV__
  ? require('../components/DevSeedCorruptData').default
  : null

const DevVerifyVault = __DEV__
  ? require('../components/DevVerifyVault').default
  : null

export type MainStackParams = {
  WalletList: undefined
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
  CryptoTest: undefined
  FullE2ETest: undefined
  SeedLegacyData: undefined
  SeedCorruptData: undefined
  VerifyVault: undefined
  Migration: {
    screen: 'VaultEmail' | 'MigrationSuccess'
    params: {
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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      {__DEV__ && CryptoTestScreen && (
        <Stack.Screen
          name="CryptoTest"
          component={CryptoTestScreen}
        />
      )}
      {__DEV__ && DevFullE2ETest && (
        <Stack.Screen name="FullE2ETest" component={DevFullE2ETest} />
      )}
      {__DEV__ && DevSeedLegacyData && (
        <Stack.Screen
          name="SeedLegacyData"
          component={DevSeedLegacyData}
        />
      )}
      {__DEV__ && DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
      {__DEV__ && DevVerifyVault && (
        <Stack.Screen name="VerifyVault" component={DevVerifyVault} />
      )}
      <Stack.Screen name="Migration" component={MigrationNavigator} />
    </Stack.Navigator>
  )
}
