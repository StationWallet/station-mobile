import CryptoJS from 'crypto-js'
import { RawKey } from '@terra-money/terra.js'

import {
  validatePrivateKey,
  type ValidatedPrivateKey,
} from './privateKeyImport'

/**
 * Decrypts a legacy Terra Station SPA `encrypted` blob into a hex private key.
 *
 * Format produced by the legacy SPA's encrypt() in main.b2b3f170.chunk.js:
 *   hex(salt[16]) + hex(iv[16]) + base64(AES-256-CBC ciphertext)
 *
 * KDF: PBKDF2-SHA1, keySize 8 words (= 256 bits), iterations 100 (crypto-js defaults).
 * Cipher: AES-256-CBC + PKCS7.
 *
 * Validated against spiketest fixture (terra1l2ptd0ch433fwhh2mhah0umn23t7xgy9h04njr,
 * password "SpikePass1234") on 2026-05-10 — see .spikes/legacy-spa-webview-2026-05-10.md.
 */
export const SALT_HEX_LEN = 32
export const IV_HEX_LEN = 32

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password')
    this.name = 'WrongPasswordError'
  }
}

export class MalformedBlobError extends Error {
  constructor(reason: string) {
    super(`Malformed encrypted blob: ${reason}`)
    this.name = 'MalformedBlobError'
  }
}

function isHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s)
}

/**
 * Decrypt a single wallet's encrypted blob using the user's SPA password.
 * Returns the validated private key (hex + public key + terra address).
 * Throws WrongPasswordError if the password fails to produce a valid secp256k1 key.
 */
export function decryptLegacyWallet(
  encrypted: string,
  password: string
): ValidatedPrivateKey {
  if (encrypted.length < SALT_HEX_LEN + IV_HEX_LEN + 1) {
    throw new MalformedBlobError('shorter than salt+iv+ciphertext')
  }

  const saltHex = encrypted.slice(0, SALT_HEX_LEN)
  const ivHex = encrypted.slice(
    SALT_HEX_LEN,
    SALT_HEX_LEN + IV_HEX_LEN
  )
  const ciphertextB64 = encrypted.slice(SALT_HEX_LEN + IV_HEX_LEN)

  if (!isHex(saltHex)) throw new MalformedBlobError('non-hex salt')
  if (!isHex(ivHex)) throw new MalformedBlobError('non-hex iv')

  const salt = CryptoJS.enc.Hex.parse(saltHex)
  const iv = CryptoJS.enc.Hex.parse(ivHex)
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 8,
    iterations: 100,
  })

  let plainHex: string
  try {
    const decrypted = CryptoJS.AES.decrypt(
      // crypto-js's CipherParams contract; { ciphertext } is sufficient.
      // Cast through unknown because @types/crypto-js insists on a full CipherParams.
      {
        ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64),
      } as unknown as Parameters<typeof CryptoJS.AES.decrypt>[0],
      key,
      { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC }
    )
    plainHex = decrypted.toString(CryptoJS.enc.Utf8)
  } catch {
    throw new WrongPasswordError()
  }

  // CryptoJS returns an empty string on UTF-8 decode failure rather than throwing.
  if (!plainHex || !/^[0-9a-fA-F]{64}$/.test(plainHex)) {
    throw new WrongPasswordError()
  }

  try {
    return validatePrivateKey(plainHex)
  } catch {
    throw new WrongPasswordError()
  }
}

/**
 * The wallet entry shape the legacy SPA writes to its localStorage['keys'].
 * Schema observed: [{ name, address, encrypted }]
 */
export interface SpaLegacyWalletEntry {
  name: string
  address: string
  encrypted: string
}

/**
 * Parse the `keys` localStorage value (a JSON-encoded array) and filter to
 * well-formed entries. Tolerates older single-wallet shapes by ignoring entries
 * without the three required fields.
 */
export function parseSpaWalletsJson(
  raw: string
): SpaLegacyWalletEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (e): e is SpaLegacyWalletEntry =>
      e &&
      typeof e === 'object' &&
      typeof (e as SpaLegacyWalletEntry).name === 'string' &&
      typeof (e as SpaLegacyWalletEntry).address === 'string' &&
      typeof (e as SpaLegacyWalletEntry).encrypted === 'string' &&
      (e as SpaLegacyWalletEntry).encrypted.length >
        SALT_HEX_LEN + IV_HEX_LEN
  )
}

// Re-export for tests / call sites that want to assert address parity.
export { RawKey }
