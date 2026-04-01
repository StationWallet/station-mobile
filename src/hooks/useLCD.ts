import { LCDClient } from '@terra-money/terra.js'
import { useMemo } from 'react'
import { useConfig, useIsClassic } from '../lib/contexts/ConfigContext'
import useGasPrices from './useGasPrices'

const useLCD = (): LCDClient => {
  const { chain } = useConfig()
  const { gasPrices } = useGasPrices()
  const isClassic = useIsClassic()
  const { chainID, lcd: URL } = chain.current

  const lcd = useMemo(
    () =>
      new LCDClient({
        chainID,
        URL,
        gasPrices,
        isClassic,
      }),
    [chainID, URL, gasPrices, isClassic]
  )
  return lcd
}

export default useLCD
