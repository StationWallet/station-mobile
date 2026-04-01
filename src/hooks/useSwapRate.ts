import { Coin } from '@terra-money/terra.js'
import { UTIL } from 'consts'
import { uToken } from 'types'
import { useIsClassic } from 'lib'
import useLCD from './useLCD'

export const useSwapRate = (): {
  getSwapAmount: (
    offerCoin: Coin,
    askDenom: string
  ) => Promise<uToken>
} => {
  const lcd = useLCD()
  const isClassic = useIsClassic()

  const getSwapAmount = async (
    offerCoin: Coin,
    askDenom: string
  ): Promise<uToken> => {
    if (
      !isClassic ||
      offerCoin.denom === askDenom ||
      UTIL.isIbcDenom(offerCoin.denom)
    ) {
      return '' as uToken
    }

    const result = await lcd.market.swapRate(offerCoin, askDenom)
    return result.amount.toString() as uToken
  }

  return { getSwapAmount }
}
