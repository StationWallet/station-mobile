import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hex as scureHex, base64 as scureBase64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'

export function hexToBytes(h: string): Uint8Array {
  return scureHex.decode(h)
}

export function bytesToHex(bytes: Uint8Array): string {
  return scureHex.encode(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
  return scureBase64.encode(bytes)
}

export function base64ToBytes(b64: string): Uint8Array {
  return scureBase64.decode(b64)
}

export function randomHex(byteCount: number): string {
  const bytes = ExpoCrypto.getRandomBytes(byteCount)
  return bytesToHex(bytes)
}

export function randomUUID(): string {
  return ExpoCrypto.randomUUID()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * AES-256-GCM encryption for relay messages.
 * Key: SHA256(hexEncryptionKey bytes) → 32-byte cipher key.
 * Output: base64(nonce[12] + ciphertext + authTag[16]).
 */
export function encryptAesGcm(plaintext: string, hexEncryptionKey: string): string {
  const keyBytes = hexToBytes(hexEncryptionKey)
  const cipherKey = sha256(keyBytes)
  const nonce = ExpoCrypto.getRandomBytes(12)
  const aes = gcm(cipherKey, nonce)
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = aes.encrypt(plaintextBytes)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return bytesToBase64(result)
}

/**
 * AES-256-GCM decryption for relay messages.
 * Input: base64(nonce[12] + ciphertext + authTag[16]).
 */
export function decryptAesGcm(encryptedBase64: string, hexEncryptionKey: string): string {
  const encrypted = base64ToBytes(encryptedBase64)
  const keyBytes = hexToBytes(hexEncryptionKey)
  const cipherKey = sha256(keyBytes)
  const nonce = encrypted.slice(0, 12)
  const ciphertextWithTag = encrypted.slice(12)
  const aes = gcm(cipherKey, nonce)
  const plaintext = aes.decrypt(ciphertextWithTag)
  return new TextDecoder().decode(plaintext)
}

/** MD5 hash for relay message deduplication. */
export async function md5HashAsync(input: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.MD5,
    input
  )
}
