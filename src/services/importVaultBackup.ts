import { fromBinary, toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { upsertAuthData } from 'utils/authData'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
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
        airdropBucket: 'campaign_new',
        airdropRegistrationSource: 'vault_share',
      },
    },
  })
}
