import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'

const CryptoTestScreen = __DEV__
  ? require('../components/CryptoTestScreen').default
  : null

const DevFullE2ETest = __DEV__
  ? require('../components/DevFullE2ETest').default
  : null

const Stack = createStackNavigator()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthMenu" component={AuthMenu} />
      <Stack.Screen name="NewWallet" component={NewWalletStack} />
      <Stack.Screen name="RecoverWallet" component={RecoverWalletStack} />
      {__DEV__ && CryptoTestScreen && (
        <Stack.Screen name="CryptoTest" component={CryptoTestScreen} />
      )}
      {__DEV__ && DevFullE2ETest && (
        <Stack.Screen name="FullE2ETest" component={DevFullE2ETest} />
      )}
    </Stack.Navigator>
  )
}
