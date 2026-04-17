import React, { ReactElement } from 'react'
import { createStackNavigator } from '@react-navigation/stack'

export type RecoverWalletStackParams = {
  Step1: undefined
  Step2Seed: undefined
}

const RecoverWalletStack =
  createStackNavigator<RecoverWalletStackParams>()

import Step1 from '../screens/auth/RecoverWallet/Step1'
import Step2Seed from '../screens/auth/RecoverWallet/Step2Seed'

const RecoverWalletStackScreen = (): ReactElement => (
  <RecoverWalletStack.Navigator
    initialRouteName="Step1"
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: '#02122B' },
    }}
  >
    <RecoverWalletStack.Screen
      name="Step1"
      component={Step1}
      options={Step1.navigationOptions}
    />
    <RecoverWalletStack.Screen
      name="Step2Seed"
      component={Step2Seed}
      options={Step2Seed.navigationOptions}
    />
  </RecoverWalletStack.Navigator>
)

export default RecoverWalletStackScreen
