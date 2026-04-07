import { create, toBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
import { derivePublicKeyHex, buildVaultProto } from './vaultProto'

/**
 * Encrypts binary data with AES-256-GCM using a password.
 * Key = SHA256(password), nonce = random 12 bytes.
 * Output: nonce (12) + ciphertext + authTag (16).
 * Matches vultiagent-app / vultisig-ios encryption format.
 */
function encryptWithPassword(data: Uint8Array, password: string): Uint8Array {
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
 * Constructs a KeyImport vault protobuf from a raw secp256k1 private key,
 * encrypts with AES-256-GCM, wraps in VaultContainer, and writes to a
 * shareable .vult file.
 *
 * The produced file is importable by any Vultisig app via "Import Vault Share".
 */
export async function exportVaultShare(
  privateKeyHex: string,
  walletName: string,
  exportPassword: string,
): Promise<string> {
  const publicKeyHex = derivePublicKeyHex(privateKeyHex)
  const vaultProto = buildVaultProto(walletName, publicKeyHex, privateKeyHex)
  const vaultBytes = toBinary(VaultSchema, vaultProto)
  const encryptedBytes = encryptWithPassword(vaultBytes, exportPassword)

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
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Export Vault Share',
  })
}
