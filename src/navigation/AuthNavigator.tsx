import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'

const CryptoTestScreen = __DEV__
  ? require('../components/CryptoTestScreen').default
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
    </Stack.Navigator>
  )
}
