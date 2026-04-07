import { toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { getAuthData, AuthDataValueType, LedgerDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'
import { derivePublicKeyHex, buildVaultProto } from './vaultProto'

const VAULT_KEY_PREFIX = 'VAULT-'

const VAULT_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
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

    const vaultProto = buildVaultProto(name, publicKeyHex, privateKeyHex)
    const vaultBytes = toBinary(VaultSchema, vaultProto)
    const encoded = base64.encode(vaultBytes)

    await SecureStore.setItemAsync(
      `${VAULT_KEY_PREFIX}${name}`,
      encoded,
      VAULT_STORE_OPTS,
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
    VAULT_STORE_OPTS,
  )
}

export { VAULT_KEY_PREFIX }
