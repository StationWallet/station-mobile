import React from 'react'
import { View } from 'react-native'
import { WebViewContainer } from '../App/WebViewContainer'
import { User } from 'lib'

export default function StationWallet({
  user,
  setIsVisibleModal,
}: {
  user?: User[]
  setIsVisibleModal: (v: any) => void
}) {
  return (
    <View style={{ flex: 1 }}>
      <WebViewContainer user={user} setIsVisibleModal={setIsVisibleModal} />
    </View>
  )
}
