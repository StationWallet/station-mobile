import {
  deriveChainKey,
  deriveMasterKeys,
  SEED_IMPORT_DERIVATION_GROUPS,
  validateSeedPhrase,
} from 'services/seedPhraseImport'

const TREZOR_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('seed phrase import derivation', () => {
  it('validates BIP39 mnemonics', () => {
    expect(validateSeedPhrase(TREZOR_12)).toBe(true)
    expect(validateSeedPhrase(TREZOR_12.replace(/about$/, 'abandon'))).toBe(
      false
    )
  })

  it('derives Vultisig-compatible root keys from the Trezor vector', () => {
    const keys = deriveMasterKeys(TREZOR_12)
    expect(keys.ecdsaPrivateKey).toBe(
      '1837c1be8e2995ec11cda2b066151be2cfb48adf9e47b151d46adab3a21cdf67'
    )
    expect(keys.ecdsaChainCode).toBe(
      '7923408dadd3c7b56eed15567707ae5e5dca089de972e07f3b860450e2a3b70e'
    )
    expect(keys.eddsaPrivateKey).toBe(
      '1f303fc1a855ef1f4f26907b6c8f948fb4c29777bfdac547fd1b48df39714405'
    )
  })

  it("derives Terra at m/44'/330'/0'/0/0", () => {
    const key = deriveChainKey(TREZOR_12, 'Terra')
    expect(key.isEddsa).toBe(false)
    expect(key.privateKey).toBe(
      '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10'
    )
    expect(key.chainCode).toBe(
      'ae72963c7ca2245c53899c93b2e1a1ff4f08fe6e9a6071a31c30d798f1a1ac8f'
    )
  })

  it('imports each Vultisig-supported seed chain as its own batch chain', () => {
    expect(SEED_IMPORT_DERIVATION_GROUPS).toHaveLength(36)
    expect(
      SEED_IMPORT_DERIVATION_GROUPS.every(
        (group) =>
          group.chains.length === 1 &&
          group.chains[0] === group.representativeChain
      )
    ).toBe(true)
    expect(
      SEED_IMPORT_DERIVATION_GROUPS.map(
        (group) => group.representativeChain
      )
    ).toEqual(
      expect.arrayContaining([
        'Bitcoin',
        'Ethereum',
        'BSC',
        'THORChain',
        'MayaChain',
        'Terra',
        'TerraClassic',
        'Solana',
        'Sui',
        'Ton',
        'Polkadot',
        'Bittensor',
        'Ripple',
        'Tron',
      ])
    )
    expect(
      SEED_IMPORT_DERIVATION_GROUPS.filter((group) => group.isEddsa).map(
        (group) => group.representativeChain
      )
    ).toEqual(['Solana', 'Sui', 'Ton', 'Polkadot', 'Bittensor'])
  })
})
