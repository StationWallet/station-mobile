import BigNumber from 'bignumber.js'

export const has = (value?: BigNumber.Value): boolean =>
  !!value && new BigNumber(value).gte(1)

export const toPrice = (n: BigNumber.Value): number =>
  new BigNumber(n).dp(18, BigNumber.ROUND_DOWN).toNumber()
