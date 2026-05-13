import {
  createRecoverWalletPayload,
  createRecoverWalletSchemeUrl,
  detectRecoveryPayload as detectRecoveryDeeplink,
} from 'utils/qrCode'

describe('ImportPrivateKey — Station recovery deeplink detection', () => {
  const fixture: RecoverWalletSchemeDataType = {
    name: 'fixture-wallet',
    address: 'terra1fixturefixturefixturefixturefixturefixt',
    encrypted_key:
      'a'.repeat(32) + 'b'.repeat(32) + 'ZXhhbXBsZS1jaXBoZXJ0ZXh0',
  }

  it('parses a Station recovery deeplink emitted by the legacy SPA', () => {
    const url = createRecoverWalletSchemeUrl(fixture)
    expect(detectRecoveryDeeplink(url)).toEqual(fixture)
  })

  it('parses the single-slash deeplink variant (terrastation:wallet_recover/...)', () => {
    const url = createRecoverWalletSchemeUrl(fixture).replace(
      'terrastation://',
      'terrastation:'
    )
    expect(detectRecoveryDeeplink(url)).toEqual(fixture)
  })

  it('returns null for a 64-char hex private key', () => {
    expect(detectRecoveryDeeplink('a'.repeat(64))).toBeNull()
  })

  it('returns null when payload base64 decodes to non-JSON', () => {
    const url = 'terrastation://wallet_recover/?payload=Zm9v' // base64("foo")
    expect(detectRecoveryDeeplink(url)).toBeNull()
  })

  it('returns null when payload JSON is missing required keys', () => {
    const url =
      'terrastation://wallet_recover/?payload=' +
      Buffer.from(JSON.stringify({ name: 'x' })).toString('base64')
    expect(detectRecoveryDeeplink(url)).toBeNull()
  })

  it('returns null for non-deeplink garbage', () => {
    expect(detectRecoveryDeeplink('not a key')).toBeNull()
    expect(detectRecoveryDeeplink('')).toBeNull()
    expect(detectRecoveryDeeplink('   ')).toBeNull()
  })

  describe('bare base64 payload (no terrastation:// prefix)', () => {
    it('parses a payload pasted without the scheme prefix', () => {
      const payload = createRecoverWalletPayload(fixture)
      expect(detectRecoveryDeeplink(payload)).toEqual(fixture)
    })

    it('parses a SPA-shaped payload with the realistic blob length', () => {
      // Mirrors the bare-base64 paste path reported in the field: users
      // sometimes copy just the payload portion from the legacy SPA's
      // "Export wallet" output, not the full terrastation:// URL.
      //
      // Build a synthetic payload that matches the SPA's encrypt() output
      // length (32 hex salt + 32 hex iv + 108-char base64 ciphertext) so
      // we exercise the same parsing path as a real export, without
      // checking any real address or ciphertext into the repo.
      const syntheticPayload = createRecoverWalletPayload({
        name: 'fixture-wallet',
        address: 'terra1fixturefixturefixturefixturefixturefixt',
        encrypted_key:
          '0'.repeat(32) +
          '1'.repeat(32) +
          'AAAA'.repeat(27), // 108 chars, base64-shaped
      })
      const result = detectRecoveryDeeplink(syntheticPayload)
      expect(result).not.toBeNull()
      expect(result?.name).toBe('fixture-wallet')
      expect(result?.encrypted_key.length).toBeGreaterThan(64)
    })

    it('does NOT mistake a 64-char hex private key for a payload', () => {
      // Hex private keys are 64 chars of [0-9a-fA-F]. They satisfy the
      // base64 charset (no `=` padding, no `+`/`/`), so the pre-filter has
      // to let them through; the JSON-parse + shape-check is what rejects.
      const hexKey = 'a'.repeat(64)
      expect(detectRecoveryDeeplink(hexKey)).toBeNull()
      const realisticHex =
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
      expect(detectRecoveryDeeplink(realisticHex)).toBeNull()
    })

    it('does NOT touch obvious non-base64 text (mnemonic, sentence)', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      expect(detectRecoveryDeeplink(mnemonic)).toBeNull()
      expect(detectRecoveryDeeplink('hello world')).toBeNull()
    })

    it('rejects short base64-shaped strings (under floor)', () => {
      // The pre-filter requires >= 16 chars to bother decoding.
      expect(detectRecoveryDeeplink('Zm9v')).toBeNull()
    })

    it('rejects base64 of valid JSON missing required keys', () => {
      const partial = Buffer.from(
        JSON.stringify({ name: 'x', address: 'y' })
      ).toString('base64')
      expect(detectRecoveryDeeplink(partial)).toBeNull()
    })
  })
})
