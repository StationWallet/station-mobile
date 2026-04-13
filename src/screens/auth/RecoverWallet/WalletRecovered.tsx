import React from 'react'
import WalletSuccessScreen from '../WalletSuccessScreen'

const WalletRecovered = ({
  navigation,
  route,
}: {
  navigation: {
    goBack: () => void
    getParent: () =>
      | {
          navigate: (screen: string) => void
          getState: () => { routes?: Array<{ name: string }> }
        }
      | undefined
  }
  route: { params: { wallet: LocalWallet } }
}): React.ReactElement => {
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
