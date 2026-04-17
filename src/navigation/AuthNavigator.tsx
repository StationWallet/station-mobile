import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import AuthMenu from '../screens/auth/AuthMenu'
import RecoverWalletStack from './RecoverWalletStack'
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

const DevStateReset = DevFlags.StateReset
  ? require('../components/DevStateReset').default
  : null

const Stack = createStackNavigator()

export default function AuthNavigator(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#02122B' },
      }}
    >
      <Stack.Screen name="AuthMenu" component={AuthMenu} />
      <Stack.Screen
        name="RecoverWallet"
        component={RecoverWalletStack}
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
      {DevStateReset && (
        <Stack.Screen name="StateReset" component={DevStateReset} />
      )}
    </Stack.Navigator>
  )
}
