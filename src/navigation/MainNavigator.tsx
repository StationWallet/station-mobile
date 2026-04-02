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

export type MainStackParams = {
  WalletPicker: undefined
  WalletHome: { wallet: { name: string; address: string } }
  Receive: { address: string }
  History: { address: string }
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
}

const Stack = createStackNavigator<MainStackParams>()

interface Props {
  initialWallet?: LocalWallet
}

export default function MainNavigator({ initialWallet }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {initialWallet ? (
        <>
          <Stack.Screen
            name="WalletHome"
            component={WalletHome}
            initialParams={{ wallet: { name: initialWallet.name, address: initialWallet.address } }}
          />
          <Stack.Screen name="WalletPicker" component={WalletPicker} />
        </>
      ) : (
        <>
          <Stack.Screen name="WalletPicker" component={WalletPicker} />
          <Stack.Screen name="WalletHome" component={WalletHome} />
        </>
      )}
      <Stack.Screen name="Receive" component={Receive} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="AddWalletMenu" component={AuthMenu} />
      <Stack.Screen name="AddNewWallet" component={NewWalletStack} />
      <Stack.Screen name="AddRecoverWallet" component={RecoverWalletStack} />
      <Stack.Screen name="ExportPrivateKey" component={ExportPrivateKey} />
    </Stack.Navigator>
  )
}
