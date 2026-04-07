import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import WalletDiscovery from '../screens/migration/WalletDiscovery'
import MigrationProgress from '../screens/migration/MigrationProgress'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationStackParams = {
  WalletDiscovery: undefined
  MigrationProgress: { wallets: MigrationWallet[] }
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
      <Stack.Screen name="MigrationProgress" component={MigrationProgress} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
    </Stack.Navigator>
  )
}
