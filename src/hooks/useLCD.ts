import { LCDClient } from '@terra-money/terra.js'
import { useMemo } from 'react'
import { useConfig, useIsClassic } from '../lib/contexts/ConfigContext'

const useLCD = (): LCDClient => {
  const { chain } = useConfig()
  const isClassic = useIsClassic()
  const { chainID, lcd: URL } = chain.current

  const lcd = useMemo(
    () =>
      new LCDClient({
        chainID,
        URL,
        isClassic,
      }),
    [chainID, URL, isClassic]
  )
  return lcd
}

export default useLCD
