import { fromBinary, toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { upsertAuthData } from 'utils/authData'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VAULT_STORE_OPTS, vaultStoreKey } from './migrateToVault'
import { decryptVaultBytes } from './vaultCrypto'

type ImportVaultBackupInput = {
  content: string
  fileName: string
  password?: string
}

export type ImportVaultBackupResult =
  | { needsPassword: true }
  | {
      needsPassword: false
      vaultName: string
      publicKeyEcdsa: string
      /** Pre-decoded vault bytes ready for persist — avoids re-decrypting. */
      vaultBytes: Uint8Array
    }

function getKeyshareForPublicKey(
  keyshares: Array<{ publicKey: string; keyshare: string }>,
  publicKey: string
): string {
  return (
    keyshares.find((entry) => entry.publicKey === publicKey)
      ?.keyshare ?? ''
  )
}

function inferSigners(fileName: string, signers: string[]): string[] {
  if (signers.length > 0) return signers
  if (/share\d+of\d+/i.test(fileName)) {
    return ['Device', 'Server']
  }
  return ['Device']
}

function isServerPartyId(partyId: string): boolean {
  return partyId.toLowerCase().startsWith('server-')
}

function assertImportableFastVault(vault: {
  libType: LibType
  localPartyId: string
  signers: string[]
}): void {
  // Accept both DKLS (Fast Vault from random keygen) and KEYIMPORT
  // (Fast Vault built by importing a seed-derived key). Both produce a
  // 2-of-2 device+server vault with identical MPC keyshare semantics —
  // "Fast Vault" describes the topology, not the protocol that built it.
  // The remaining checks below enforce the Fast Vault topology (device
  // share + server signer), which is what we actually need to import.
  // GG20 is rejected (legacy, different signing math).
  if (vault.libType === LibType.GG20) {
    throw new Error(
      'GG20 vault backups are not supported. Only DKLS-based vaults can be imported.'
    )
  }

  if (isServerPartyId(vault.localPartyId)) {
    throw new Error(
      'This is a server-side vault share and cannot be imported on this device.'
    )
  }

  if (!vault.signers.some(isServerPartyId)) {
    throw new Error(
      'This vault has no server-side Vultisig share. Multi-share vaults cannot be used in Station.'
    )
  }
}

/**
 * Decodes + validates a vault backup file (.bak / .vult).
 *
 * If encrypted and no password provided, returns { needsPassword: true }.
 * Otherwise decrypts, validates keyshares, and returns the decoded vault
 * bytes (ready for persist) so callers don't need to re-decrypt.
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
    ? decryptVaultBytes(
        base64.decode(container.vault),
        password!.trim()
      )
    : base64.decode(container.vault)

  const vault = fromBinary(VaultSchema, vaultBytes)

  const keyshareEcdsa = getKeyshareForPublicKey(
    vault.keyShares,
    vault.publicKeyEcdsa
  )
  const keyshareEddsa = getKeyshareForPublicKey(
    vault.keyShares,
    vault.publicKeyEddsa
  )

  if (!keyshareEcdsa && !keyshareEddsa) {
    throw new Error(
      'This backup is missing the device keyshare required for import.'
    )
  }

  assertImportableFastVault(vault)

  const signers = inferSigners(fileName, vault.signers)
  vault.signers = signers

  // Re-serialize with inferred signers so persistImportedVault can store directly
  const finalBytes = toBinary(VaultSchema, vault)

  return {
    needsPassword: false,
    vaultName: vault.name || 'Imported Vault',
    publicKeyEcdsa: vault.publicKeyEcdsa,
    vaultBytes: finalBytes,
  }
}

/**
 * Persists already-decoded vault bytes to SecureStore.
 * Accepts the vaultBytes returned by importVaultBackup to avoid re-decrypting.
 */
export async function persistImportedVault(
  vaultBytes: Uint8Array,
  vaultName: string
): Promise<void> {
  const encoded = base64.encode(vaultBytes)

  await SecureStore.setItemAsync(
    vaultStoreKey(vaultName),
    encoded,
    VAULT_STORE_OPTS
  )

  // Register in authData so getWallets() can discover the imported vault
  await upsertAuthData({
    authData: {
      [vaultName]: {
        address: '',
        encryptedKey: '',
        password: '',
        ledger: false,
      },
    },
  })
}
