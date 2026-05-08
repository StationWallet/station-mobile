import {
  normalizePrivateKey,
  validatePrivateKey,
} from 'services/privateKeyImport'

describe('private key import validation', () => {
  const privateKey =
    '0000000000000000000000000000000000000000000000000000000000000002'

  it('normalizes 0x-prefixed private keys with whitespace', () => {
    expect(
      normalizePrivateKey(
        `  0x${privateKey.slice(0, 32)}  ${privateKey.slice(32)}  `
      )
    ).toBe(privateKey)
  })

  it('derives the Terra address for a valid private key', () => {
    const result = validatePrivateKey(privateKey)

    expect(result.privateKeyHex).toBe(privateKey)
    expect(result.publicKeyHex).toBe(
      '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'
    )
    expect(result.terraAddress).toBe(
      'terra1q6hag67dl53wl99vzg42z8eyzfz2xlkvk8uu5v'
    )
  })

  it('rejects malformed private keys', () => {
    expect(() => validatePrivateKey('not-a-key')).toThrow(
      /64 hexadecimal/i
    )
  })

  it('rejects invalid secp256k1 private keys', () => {
    expect(() => validatePrivateKey('0'.repeat(64))).toThrow(
      /Invalid secp256k1/i
    )
  })
})
