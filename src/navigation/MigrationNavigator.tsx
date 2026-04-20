import React, { Suspense } from 'react'
import { View } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'

import RiveIntro from '../screens/migration/RiveIntro'
import MigrationHome from '../screens/migration/MigrationHome'
import WalletList from '../screens/WalletList'
import VaultSetup from '../screens/migration/VaultSetup'
import VaultName from '../screens/migration/VaultName'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import VerifyEmail from '../screens/migration/VerifyEmail'
import BackupVault from '../screens/migration/BackupScreen'
import ImportVault from '../screens/migration/ImportVault'
import MigrationSuccess from '../screens/migration/MigrationSuccess'
import RecoverSeed from '../screens/migration/RecoverSeed'

// Lazy-load KeygenProgress — it statically imports rive-react-native which
// initialises its native runtime on import, keeping the iOS main run loop busy
// and blocking Detox idle detection.
const LazyKeygenProgress = React.lazy(
  () => import('../screens/migration/KeygenProgress')
)
const KeygenProgress = (
  props: Record<string, unknown>
): React.ReactElement => (
  <Suspense
    fallback={
      <View style={{ flex: 1, backgroundColor: '#02122b' }} />
    }
  >
    <LazyKeygenProgress {...props} />
  </Suspense>
)

import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'
import type { KeyImportResult } from 'services/dklsKeyImport'

export type MigrationMode = 'migrate' | 'create' | 'recover-seed'

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
  VaultName: { mode?: MigrationMode } | undefined
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
    keyImportResult: KeyImportResult
  }
  BackupVault: {
    walletName: string
    walletIndex?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    mode: MigrationMode
  }
  ImportVault: undefined
  MigrationSuccess: {
    results?: MigrationResult[]
    wallets?: MigrationWallet[]
    migratedWalletName?: string
    importedVaultName?: string
  }
  RecoverSeed: undefined
  // Dev-only screens for E2E test data seeding
  SeedLegacyData: undefined
  SeedCorruptData: undefined
}

const Stack = createStackNavigator<MigrationStackParams>()

type MigrationEntry =
  | 'default'
  | 'create-vault'
  | 'recover-seed-input'
  | 'import-vault'

export default function MigrationNavigator({
  initialEntry = 'default',
}: {
  initialEntry?: MigrationEntry
}): React.ReactElement {
  const initialRouteName =
    initialEntry === 'create-vault'
      ? 'VaultName'
      : initialEntry === 'import-vault'
      ? 'ImportVault'
      : initialEntry === 'recover-seed-input'
      ? 'RecoverSeed'
      : 'RiveIntro'
  const vaultNameInitialParams =
    initialEntry === 'create-vault'
      ? { mode: 'create' as const }
      : undefined

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
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
      <Stack.Screen
        name="VaultName"
        component={VaultName}
        initialParams={vaultNameInitialParams}
      />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen
        name="KeygenProgress"
        component={KeygenProgress}
      />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="BackupVault" component={BackupVault} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
      <Stack.Screen
        name="MigrationSuccess"
        component={MigrationSuccess}
      />
      <Stack.Screen name="RecoverSeed" component={RecoverSeed} />
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
