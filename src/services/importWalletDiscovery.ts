import { bech32 } from 'bech32'

import {
  deriveChainPublicKeyForImport,
  type SeedImportChain,
} from './seedPhraseImport'

type DiscoveryChainKind =
  | 'evm'
  | 'cosmos'
  | 'solana'
  | 'sui'
  | 'ton'
  | 'tron'

type DiscoveryChainConfig = {
  chain: SeedImportChain
  ticker: string
  kind: DiscoveryChainKind
  coinTypeName?: string
  derivation?: number
  rpcUrl?: string
  denom?: string
  bech32Prefix?: string
}

export type ImportWalletDiscoveryResult = {
  chain: SeedImportChain
  address: string
  ticker: string
}

const DISCOVERY_TIMEOUT_MS = 8000
const DISCOVERY_BATCH_SIZE = 5
const SOLANA_SOLANA_DERIVATION = 6

export const DEFAULT_IMPORT_CHAINS: SeedImportChain[] = ['Terra']

export const STATION_DISCOVERY_CHAINS: DiscoveryChainConfig[] = [
  {
    chain: 'Ethereum',
    ticker: 'ETH',
    kind: 'evm',
    coinTypeName: 'ethereum',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
  },
  {
    chain: 'Solana',
    ticker: 'SOL',
    kind: 'solana',
    coinTypeName: 'solana',
    derivation: SOLANA_SOLANA_DERIVATION,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
  },
  {
    chain: 'Sui',
    ticker: 'SUI',
    kind: 'sui',
    coinTypeName: 'sui',
    rpcUrl: 'https://sui-rpc.publicnode.com',
  },
  {
    chain: 'THORChain',
    ticker: 'RUNE',
    kind: 'cosmos',
    denom: 'rune',
    bech32Prefix: 'thor',
    rpcUrl: 'https://thornode.thorchain.network',
  },
  {
    chain: 'MayaChain',
    ticker: 'CACAO',
    kind: 'cosmos',
    denom: 'cacao',
    bech32Prefix: 'maya',
    rpcUrl: 'https://mayanode.mayachain.info',
  },
  {
    chain: 'Cosmos',
    ticker: 'ATOM',
    kind: 'cosmos',
    denom: 'uatom',
    bech32Prefix: 'cosmos',
    rpcUrl: 'https://cosmos-rest.publicnode.com',
  },
  {
    chain: 'Kujira',
    ticker: 'KUJI',
    kind: 'cosmos',
    denom: 'ukuji',
    bech32Prefix: 'kujira',
    rpcUrl: 'https://kujira-rest.publicnode.com',
  },
  {
    chain: 'Dydx',
    ticker: 'DYDX',
    kind: 'cosmos',
    denom: 'adydx',
    bech32Prefix: 'dydx',
    rpcUrl: 'https://dydx-rest.publicnode.com',
  },
  {
    chain: 'Osmosis',
    ticker: 'OSMO',
    kind: 'cosmos',
    denom: 'uosmo',
    bech32Prefix: 'osmo',
    rpcUrl: 'https://osmosis-rest.publicnode.com',
  },
  {
    chain: 'Terra',
    ticker: 'LUNA',
    kind: 'cosmos',
    denom: 'uluna',
    bech32Prefix: 'terra',
    rpcUrl: 'https://terra-lcd.publicnode.com',
  },
  {
    chain: 'TerraClassic',
    ticker: 'LUNC',
    kind: 'cosmos',
    denom: 'uluna',
    bech32Prefix: 'terra',
    rpcUrl: 'https://terra-classic-lcd.publicnode.com',
  },
  {
    chain: 'Noble',
    ticker: 'USDC',
    kind: 'cosmos',
    denom: 'uusdc',
    bech32Prefix: 'noble',
    rpcUrl: 'https://noble-api.polkachu.com',
  },
  {
    chain: 'Akash',
    ticker: 'AKT',
    kind: 'cosmos',
    denom: 'uakt',
    bech32Prefix: 'akash',
    rpcUrl: 'https://akash-rest.publicnode.com',
  },
  {
    chain: 'Ton',
    ticker: 'TON',
    kind: 'ton',
    coinTypeName: 'ton',
  },
  {
    chain: 'Tron',
    ticker: 'TRX',
    kind: 'tron',
    coinTypeName: 'tron',
    rpcUrl: 'https://api.trongrid.io/wallet/getaccount',
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

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function deriveWalletCoreAddress(
  mnemonic: string,
  config: DiscoveryChainConfig
): Promise<string> {
  const { NativeWalletCore } = require('@vultisig/walletcore-native')
  const walletCore = NativeWalletCore.getInstance()
  const coinType = walletCore.CoinType[config.coinTypeName!]
  if (coinType === undefined) {
    throw new Error(`CoinType not found for chain: ${config.chain}`)
  }

  const wallet = walletCore.HDWallet.createWithMnemonic(
    mnemonic.trim().toLowerCase(),
    ''
  )
  try {
    return config.derivation === undefined
      ? wallet.getAddressForCoin(coinType)
      : wallet.getAddressDerivation(coinType, config.derivation)
  } finally {
    wallet.delete?.()
  }
}

async function deriveCosmosAddress(
  mnemonic: string,
  config: DiscoveryChainConfig
): Promise<string> {
  const { sha256 } = require('@noble/hashes/sha2.js')
  const { ripemd160 } = require('@noble/hashes/legacy.js')
  const publicKey = hexToBytes(
    await deriveChainPublicKeyForImport(mnemonic, config.chain)
  )
  const addressHash = ripemd160(sha256(publicKey))

  return bech32.encode(
    config.bech32Prefix!,
    bech32.toWords(addressHash)
  )
}

async function deriveDiscoveryAddress(
  mnemonic: string,
  config: DiscoveryChainConfig
): Promise<string> {
  return config.kind === 'cosmos'
    ? deriveCosmosAddress(mnemonic, config)
    : deriveWalletCoreAddress(mnemonic, config)
}

async function fetchJson(
  input: string,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetchWithTimeout(input, init)
  return res.json()
}

function hasPositiveAmount(value: unknown): boolean {
  if (typeof value === 'number') return value > 0
  if (typeof value !== 'string') return false
  return /^[1-9]\d*$/.test(value)
}

async function hasEvmBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  const json = await fetchJson(config.rpcUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  })

  const result = (json as { result?: unknown }).result

  return parseInt(String(result ?? '0x0'), 16) > 0
}

async function hasSolanaBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  const json = await fetchJson(config.rpcUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  })

  return hasPositiveAmount(
    (json as { result?: { value?: unknown } }).result?.value
  )
}

async function hasSuiBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  const json = await fetchJson(config.rpcUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getBalance',
      params: [address],
    }),
  })

  return hasPositiveAmount(
    (json as { result?: { totalBalance?: unknown } }).result
      ?.totalBalance
  )
}

async function hasCosmosBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  const json = await fetchJson(
    `${config.rpcUrl}/cosmos/bank/v1beta1/balances/${address}`
  )
  const balances =
    (json as { balances?: { denom?: string; amount?: unknown }[] })
      .balances ?? []
  const coin = balances.find(
    (balance: { denom?: string }) => balance.denom === config.denom
  )

  return hasPositiveAmount(coin?.amount)
}

async function hasTonBalance(address: string): Promise<boolean> {
  const { env } = require('../config/env')
  const json = await fetchJson(
    `${env.vultisigApiUrl}/ton/v3/wallet?address=${address}`
  )
  const response = json as {
    balance?: unknown
    wallet?: { balance?: unknown }
    result?: { balance?: unknown }
  }

  return hasPositiveAmount(
    response.balance ??
      response.wallet?.balance ??
      response.result?.balance
  )
}

async function hasTronBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  const json = await fetchJson(config.rpcUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, visible: true }),
  })

  return hasPositiveAmount((json as { balance?: unknown }).balance)
}

async function hasNativeBalance(
  config: DiscoveryChainConfig,
  address: string
): Promise<boolean> {
  try {
    switch (config.kind) {
      case 'evm':
        return await hasEvmBalance(config, address)
      case 'solana':
        return await hasSolanaBalance(config, address)
      case 'sui':
        return await hasSuiBalance(config, address)
      case 'cosmos':
        return await hasCosmosBalance(config, address)
      case 'ton':
        return await hasTonBalance(address)
      case 'tron':
        return await hasTronBalance(config, address)
      default:
        return false
    }
  } catch {
    return false
  }
}

async function discoverChain(
  mnemonic: string,
  config: DiscoveryChainConfig
): Promise<ImportWalletDiscoveryResult | null> {
  const address = await deriveDiscoveryAddress(mnemonic, config)
  const hasBalance = await hasNativeBalance(config, address)

  return hasBalance
    ? {
        chain: config.chain,
        address,
        ticker: config.ticker,
      }
    : null
}

export async function discoverImportWalletChains(
  mnemonic: string,
  onProgress?: (progress: number) => void,
  onDiscovered?: (result: ImportWalletDiscoveryResult) => void
): Promise<ImportWalletDiscoveryResult[]> {
  const results: ImportWalletDiscoveryResult[] = []
  let completed = 0

  for (
    let index = 0;
    index < STATION_DISCOVERY_CHAINS.length;
    index += DISCOVERY_BATCH_SIZE
  ) {
    const batch = STATION_DISCOVERY_CHAINS.slice(
      index,
      index + DISCOVERY_BATCH_SIZE
    )
    const batchResults = await Promise.all(
      batch.map(async (config) => {
        try {
          const result = await discoverChain(mnemonic, config)
          if (result) onDiscovered?.(result)
          return result
        } catch {
          return null
        } finally {
          completed += 1
          onProgress?.(completed / STATION_DISCOVERY_CHAINS.length)
        }
      })
    )

    results.push(
      ...batchResults.filter(
        (result): result is ImportWalletDiscoveryResult =>
          result !== null
      )
    )
  }

  return results
}
