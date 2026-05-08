import { RawKey } from '@terra-money/terra.js'

import { derivePublicKeyHex } from './vaultProto'

export type ValidatedPrivateKey = {
  privateKeyHex: string
  publicKeyHex: string
  terraAddress: string
}

export function normalizePrivateKey(input: string): string {
  return input.trim().replace(/^0x/i, '').replace(/\s+/g, '')
}

export function validatePrivateKey(
  input: string
): ValidatedPrivateKey {
  const privateKeyHex = normalizePrivateKey(input)

  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error('Private key must be 64 hexadecimal characters.')
  }

  try {
    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex')
    const rawKey = new RawKey(privateKeyBytes)
    const publicKeyHex = derivePublicKeyHex(privateKeyHex)

    return {
      privateKeyHex: privateKeyHex.toLowerCase(),
      publicKeyHex,
      terraAddress: rawKey.accAddress,
    }
  } catch {
    throw new Error('Invalid secp256k1 private key.')
  }
}
