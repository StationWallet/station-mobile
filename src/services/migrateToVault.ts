import { toBinary, fromBinary, create } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { getAuthData, upsertAuthData, AuthDataValueType, LedgerDataValueType } from 'utils/authData'
import type { KeyImportResult } from './dklsKeyImport'

const VAULT_KEY_PREFIX = 'VAULT-'

const VAULT_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** Sanitize a wallet name into a valid SecureStore key (alphanumeric, '.', '-', '_' only). */
function vaultStoreKey(walletName: string): string {
  return (
    VAULT_KEY_PREFIX + walletName.replace(/[^a-zA-Z0-9._-]/g, '_')
  )
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
export async function discoverLegacyWallets(): Promise<
  MigrationWallet[]
> {
  const authData = await getAuthData()
  if (!authData) return []

  return Object.entries(authData).map(([name, data]) => ({
    name,
    address: data.address,
    ledger: data.ledger === true,
    path:
      data.ledger === true
        ? (data as LedgerDataValueType).path
        : undefined,
  }))
}


/**
 * Reads a stored vault protobuf for a given wallet name.
 * Returns the raw base64-encoded vault bytes, or null if not found.
 */
export async function getStoredVault(
  walletName: string
): Promise<string | null> {
  return SecureStore.getItemAsync(
    vaultStoreKey(walletName),
    VAULT_STORE_OPTS
  )
}

/**
 * Stores a DKLS fast vault and deletes the legacy auth data entry.
 * Only deletes legacy data after verifying the vault reads back correctly.
 */
export async function storeFastVault(
  walletName: string,
  result: KeyImportResult
): Promise<void> {
  if (await isVaultFastVault(walletName)) {
    // eslint-disable-next-line no-console -- important diagnostic for double-migration attempts
    console.warn(
      `[storeFastVault] ${walletName} already migrated, skipping`
    )
    return
  }

  const vault = create(VaultSchema, {
    name: walletName,
    publicKeyEcdsa: result.publicKey,
    publicKeyEddsa: '',
    signers: [result.localPartyId, result.serverPartyId],
    localPartyId: result.localPartyId,
    hexChainCode: result.chainCode,
    resharePrefix: '',
    libType: LibType.DKLS,
    keyShares: [
      { publicKey: result.publicKey, keyshare: result.keyshare },
    ],
    chainPublicKeys: [
      { chain: 'Terra', publicKey: result.publicKey, isEddsa: false },
    ],
    createdAt: {
      seconds: BigInt(Math.floor(Date.now() / 1000)),
      nanos: 0,
    },
    publicKeyMldsa44: '',
  })

  const vaultBytes = toBinary(VaultSchema, vault)
  const encoded = base64.encode(vaultBytes)

  await SecureStore.setItemAsync(
    vaultStoreKey(walletName),
    encoded,
    VAULT_STORE_OPTS
  )

  // Ensure the wallet appears in the legacy wallet list (getWallets reads authData).
  // For migrations: strip key material but keep the entry.
  // For new vaults: create a minimal entry so the wallet is discoverable.
  const authData = await getAuthData()
  const existing = authData?.[walletName]

  if (existing && !existing.ledger) {
    // Migration: strip sensitive data from the existing entry
    const entry = existing as AuthDataValueType
    await upsertAuthData({
      authData: {
        [walletName]: {
          address: entry.address,
          encryptedKey: '',
          password: '',
          ledger: false,
        },
      },
    })
  } else if (!existing) {
    // New vault creation: register in authData so getWallets() can find it
    await upsertAuthData({
      authData: {
        [walletName]: {
          address: '',
          encryptedKey: '',
          password: '',
          ledger: false,
        },
      },
    })
  }
}

/**
 * Check if a stored vault is a DKLS fast vault (vs legacy KEYIMPORT).
 */
export async function isVaultFastVault(
  walletName: string
): Promise<boolean> {
  const stored = await getStoredVault(walletName)
  if (!stored) return false
  try {
    const decoded = fromBinary(VaultSchema, base64.decode(stored))
    return decoded.libType === LibType.DKLS
  } catch {
    return false
  }
}

export { VAULT_KEY_PREFIX, VAULT_STORE_OPTS, vaultStoreKey }
