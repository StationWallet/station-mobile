import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function deriveSlip10Child(
  key: Uint8Array,
  chainCode: Uint8Array,
  index: number
): Uint8Array {
  const { hmac } = require('@noble/hashes/hmac.js')
  const { sha512 } = require('@noble/hashes/sha2.js')

  const data = new Uint8Array(1 + 32 + 4)
  data[0] = 0
  data.set(key, 1)
  new DataView(data.buffer).setUint32(33, index, false)

  return hmac(sha512, chainCode, data)
}

function clampThenUniformScalar(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes for ed25519 clamping')
  }

  const { sha512 } = require('@noble/hashes/sha2.js')
  const digest = sha512(seed)
  const clamped = new Uint8Array(digest.slice(0, 32))

  clamped[0] &= 248
  clamped[31] &= 63
  clamped[31] |= 64

  const order = BigInt(
    '0x1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED'
  )
  let scalar = BigInt(0)
  for (let i = 0; i < 32; i++) {
    scalar |= BigInt(clamped[i]) << (BigInt(i) * BigInt(8))
  }
  scalar %= order

  const result = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    result[i] = Number((scalar >> (BigInt(i) * BigInt(8))) & 0xffn)
  }
  return result
}

export type SeedImportChain =
  | 'Bitcoin'
  | 'Litecoin'
  | 'Dogecoin'
  | 'Bitcoin-Cash'
  | 'Dash'
  | 'Zcash'
  | 'Ethereum'
  | 'Avalanche'
  | 'BSC'
  | 'Polygon'
  | 'Arbitrum'
  | 'Optimism'
  | 'Base'
  | 'Blast'
  | 'CronosChain'
  | 'Zksync'
  | 'Mantle'
  | 'Hyperliquid'
  | 'Sei'
  | 'THORChain'
  | 'MayaChain'
  | 'Cosmos'
  | 'Kujira'
  | 'Dydx'
  | 'Osmosis'
  | 'Noble'
  | 'Akash'
  | 'Terra'
  | 'TerraClassic'
  | 'Solana'
  | 'Sui'
  | 'Ton'
  | 'Polkadot'
  | 'Bittensor'
  | 'Ripple'
  | 'Tron'

export type SeedImportDerivationGroup = {
  representativeChain: SeedImportChain
  chains: SeedImportChain[]
  isEddsa: boolean
}

export type SeedMasterKeys = {
  ecdsaPrivateKey: string
  ecdsaChainCode: string
  eddsaPrivateKey: string
}

// chainPublicKeys[] in the exported .vult is treated by vultisig-ios as the
// authoritative chain list for KeyImport vaults (see iOS VaultDefaultCoinService
// getDefaultChains: returns vault.chainPublicKeys.map(\.chain) for .KeyImport,
// AND VaultDetailViewModel.canShowChainSelection returns false for KeyImport
// vaults — meaning users cannot add chains in-app after import). Any chain
// omitted here is permanently absent from the resulting vault on iOS.
//
// Every chain listed here derives via TrustWalletCore in a way that matches
// vultisig-ios's own KeyImport flow:
//  - ECDSA (secp256k1) chains use BIP44 default coin-type paths.
//  - EdDSA (ed25519) chains use BIP44 default except Solana, which uses the
//    `solanaSolana` (Phantom) derivation (=6) — the only chain with an
//    alternativeDerivations entry in iOS KeyImportChainsSetupViewModel.
//  - Polkadot and Bittensor both derive from CoinType.polkadot at
//    m/44'/354'/0'/0'/0'; iOS SS58-encodes the resulting pubkey with prefix 0
//    for DOT and prefix 42 for TAO at display time (CoinFactory.swift). This
//    intentionally matches Trust Wallet's "BIP44 ed25519 over coin type 354"
//    approach and intentionally does NOT match Polkadot.js/Subwallet/btcli,
//    which use SR25519 + native Substrate derivation (a different ecosystem).
//
// Excluded:
//  - Cardano: needs ed25519Cardano extended key (chain code material), not a
//    plain 32-byte ed25519 pubkey. iOS itself excludes it from
//    Chain.keyImportEnabledChains.
//  - MLDSA chains (qbtc): use a separate publicKeyMldsa44 key entirely.
export const SEED_IMPORT_DERIVATION_GROUPS: SeedImportDerivationGroup[] =
  (
    [
      'Bitcoin',
      'Litecoin',
      'Dogecoin',
      'Bitcoin-Cash',
      'Dash',
      'Zcash',
      'Ethereum',
      'Avalanche',
      'BSC',
      'Polygon',
      'Arbitrum',
      'Optimism',
      'Base',
      'Blast',
      'CronosChain',
      'Zksync',
      'Mantle',
      'Hyperliquid',
      'Sei',
      'THORChain',
      'MayaChain',
      'Cosmos',
      'Kujira',
      'Dydx',
      'Osmosis',
      'Noble',
      'Akash',
      'Terra',
      'TerraClassic',
      'Ripple',
      'Tron',
      'Solana',
      'Sui',
      'Ton',
      'Polkadot',
      'Bittensor',
    ] as SeedImportChain[]
  ).map((chain) => ({
    representativeChain: chain,
    chains: [chain],
    isEddsa: isSeedImportEddsaChain(chain),
  }))

export function getSeedImportDerivationGroups(
  chains?: SeedImportChain[]
): SeedImportDerivationGroup[] {
  if (!chains?.length) return SEED_IMPORT_DERIVATION_GROUPS

  // Reject unknown chain names rather than silently dropping them. An empty
  // result from a typo / bad route-params input would produce a fast vault
  // with no chains — iOS treats chainPublicKeys[] as authoritative for
  // KeyImport and cannot recover from that without a full re-import.
  const knownChains = new Set<SeedImportChain>(
    SEED_IMPORT_DERIVATION_GROUPS.flatMap((g) => g.chains)
  )
  const unknown = chains.filter((c) => !knownChains.has(c))
  if (unknown.length > 0) {
    throw new Error(
      `Unknown seed import chains: ${unknown.join(', ')}`
    )
  }

  const chainsToImport = new Set<SeedImportChain>(chains)

  return SEED_IMPORT_DERIVATION_GROUPS.map((group) => ({
    ...group,
    chains: group.chains.filter((chain) => chainsToImport.has(chain)),
  })).filter((group) => group.chains.length > 0)
}

const COIN_TYPES: Record<SeedImportChain, number> = {
  Bitcoin: 0,
  Litecoin: 2,
  Dogecoin: 3,
  'Bitcoin-Cash': 145,
  Dash: 5,
  Zcash: 133,
  Ethereum: 60,
  Avalanche: 9000,
  BSC: 714,
  Polygon: 966,
  Arbitrum: 60,
  Optimism: 60,
  Base: 60,
  Blast: 60,
  CronosChain: 60,
  Zksync: 60,
  Mantle: 60,
  Hyperliquid: 60,
  Sei: 60,
  THORChain: 931,
  MayaChain: 931,
  Cosmos: 118,
  Kujira: 118,
  Dydx: 118,
  Osmosis: 118,
  Noble: 118,
  Akash: 118,
  Terra: 330,
  TerraClassic: 330,
  Solana: 501,
  Sui: 784,
  Ton: 607,
  Polkadot: 354,
  Bittensor: 354,
  Ripple: 144,
  Tron: 195,
}

const ECDSA_DERIVATION_PATHS: Partial<
  Record<SeedImportChain, string>
> = {
  Bitcoin: "m/84'/0'/0'/0/0",
  Litecoin: "m/84'/2'/0'/0/0",
  Dogecoin: "m/44'/3'/0'/0/0",
  'Bitcoin-Cash': "m/44'/145'/0'/0/0",
  Dash: "m/44'/5'/0'/0/0",
  Zcash: "m/44'/133'/0'/0/0",
  Ethereum: "m/44'/60'/0'/0/0",
  Avalanche: "m/44'/60'/0'/0/0",
  BSC: "m/44'/60'/0'/0/0",
  Polygon: "m/44'/60'/0'/0/0",
  Arbitrum: "m/44'/60'/0'/0/0",
  Optimism: "m/44'/60'/0'/0/0",
  Base: "m/44'/60'/0'/0/0",
  Blast: "m/44'/60'/0'/0/0",
  CronosChain: "m/44'/60'/0'/0/0",
  Zksync: "m/44'/60'/0'/0/0",
  Mantle: "m/44'/60'/0'/0/0",
  Hyperliquid: "m/44'/60'/0'/0/0",
  Sei: "m/44'/60'/0'/0/0",
  THORChain: "m/44'/931'/0'/0/0",
  MayaChain: "m/44'/931'/0'/0/0",
  Cosmos: "m/44'/118'/0'/0/0",
  Kujira: "m/44'/118'/0'/0/0",
  Dydx: "m/44'/118'/0'/0/0",
  Osmosis: "m/44'/118'/0'/0/0",
  Noble: "m/44'/118'/0'/0/0",
  Akash: "m/44'/118'/0'/0/0",
  Terra: "m/44'/330'/0'/0/0",
  TerraClassic: "m/44'/330'/0'/0/0",
  Ripple: "m/44'/144'/0'/0/0",
  Tron: "m/44'/195'/0'/0/0",
}

// WalletCore Derivation enum: solanaSolana = 6 (the "Phantom" Solana derivation).
// vultisig-ios uses this for the user-facing Solana address on KeyImport vaults
// (see KeyImportChainsSetupViewModel: DerivationOption(derivation: .solanaSolana)).
// Without this override, station-mobile would write the BIP44-default pubkey into
// chainPublicKeys[], which produces a different address than vultisig-ios shows.
const SOLANA_SOLANA_DERIVATION = 6

const WALLET_CORE_COIN_TYPE_NAMES: Record<SeedImportChain, string> = {
  Bitcoin: 'bitcoin',
  Litecoin: 'litecoin',
  Dogecoin: 'dogecoin',
  'Bitcoin-Cash': 'bitcoinCash',
  Dash: 'dash',
  Zcash: 'zcash',
  Ethereum: 'ethereum',
  Avalanche: 'avalancheCChain',
  BSC: 'smartChain',
  Polygon: 'polygon',
  Arbitrum: 'arbitrum',
  Optimism: 'optimism',
  Base: 'base',
  Blast: 'blast',
  CronosChain: 'cronosChain',
  Zksync: 'zksync',
  Mantle: 'mantle',
  Hyperliquid: 'ethereum',
  Sei: 'ethereum',
  THORChain: 'thorchain',
  MayaChain: 'thorchain',
  Cosmos: 'cosmos',
  Kujira: 'kujira',
  Dydx: 'dydx',
  Osmosis: 'osmosis',
  Noble: 'noble',
  Akash: 'akash',
  Terra: 'terraV2',
  TerraClassic: 'terra',
  Ripple: 'xrp',
  Tron: 'tron',
  Solana: 'solana',
  Sui: 'sui',
  Ton: 'ton',
  Polkadot: 'polkadot',
  Bittensor: 'polkadot',
}

function isSeedImportEddsaChain(chain: SeedImportChain): boolean {
  return (
    chain === 'Solana' ||
    chain === 'Sui' ||
    chain === 'Ton' ||
    chain === 'Polkadot' ||
    chain === 'Bittensor'
  )
}

export function validateSeedPhrase(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.trim().toLowerCase())
}

export function deriveMasterKeys(mnemonic: string): SeedMasterKeys {
  const normalized = mnemonic.trim().toLowerCase()
  if (!validateSeedPhrase(normalized)) {
    throw new Error('Invalid seed phrase')
  }

  const seed = new Uint8Array(bip39.mnemonicToSeedSync(normalized))
  const master = HDKey.fromMasterSeed(seed)

  const { hmac } = require('@noble/hashes/hmac.js')
  const { sha512 } = require('@noble/hashes/sha2.js')
  const ed25519Seed = new TextEncoder().encode('ed25519 seed')
  const eddsaMaster = hmac(sha512, ed25519Seed, seed).slice(0, 32)

  return {
    ecdsaPrivateKey: bytesToHex(master.privateKey!),
    ecdsaChainCode: bytesToHex(master.chainCode!),
    eddsaPrivateKey: bytesToHex(clampThenUniformScalar(eddsaMaster)),
  }
}

export function deriveChainKey(
  mnemonic: string,
  chain: SeedImportChain
): {
  privateKey: string
  chainCode: string
  isEddsa: boolean
} {
  const normalized = mnemonic.trim().toLowerCase()
  if (!validateSeedPhrase(normalized)) {
    throw new Error('Invalid seed phrase')
  }

  const seed = new Uint8Array(bip39.mnemonicToSeedSync(normalized))
  const coinType = COIN_TYPES[chain]

  if (isSeedImportEddsaChain(chain)) {
    const { hmac } = require('@noble/hashes/hmac.js')
    const { sha512 } = require('@noble/hashes/sha2.js')
    const hardened = 0x80000000

    let digest = hmac(
      sha512,
      new TextEncoder().encode('ed25519 seed'),
      seed
    )
    let key = digest.slice(0, 32)
    let chainCode = digest.slice(32, 64)

    const path =
      chain === 'Ton'
        ? [44, coinType, 0]
        : chain === 'Polkadot' || chain === 'Bittensor'
        ? [44, coinType, 0, 0, 0]
        : [44, coinType, 0, 0]

    for (const index of path) {
      digest = deriveSlip10Child(key, chainCode, index + hardened)
      key = digest.slice(0, 32)
      chainCode = digest.slice(32, 64)
    }

    return {
      privateKey: bytesToHex(clampThenUniformScalar(key)),
      chainCode: '',
      isEddsa: true,
    }
  }

  const master = HDKey.fromMasterSeed(seed)
  const path = ECDSA_DERIVATION_PATHS[chain]
  if (!path) {
    throw new Error(`Unsupported ECDSA chain: ${chain}`)
  }
  const derived = master.derive(path)
  return {
    privateKey: bytesToHex(derived.privateKey!),
    chainCode: bytesToHex(derived.chainCode!),
    isEddsa: false,
  }
}

export async function deriveChainKeyForImport(
  mnemonic: string,
  chain: SeedImportChain
): Promise<{
  privateKey: string
  chainCode: string
  isEddsa: boolean
}> {
  try {
    const {
      NativeWalletCore,
    } = require('@vultisig/walletcore-native')
    const walletCore = NativeWalletCore.getInstance()
    const normalized = mnemonic.trim().toLowerCase()
    const coinTypeName = WALLET_CORE_COIN_TYPE_NAMES[chain]
    const coinType = walletCore.CoinType[coinTypeName]
    if (coinType === undefined) {
      throw new Error(`CoinType not found for chain: ${chain}`)
    }

    const wallet = walletCore.HDWallet.createWithMnemonic(
      normalized,
      ''
    )
    try {
      const key =
        chain === 'Solana'
          ? wallet.getKeyDerivation(
              coinType,
              SOLANA_SOLANA_DERIVATION
            )
          : wallet.getKeyForCoin(coinType)
      try {
        const keyData = new Uint8Array(key.data())
        return {
          privateKey: bytesToHex(
            isSeedImportEddsaChain(chain)
              ? clampThenUniformScalar(keyData)
              : keyData
          ),
          chainCode: '',
          isEddsa: isSeedImportEddsaChain(chain),
        }
      } finally {
        key.delete?.()
      }
    } finally {
      wallet.delete?.()
    }
  } catch {
    return deriveChainKey(mnemonic, chain)
  }
}

export async function deriveChainPublicKeyForImport(
  mnemonic: string,
  chain: SeedImportChain
): Promise<string> {
  try {
    const {
      NativeWalletCore,
    } = require('@vultisig/walletcore-native')
    const walletCore = NativeWalletCore.getInstance()
    const normalized = mnemonic.trim().toLowerCase()
    const coinTypeName = WALLET_CORE_COIN_TYPE_NAMES[chain]
    const coinType = walletCore.CoinType[coinTypeName]
    if (coinType === undefined) {
      throw new Error(`CoinType not found for chain: ${chain}`)
    }

    const wallet = walletCore.HDWallet.createWithMnemonic(
      normalized,
      ''
    )
    try {
      const key =
        chain === 'Solana'
          ? wallet.getKeyDerivation(
              coinType,
              SOLANA_SOLANA_DERIVATION
            )
          : wallet.getKeyForCoin(coinType)
      try {
        const publicKey = isSeedImportEddsaChain(chain)
          ? key.getPublicKeyEd25519()
          : key.getPublicKeySecp256k1(true)
        try {
          return bytesToHex(new Uint8Array(publicKey.data()))
        } finally {
          publicKey.delete?.()
        }
      } finally {
        key.delete?.()
      }
    } finally {
      wallet.delete?.()
    }
  } catch {
    const key = deriveChainKey(mnemonic, chain)
    if (!key.isEddsa) {
      throw new Error(
        `Native WalletCore is required to derive ${chain} public key`
      )
    }

    const { ed25519 } = require('@noble/curves/ed25519.js')
    return bytesToHex(ed25519.getPublicKey(key.privateKey))
  }
}
