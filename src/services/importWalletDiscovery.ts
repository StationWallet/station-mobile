import { MnemonicKey } from '@terra-money/terra.js'

import type { SeedImportChain } from './seedPhraseImport'

type DiscoveryChainConfig = {
  chain: SeedImportChain
  ticker: string
  lcdUrl: string
  coinType: number
  denom: string
}

export type ImportWalletDiscoveryResult = {
  chain: SeedImportChain
  address: string
  ticker: string
  hasBalance: boolean
}

const DISCOVERY_TIMEOUT_MS = 8000

export const DEFAULT_IMPORT_CHAINS: SeedImportChain[] = ['Terra']

export const STATION_DISCOVERY_CHAINS: DiscoveryChainConfig[] = [
  {
    chain: 'Terra',
    ticker: 'LUNA',
    lcdUrl: 'https://terra-rest.publicnode.com',
    coinType: 330,
    denom: 'uluna',
  },
  {
    chain: 'TerraClassic',
    ticker: 'LUNC',
    lcdUrl: 'https://terra-classic-lcd.publicnode.com',
    coinType: 330,
    denom: 'uluna',
  },
]

async function fetchWithTimeout(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    DISCOVERY_TIMEOUT_MS
  )

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function deriveTerraAddress(
  mnemonic: string,
  config: DiscoveryChainConfig
): string {
  const key = new MnemonicKey({
    mnemonic: mnemonic.trim().toLowerCase(),
    coinType: config.coinType,
  })

  return key.accAddress
}

async function hasNativeBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${config.lcdUrl}/cosmos/bank/v1beta1/balances/${address}`
    )
    const json = await res.json()
    const coin = (json.balances ?? []).find(
      (balance: { denom?: string }) => balance.denom === config.denom
    )
    const amount = String(coin?.amount ?? '0')

    return /^[1-9]\d*$/.test(amount)
  } catch {
    return false
  }
}

export async function discoverImportWalletChains(
  mnemonic: string,
  onProgress?: (progress: number) => void
): Promise<ImportWalletDiscoveryResult[]> {
  const results: ImportWalletDiscoveryResult[] = []

  for (
    let index = 0;
    index < STATION_DISCOVERY_CHAINS.length;
    index++
  ) {
    const config = STATION_DISCOVERY_CHAINS[index]
    const address = deriveTerraAddress(mnemonic, config)
    const hasBalance = await hasNativeBalance(config, address)

    if (hasBalance) {
      results.push({
        chain: config.chain,
        address,
        ticker: config.ticker,
        hasBalance,
      })
    }

    onProgress?.((index + 1) / STATION_DISCOVERY_CHAINS.length)
  }

  return results
}
