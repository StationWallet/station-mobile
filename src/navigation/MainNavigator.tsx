import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletPicker from '../screens/WalletPicker'
import WalletHome from '../screens/WalletHome'
import Receive from '../screens/Receive'
import History from '../screens/History'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'
import ExportPrivateKey from '../screens/ExportPrivateKey'
import MigrationNavigator from './MigrationNavigator'
import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'

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

const DevSeedPreMigrated = __DEV__
  ? require('../components/DevSeedPreMigrated').default
  : null

const DevVerifyVault = __DEV__
  ? require('../components/DevVerifyVault').default
  : null

export type MainStackParams = {
  WalletPicker: undefined
  WalletHome: { wallet: { name: string; address: string } }
  Receive: { address: string }
  History: { address: string }
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
  CryptoTest: undefined
  FullE2ETest: undefined
  SeedLegacyData: undefined
  SeedCorruptData: undefined
  SeedPreMigrated: undefined
  VerifyVault: undefined
  Migration: {
    screen: 'VaultEmail'
    params: {
      walletName: string
      walletIndex: number
      totalWallets: number
      wallets: MigrationWallet[]
      results: MigrationResult[]
    }
  }
}

const Stack = createStackNavigator<MainStackParams>()

interface Props {
  initialWallet?: LocalWallet
}

export default function MainNavigator({
  initialWallet,
}: Props): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {initialWallet ? (
        <>
          <Stack.Screen
            name="WalletHome"
            component={WalletHome}
            initialParams={{
              wallet: {
                name: initialWallet.name,
                address: initialWallet.address,
              },
            }}
          />
          <Stack.Screen
            name="WalletPicker"
            component={WalletPicker}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="WalletPicker"
            component={WalletPicker}
          />
          <Stack.Screen name="WalletHome" component={WalletHome} />
        </>
      )}
      <Stack.Screen name="Receive" component={Receive} />
      <Stack.Screen name="History" component={History} />
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
      {__DEV__ && DevSeedPreMigrated && (
        <Stack.Screen
          name="SeedPreMigrated"
          component={DevSeedPreMigrated}
        />
      )}
      {__DEV__ && DevVerifyVault && (
        <Stack.Screen name="VerifyVault" component={DevVerifyVault} />
      )}
      <Stack.Screen name="Migration" component={MigrationNavigator} />
    </Stack.Navigator>
  )
}
