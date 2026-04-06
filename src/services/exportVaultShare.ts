import { create, toBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex, base64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

const LOCAL_PARTY_ID = 'station-mobile'

import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'

function bytesToBase64(bytes: Uint8Array): string {
  return base64.encode(bytes)
}

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
 * Derives the compressed secp256k1 public key from a private key hex string.
 * Returns 33-byte compressed public key as hex (66 characters).
 */
function derivePublicKeyHex(privateKeyHex: string): string {
  const privateKeyBytes = hex.decode(privateKeyHex)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
  return hex.encode(publicKeyBytes)
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

  // 1. Build Vault protobuf
  const vaultProto = create(VaultSchema, {
    name: walletName,
    publicKeyEcdsa: publicKeyHex,
    publicKeyEddsa: '',
    signers: [LOCAL_PARTY_ID],
    localPartyId: LOCAL_PARTY_ID,
    hexChainCode: '',
    resharePrefix: '',
    libType: LibType.KEYIMPORT,
    keyShares: [
      { publicKey: publicKeyHex, keyshare: privateKeyHex },
    ],
    chainPublicKeys: [
      { chain: 'Terra', publicKey: publicKeyHex, isEddsa: false },
    ],
    createdAt: {
      seconds: BigInt(Math.floor(Date.now() / 1000)),
      nanos: 0,
    },
    publicKeyMldsa44: '',
  })

  // 2. Serialize to binary
  const vaultBytes = toBinary(VaultSchema, vaultProto)

  // 3. Encrypt with export password
  const encryptedBytes = encryptWithPassword(vaultBytes, exportPassword)

  // 4. Wrap in VaultContainer
  const container = create(VaultContainerSchema, {
    version: 1n,
    isEncrypted: true,
    vault: bytesToBase64(encryptedBytes),
  })

  // 5. Serialize container → base64
  const containerBytes = toBinary(VaultContainerSchema, container)
  const containerBase64 = bytesToBase64(containerBytes)

  // 6. Write to cache file
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
