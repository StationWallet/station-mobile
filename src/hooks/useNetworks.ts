import { useMemo } from 'react'

import useTerraAssets from 'lib/hooks/useTerraAssets'
import { ChainOptions } from 'lib'
import { NetworkEnum } from 'types'

const defaultNetworks: Record<NetworkEnum, ChainOptions> = {
  mainnet: {
    name: NetworkEnum.mainnet,
    chainID: 'phoenix-1',
    lcd: 'https://terra-rest.publicnode.com',
    fcd: 'https://phoenix-fcd.terra.dev',
    walletconnectID: 1
  },
  classic: {
    name: NetworkEnum.classic,
    chainID: 'columbus-5',
    lcd: 'https://terra-classic-lcd.publicnode.com',
    fcd: 'https://terra-classic-lcd.publicnode.com',
    walletconnectID: 2
  },
  testnet: {
    name: NetworkEnum.testnet,
    chainID: 'pisco-1',
    lcd: 'https://terra-testnet-api.polkachu.com',
    fcd: 'https://terra-testnet-api.polkachu.com',
    walletconnectID: 0
  }
}

const useNetworks = (): {
  networks: Record<NetworkEnum, ChainOptions>
} => {
  const { data } = useTerraAssets<Record<NetworkEnum, ChainOptions>>(
    'chains.json'
  )

  const networks: Record<NetworkEnum, ChainOptions> = useMemo(() => {
    const getOptions = (net: NetworkEnum): ChainOptions => {
      return { ...data?.[net], ...defaultNetworks[net] }
    }

    return {
      [NetworkEnum.mainnet]: getOptions(NetworkEnum.mainnet),
      [NetworkEnum.classic]: getOptions(NetworkEnum.classic),
      [NetworkEnum.testnet]: getOptions(NetworkEnum.testnet),
    }
  }, [data])

  return {
    networks,
  }
}

export default useNetworks
