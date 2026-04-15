import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'
import {
  cacheDirectory,
  writeAsStringAsync,
} from 'expo-file-system/legacy'
// expo-sharing is lazy-loaded in shareVaultFile() to avoid
// "Cannot find native module" crashes during Detox test startup.

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { derivePublicKeyHex, buildVaultProto } from './vaultProto'
import { getStoredVault } from './migrateToVault'

/**
 * Encrypts binary data with AES-256-GCM using a password.
 * Key = SHA256(password), nonce = random 12 bytes.
 * Output: nonce (12) + ciphertext + authTag (16).
 * Matches vultiagent-app / vultisig-ios encryption format.
 */
function encryptWithPassword(
  data: Uint8Array,
  password: string
): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  const nonce = ExpoCrypto.getRandomBytes(12)
  const ciphertext = gcm(key, nonce).encrypt(data)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return result
}

/**
 * Exports a wallet as an encrypted .vult vault share file.
 *
 * For DKLS fast vaults: reads the stored vault protobuf directly.
 * For legacy vaults: constructs a KeyImport vault protobuf from the raw
 * secp256k1 private key (privateKeyHex must be provided).
 *
 * Encrypts with AES-256-GCM, wraps in VaultContainer, and writes to a
 * shareable .vult file importable by any Vultisig app via "Import Vault Share".
 */
export async function exportVaultShare(
  walletName: string,
  exportPassword: string,
  privateKeyHex?: string // Only needed for legacy vaults
): Promise<string> {
  let vaultBytes: Uint8Array

  const stored = await getStoredVault(walletName)
  if (stored) {
    // Check if the stored vault is a DKLS fast vault — read directly
    const decoded = fromBinary(VaultSchema, base64.decode(stored))
    if (decoded.libType === LibType.DKLS) {
      vaultBytes = base64.decode(stored)
    } else if (privateKeyHex) {
      const publicKeyHex = derivePublicKeyHex(privateKeyHex)
      const vaultProto = buildVaultProto(
        walletName,
        publicKeyHex,
        privateKeyHex
      )
      vaultBytes = toBinary(VaultSchema, vaultProto)
    } else {
      throw new Error('privateKeyHex is required for legacy vaults')
    }
  } else {
    if (!privateKeyHex) {
      throw new Error('No vault found and no privateKeyHex provided')
    }
    const publicKeyHex = derivePublicKeyHex(privateKeyHex)
    const vaultProto = buildVaultProto(
      walletName,
      publicKeyHex,
      privateKeyHex
    )
    vaultBytes = toBinary(VaultSchema, vaultProto)
  }
  const encryptedBytes = encryptWithPassword(
    vaultBytes,
    exportPassword
  )

  const container = create(VaultContainerSchema, {
    version: 1n,
    isEncrypted: true,
    vault: base64.encode(encryptedBytes),
  })

  const containerBytes = toBinary(VaultContainerSchema, container)
  const containerBase64 = base64.encode(containerBytes)

  const cleanName = walletName.replace(/[^a-zA-Z0-9-_]/g, '-')
  const fileName = `${cleanName}-station-mobile.vult`
  const fileUri = `${cacheDirectory}${fileName}`
  await writeAsStringAsync(fileUri, containerBase64)

  return fileUri
}

/**
 * Opens the system share sheet for a .vult file.
 */
export async function shareVaultFile(fileUri: string): Promise<void> {
  const Sharing = require('expo-sharing') as typeof import('expo-sharing')
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Export Vault Share',
  })
}
