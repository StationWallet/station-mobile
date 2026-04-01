import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletHome from '../screens/WalletHome'
import Receive from '../screens/Receive'
import History from '../screens/History'

export type MainStackParams = {
  WalletHome: undefined
  Receive: { address: string }
  History: { address: string }
}

const Stack = createStackNavigator<MainStackParams>()

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletHome" component={WalletHome} />
      <Stack.Screen name="Receive" component={Receive} />
      <Stack.Screen name="History" component={History} />
    </Stack.Navigator>
  )
}
