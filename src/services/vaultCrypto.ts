import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import * as ExpoCrypto from 'expo-crypto'

/**
 * AES-256-GCM encrypts `data` with a key derived as SHA256(password).
 * Output layout: nonce (12 bytes) + ciphertext + auth tag (16 bytes).
 * Matches vultiagent-app / vultisig-ios vault encryption format.
 *
 * Accepts an optional explicit nonce for deterministic tests; production
 * callers should let it default to a fresh random 12-byte nonce.
 */
export function encryptWithPassword(
  data: Uint8Array,
  password: string,
  nonce: Uint8Array = ExpoCrypto.getRandomBytes(12)
): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  const ciphertext = gcm(key, nonce).encrypt(data)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return result
}

/** Inverse of `encryptWithPassword`. */
export function decryptVaultBytes(
  encrypted: Uint8Array,
  password: string
): Uint8Array {
  const nonce = encrypted.slice(0, 12)
  const ciphertextWithTag = encrypted.slice(12)
  const key = sha256(new TextEncoder().encode(password))

  return gcm(key, nonce).decrypt(ciphertextWithTag)
}
