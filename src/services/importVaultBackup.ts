import { fromBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64 } from '@scure/base'
import { toBinary } from '@bufbuild/protobuf'
import * as SecureStore from 'expo-secure-store'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
import { vaultStoreKey } from './migrateToVault'

const VAULT_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

type ImportVaultBackupInput = {
  content: string
  fileName: string
  password?: string
}

type ImportVaultBackupResult =
  | { needsPassword: true }
  | {
      needsPassword: false
      vaultName: string
      publicKeyEcdsa: string
    }

function decryptVaultBytes(encrypted: Uint8Array, password: string) {
  const nonce = encrypted.slice(0, 12)
  const ciphertextWithTag = encrypted.slice(12)
  const key = sha256(new TextEncoder().encode(password))

  return gcm(key, nonce).decrypt(ciphertextWithTag)
}

function getKeyshareForPublicKey(
  keyshares: Array<{ publicKey: string; keyshare: string }>,
  publicKey: string
) {
  return keyshares.find((entry) => entry.publicKey === publicKey)?.keyshare ?? ''
}

function inferSigners(fileName: string, signers: string[]) {
  if (signers.length > 0) return signers
  if (/share\d+of\d+/i.test(fileName)) {
    return ['Device', 'Server']
  }
  return ['Device']
}

/**
 * Imports a vault backup file (.bak / .vult).
 *
 * Parses the base64 content as a VaultContainer protobuf.
 * If encrypted and no password provided, returns { needsPassword: true }.
 * Otherwise decrypts, validates the vault, and stores it in SecureStore.
 */
export function importVaultBackup({
  content,
  fileName,
  password,
}: ImportVaultBackupInput): ImportVaultBackupResult {
  const containerBytes = base64.decode(content.trim())
  const container = fromBinary(VaultContainerSchema, containerBytes)

  if (container.isEncrypted && !password?.trim()) {
    return { needsPassword: true }
  }

  const vaultBytes = container.isEncrypted
    ? decryptVaultBytes(base64.decode(container.vault), password!.trim())
    : base64.decode(container.vault)

  const vault = fromBinary(VaultSchema, vaultBytes)

  const keyshareEcdsa = getKeyshareForPublicKey(vault.keyShares, vault.publicKeyEcdsa)
  const keyshareEddsa = getKeyshareForPublicKey(vault.keyShares, vault.publicKeyEddsa)

  if (!keyshareEcdsa && !keyshareEddsa) {
    throw new Error('This backup is missing the device keyshare required for import.')
  }

  // Re-serialize with inferred signers if needed
  const signers = inferSigners(fileName, vault.signers)
  if (signers !== vault.signers) {
    vault.signers = signers
  }

  return {
    needsPassword: false,
    vaultName: vault.name || 'Imported Vault',
    publicKeyEcdsa: vault.publicKeyEcdsa,
  }
}

/**
 * Persists an imported vault to SecureStore.
 * Call after importVaultBackup returns { needsPassword: false }.
 */
export async function persistImportedVault(
  content: string,
  fileName: string,
  password?: string,
): Promise<{ vaultName: string; publicKeyEcdsa: string }> {
  const containerBytes = base64.decode(content.trim())
  const container = fromBinary(VaultContainerSchema, containerBytes)

  const vaultBytes = container.isEncrypted
    ? decryptVaultBytes(base64.decode(container.vault), password!.trim())
    : base64.decode(container.vault)

  const vault = fromBinary(VaultSchema, vaultBytes)
  const signers = inferSigners(fileName, vault.signers)
  vault.signers = signers

  const storedBytes = toBinary(VaultSchema, vault)
  const encoded = base64.encode(storedBytes)
  const vaultName = vault.name || 'Imported Vault'

  await SecureStore.setItemAsync(
    vaultStoreKey(vaultName),
    encoded,
    VAULT_STORE_OPTS,
  )

  // Verify the write
  const readBack = await SecureStore.getItemAsync(
    vaultStoreKey(vaultName),
    VAULT_STORE_OPTS,
  )
  if (readBack !== encoded) {
    throw new Error('Vault verification failed: stored data does not match')
  }

  return {
    vaultName,
    publicKeyEcdsa: vault.publicKeyEcdsa,
  }
}
