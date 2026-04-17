// Metro intercepts `@terra-money/terra.js` → polyfills/terra.js and `crypto`
// → polyfills/crypto.js (see metro.config.js). Importing from the polyfills
// here tests the exact code that ships to users.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  MnemonicKey,
  RawKey,
  AccAddress,
  ValAddress,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('../../polyfills/terra')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('../../polyfills/crypto')

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
const PRIVKEY_1 =
  '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10'

describe('Crypto parity goldens (ported from e2e/crypto-parity.test.js)', () => {
  describe('MnemonicKey — mnemonic 1', () => {
    const mk330 = new MnemonicKey({
      mnemonic: MNEMONIC_1,
      coinType: 330,
    })
    const mk118 = new MnemonicKey({
      mnemonic: MNEMONIC_1,
      coinType: 118,
    })

    it('mk330-address matches golden value', () => {
      expect(mk330.accAddress).toBe(
        'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'
      )
    })

    it('mk330-privkey matches golden value', () => {
      expect(mk330.privateKey.toString('hex')).toBe(
        '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10'
      )
    })

    it('mk330-pubkey matches golden value', () => {
      expect(mk330.publicKey.key).toBe(
        'Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE'
      )
    })

    it('mk118-address matches golden value', () => {
      expect(mk118.accAddress).toBe(
        'terra19rl4cm2hmr8afy4kldpxz3fka4jguq0a6yhaa4'
      )
    })

    it('mk118-privkey matches golden value', () => {
      expect(mk118.privateKey.toString('hex')).toBe(
        'c4a48e2fce1481cd3294b4490f6678090ea98d3d0e5cd984558ab0968741b104'
      )
    })

    it('mk118-pubkey matches golden value', () => {
      expect(mk118.publicKey.key).toBe(
        'Ak9OKtmcNNYLm6YoPJQxqEGK+GcyEpYfl6d7Y3f80Fti'
      )
    })
  })

  describe('MnemonicKey — mnemonic 2', () => {
    const mk2_330 = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 330,
    })
    const mk2_118 = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 118,
    })
    const mk2_custom = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 330,
      account: 1,
      index: 2,
    })

    it('mk2-330-address matches golden value', () => {
      expect(mk2_330.accAddress).toBe(
        'terra1whertfa9u8a8676cryt0prqdnhwkcj5tu9qsq8'
      )
    })

    it('mk2-330-privkey matches golden value', () => {
      expect(mk2_330.privateKey.toString('hex')).toBe(
        '87dcd8210f184ade53a1a57c5cd06fc65cdaca53bfed239cd7b5dea4c126dfec'
      )
    })

    it('mk2-118-address matches golden value', () => {
      expect(mk2_118.accAddress).toBe(
        'terra1am058pdux3hyulcmfgj4m3hhrlfn8nzmprx8dq'
      )
    })

    it('mk2-custom-address matches golden value', () => {
      expect(mk2_custom.accAddress).toBe(
        'terra169d7v4jaxppvpvtdl4e992m9pcshkhcjmr9tqp'
      )
    })

    it('mk2-custom-privkey matches golden value', () => {
      expect(mk2_custom.privateKey.toString('hex')).toBe(
        '07f1252907bc12a95f76ec90cbd94707c466adac141338e389c7e4533ced108f'
      )
    })
  })

  describe('RawKey', () => {
    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'))

    it('rawkey-address matches golden value', () => {
      expect(rk.accAddress).toBe(
        'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'
      )
    })

    it('rawkey-pubkey matches golden value', () => {
      expect(rk.publicKey.key).toBe(
        'Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE'
      )
    })

    it('sign-payload is a 128-char hex ECDSA signature', () => {
      const sig = rk.ecdsaSign(Buffer.from('test message to sign'))
      const hex = Buffer.from(sig.signature).toString('hex')
      expect(hex).toMatch(/^[0-9a-f]{128}$/)
    })

    it('ecdsa-recid is 0', () => {
      const sig = rk.ecdsaSign(Buffer.from('test message to sign'))
      expect(String(sig.recid)).toBe('0')
    })
  })

  describe('AccAddress / ValAddress validation', () => {
    it('validate-valid returns true for valid terra address', () => {
      expect(
        AccAddress.validate(
          'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'
        )
      ).toBe(true)
    })

    it('validate-invalid returns false for a malformed string', () => {
      expect(AccAddress.validate('notanaddress')).toBe(false)
    })

    it('validate-wrong-prefix returns false for non-terra prefix', () => {
      expect(
        AccAddress.validate(
          'cosmos1amdttz2937a3dytmxmkany53pp6ma6dyzr7hkl'
        )
      ).toBe(false)
    })

    it('valaddress-valid returns true for a valoper address', () => {
      const mk = new MnemonicKey({
        mnemonic: MNEMONIC_1,
        coinType: 330,
      })
      expect(ValAddress.validate(mk.valAddress)).toBe(true)
    })

    it('fromval converts valoper → acc address', () => {
      const mk = new MnemonicKey({
        mnemonic: MNEMONIC_1,
        coinType: 330,
      })
      expect(AccAddress.fromValAddress(mk.valAddress)).toBe(
        'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'
      )
    })
  })

  describe('MnemonicKey generation', () => {
    it('gen-wordcount is 24', () => {
      const mk = new MnemonicKey()
      expect(mk.mnemonic.split(' ').length).toBe(24)
    })

    it('gen-has-address returns true (address starts with terra)', () => {
      const mk = new MnemonicKey()
      expect(mk.accAddress.startsWith('terra')).toBe(true)
    })

    it('gen-privkey-length is 32', () => {
      const mk = new MnemonicKey()
      expect(mk.privateKey.length).toBe(32)
    })
  })

  describe('Hashing ("hello world")', () => {
    it('hash-sha256 matches golden', () => {
      expect(
        crypto
          .createHash('sha256')
          .update('hello world')
          .digest('hex')
      ).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      )
    })

    it('hash-sha512 matches golden', () => {
      expect(
        crypto
          .createHash('sha512')
          .update('hello world')
          .digest('hex')
      ).toBe(
        '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f'
      )
    })

    it('hash-ripemd160 matches golden', () => {
      expect(
        crypto
          .createHash('ripemd160')
          .update('hello world')
          .digest('hex')
      ).toBe('98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f')
    })

    it('hmac-sha256 matches golden (key="secret-key")', () => {
      expect(
        crypto
          .createHmac('sha256', 'secret-key')
          .update('hello world')
          .digest('hex')
      ).toBe(
        '095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67'
      )
    })

    it('hash-unsupported-throws is true for md5', () => {
      let threw = false
      try {
        crypto.createHash('md5')
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
    })
  })

  describe('randomBytes', () => {
    it('random-not-zero is true (not all-zero buffer)', () => {
      const rb = crypto.randomBytes(32)
      expect(rb.every((b: number) => b === 0)).toBe(false)
    })

    it('random-length is 32', () => {
      const rb = crypto.randomBytes(32)
      expect(rb.length).toBe(32)
    })

    it('random-unique — two calls differ', () => {
      const a = crypto.randomBytes(32)
      const b = crypto.randomBytes(32)
      expect(a.equals(b)).toBe(false)
    })
  })
})
