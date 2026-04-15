import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'
import { DevFlags } from '../config/env'

const CryptoTestScreen = DevFlags.CryptoTestScreen
  ? require('../components/CryptoTestScreen').default
  : null

const DevFullE2ETest = DevFlags.FullE2ETest
  ? require('../components/DevFullE2ETest').default
  : null

const DevSeedLegacyData = DevFlags.SeedLegacyData
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = DevFlags.SeedCorruptData
  ? require('../components/DevSeedCorruptData').default
  : null

const DevVerifyVault = DevFlags.VerifyVault
  ? require('../components/DevVerifyVault').default
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
      <Stack.Screen name="NewWallet" component={NewWalletStack} />
      <Stack.Screen
        name="RecoverWallet"
        component={RecoverWalletStack}
      />
      {CryptoTestScreen && (
        <Stack.Screen
          name="CryptoTest"
          component={CryptoTestScreen}
        />
      )}
      {DevFullE2ETest && (
        <Stack.Screen name="FullE2ETest" component={DevFullE2ETest} />
      )}
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
    </Stack.Navigator>
  )
}
