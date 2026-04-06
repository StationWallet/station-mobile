import React from 'react'
import WalletSuccessScreen from '../WalletSuccessScreen'

const WalletRecovered = ({ navigation, route }: any) => {
  const { wallet } = route.params
  return (
    <WalletSuccessScreen
      title="Wallet Recovered!"
      wallet={wallet}
      navigation={navigation}
    />
  )
}

export default WalletRecovered
