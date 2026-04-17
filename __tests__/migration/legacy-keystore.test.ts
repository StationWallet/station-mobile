import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'

import LegacyKeystore, {
  __reset as resetLegacy,
} from '../__mocks__/legacy-keystore'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

import { migrateLegacyKeystore } from 'utils/legacyMigration'
import { encrypt, decrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'

const PK1 =
  '0000000000000000000000000000000000000000000000000000000000000001'
const PK2 =
  '0000000000000000000000000000000000000000000000000000000000000002'
const EXPECTED_PUB1 =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

function buildAuthData(): string {
  return JSON.stringify({
    TestWallet1: {
      ledger: false,
      address: 'terra1test000e2e000wallet001',
      password: 'testPassword1!',
      encryptedKey: encrypt(PK1, 'testPassword1!'),
    },
    TestWallet2: {
      ledger: false,
      address: 'terra1test000e2e000wallet002',
      password: 'testPassword2!',
      encryptedKey: encrypt(PK2, 'testPassword2!'),
    },
    TestLedgerWallet: {
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    },
  })
}

// resetSecure() also wipes preferences state — the production
// `nativeModules/preferences` writes into `expo-secure-store`, and
// babel-plugin-module-resolver rewrites the `nativeModules/*` alias
// before jest moduleNameMapper runs, so the preferences mock is unused.
beforeEach(() => {
  resetLegacy()
  resetSecure()
})

describe('migrateLegacyKeystore', () => {
  it('seeds, migrates, and reads back identical bytes', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData('AD', authData)
    expect(await LegacyKeystore.readLegacy('AD')).toBe(authData)

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('cleans up legacy data after successful migration', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const legacyAfter = await LegacyKeystore.readLegacy('AD')
    expect(legacyAfter === null || legacyAfter === '').toBe(true)
  })

  it('is idempotent on second run', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData('AD', authData)
    await migrateLegacyKeystore()
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('sets the legacyKeystoreMigrated preference flag', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(true)
  })

  it('decrypts migrated wallet keys with their passwords', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(
      await keystore.read(KeystoreEnum.AuthData)
    )
    expect(
      decrypt(parsed.TestWallet1.encryptedKey, 'testPassword1!')
    ).toBe(PK1)
    expect(
      decrypt(parsed.TestWallet2.encryptedKey, 'testPassword2!')
    ).toBe(PK2)
  })

  it('preserves Ledger wallet structure through migration', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(
      await keystore.read(KeystoreEnum.AuthData)
    )
    expect(parsed.TestLedgerWallet).toEqual({
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    })
  })

  it('derives expected secp256k1 public key from decrypted wallet 1', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(
      await keystore.read(KeystoreEnum.AuthData)
    )
    const pk = decrypt(
      parsed.TestWallet1.encryptedKey,
      'testPassword1!'
    )
    const pub = hex.encode(
      secp256k1.getPublicKey(hex.decode(pk), true)
    )
    expect(pub).toBe(EXPECTED_PUB1)
  })

  it('is a no-op when no legacy data exists', async () => {
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe('')
  })
})
