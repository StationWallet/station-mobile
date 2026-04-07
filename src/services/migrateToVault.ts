import { create, toBinary } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex, base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { getAuthData, AuthDataValueType, LedgerDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'

const LOCAL_PARTY_ID = 'station-mobile'
const VAULT_KEY_PREFIX = 'VAULT-'

function vaultStoreOpts(): SecureStore.SecureStoreOptions {
  return {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  }
}

function derivePublicKeyHex(privateKeyHex: string): string {
  const privateKeyBytes = hex.decode(privateKeyHex)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
  return hex.encode(publicKeyBytes)
}

export interface MigrationWallet {
  name: string
  address: string
  ledger: boolean
  path?: number
}

export interface MigrationResult {
  wallet: MigrationWallet
  success: boolean
  error?: string
}

/**
 * Reads legacy auth data and returns the list of wallets available for migration.
 */
export async function discoverLegacyWallets(): Promise<MigrationWallet[]> {
  const authData = await getAuthData()
  if (!authData) return []

  return Object.entries(authData).map(([name, data]) => ({
    name,
    address: data.address,
    ledger: data.ledger === true,
    path: data.ledger === true ? (data as LedgerDataValueType).path : undefined,
  }))
}

/**
 * Migrates a single wallet to vault protobuf format and stores it.
 * For standard wallets: decrypts key, builds full vault with key material.
 * For Ledger wallets: builds vault with address info only (no key material).
 */
export async function migrateWalletToVault(
  name: string,
  data: AuthDataValueType | LedgerDataValueType,
): Promise<MigrationResult> {
  const wallet: MigrationWallet = {
    name,
    address: data.address,
    ledger: data.ledger === true,
    path: data.ledger === true ? (data as LedgerDataValueType).path : undefined,
  }

  try {
    let publicKeyHex = ''
    let privateKeyHex = ''

    if (!data.ledger) {
      const standardData = data as AuthDataValueType
      privateKeyHex = decrypt(standardData.encryptedKey, standardData.password)
      if (!privateKeyHex) {
        return { wallet, success: false, error: 'Decryption failed' }
      }
      publicKeyHex = derivePublicKeyHex(privateKeyHex)
    }

    const vaultProto = create(VaultSchema, {
      name,
      publicKeyEcdsa: publicKeyHex,
      publicKeyEddsa: '',
      signers: [LOCAL_PARTY_ID],
      localPartyId: LOCAL_PARTY_ID,
      hexChainCode: '',
      resharePrefix: '',
      libType: LibType.KEYIMPORT,
      keyShares: publicKeyHex
        ? [{ publicKey: publicKeyHex, keyshare: privateKeyHex }]
        : [],
      chainPublicKeys: publicKeyHex
        ? [{ chain: 'Terra', publicKey: publicKeyHex, isEddsa: false }]
        : [],
      createdAt: {
        seconds: BigInt(Math.floor(Date.now() / 1000)),
        nanos: 0,
      },
      publicKeyMldsa44: '',
    })

    const vaultBytes = toBinary(VaultSchema, vaultProto)
    const encoded = base64.encode(vaultBytes)

    await SecureStore.setItemAsync(
      `${VAULT_KEY_PREFIX}${name}`,
      encoded,
      vaultStoreOpts(),
    )

    return { wallet, success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { wallet, success: false, error: msg }
  }
}

/**
 * Migrates all wallets from legacy auth data to vault protobuf format.
 * Calls `onProgress` after each wallet completes (for animation timing).
 */
export async function migrateAllWallets(
  onProgress?: (result: MigrationResult, index: number, total: number) => void,
): Promise<MigrationResult[]> {
  const authData = await getAuthData()
  if (!authData) return []

  const entries = Object.entries(authData)
  const results: MigrationResult[] = []

  for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i]
    const result = await migrateWalletToVault(name, data)
    results.push(result)
    onProgress?.(result, i, entries.length)
  }

  return results
}

/**
 * Reads a stored vault protobuf for a given wallet name.
 * Returns the raw base64-encoded vault bytes, or null if not found.
 */
export async function getStoredVault(walletName: string): Promise<string | null> {
  return SecureStore.getItemAsync(
    `${VAULT_KEY_PREFIX}${walletName}`,
    vaultStoreOpts(),
  )
}

export { VAULT_KEY_PREFIX }
