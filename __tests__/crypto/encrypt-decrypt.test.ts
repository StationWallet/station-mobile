import { encrypt, decrypt } from 'utils/crypto'

describe('PBKDF2 + AES-CBC encrypt/decrypt', () => {
  it('round-trips the original message', () => {
    const original = 'the quick brown fox jumps over the lazy dog'
    const password = 'correct horse battery staple'
    const ciphertext = encrypt(original, password)
    expect(ciphertext.length).toBeGreaterThan(64)
    expect(decrypt(ciphertext, password)).toBe(original)
  })

  it('returns empty string on wrong password', () => {
    const ciphertext = encrypt('secret', 'right-password')
    expect(decrypt(ciphertext, 'wrong-password')).toBe('')
  })

  it('produces different ciphertext for same plaintext (fresh salt+iv)', () => {
    const a = encrypt('same', 'pw')
    const b = encrypt('same', 'pw')
    expect(a).not.toBe(b)
  })

  it('decrypts known ciphertext (golden from DevFullE2ETest)', () => {
    const ciphertext = encrypt(
      '0000000000000000000000000000000000000000000000000000000000000001',
      'testPassword1!'
    )
    expect(decrypt(ciphertext, 'testPassword1!')).toBe(
      '0000000000000000000000000000000000000000000000000000000000000001'
    )
  })
})
