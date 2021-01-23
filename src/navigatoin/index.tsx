import React, { ReactElement } from 'react'
import {
  NavigationContainer,
  DefaultTheme,
  LinkingOptions,
} from '@react-navigation/native'

import { RootStack } from '../types'

import Tabs from './Tabs'
import AuthMenu from '../screens/auth/AuthMenu'
import SelectWallet from '../screens/auth/SelectWallet'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'

import OnBoarding from '../screens/OnBoarding'
import Setting from '../screens/Setting'
import ConnectView from '../screens/topup/ConnectView'
import SendTxView from '../screens/topup/SendTxView'
import Send from '../screens/Send'

import Complete from '../screens/Complete'
import VestingSchedule from '../screens/VestingSchedule'
import Confirm from '../screens/Confirm'
import Delegate from '../screens/Delegate'

const TerraTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F9FAFF',
  },
}

const AppNavigator = ({
  skipOnboarding,
}: {
  skipOnboarding?: boolean
}): ReactElement => {
  /* linking */
  const linking: LinkingOptions = {
    prefixes: ['terrastation://'],
    config: {
      screens: {
        ConnectView: {
          path: 'connect/:arg',
        },
        SendTxView: {
          path: 'sign/:arg',
        },
      },
    },
  }

  return (
    <NavigationContainer theme={TerraTheme} linking={linking}>
      <RootStack.Navigator
        initialRouteName={skipOnboarding ? 'Tabs' : 'OnBoarding'}
      >
        <RootStack.Screen
          name="OnBoarding"
          component={OnBoarding}
          options={{
            headerShown: false,
            animationEnabled: false,
          }}
        />
        <RootStack.Screen
          name="Tabs"
          component={Tabs}
          options={{
            headerShown: false,
            animationEnabled: false,
          }}
        />
        <RootStack.Screen
          name="Setting"
          component={Setting}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="AuthMenu"
          component={AuthMenu}
          options={AuthMenu.navigationOptions}
        />
        <RootStack.Screen
          name="SelectWallet"
          component={SelectWallet}
          options={SelectWallet.navigationOptions}
        />
        <RootStack.Screen
          name="NewWallet"
          component={NewWalletStack}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="RecoverWallet"
          component={RecoverWalletStack}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="ConnectView"
          component={ConnectView}
          options={{ animationEnabled: false }}
        />
        <RootStack.Screen
          name="SendTxView"
          component={SendTxView}
          options={{ animationEnabled: false }}
        />
        <RootStack.Screen
          name="Send"
          component={Send}
          options={Send.navigationOptions}
        />
        <RootStack.Screen
          name="Complete"
          component={Complete}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="VestingSchedule"
          component={VestingSchedule}
          options={VestingSchedule.navigationOptions}
        />
        <RootStack.Screen
          name="Confirm"
          component={Confirm}
          options={Confirm.navigationOptions}
        />
        <RootStack.Screen
          name="Delegate"
          component={Delegate}
          options={Delegate.navigationOptions}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator
