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

function buildStampedAuthData(authData: string): string {
  const parsed = JSON.parse(authData)
  return JSON.stringify({
    ...parsed,
    TestWallet1: {
      ...parsed.TestWallet1,
      airdropBucket: 'station_migration',
      airdropRegistrationSource: 'seed',
    },
    TestWallet2: {
      ...parsed.TestWallet2,
      airdropBucket: 'station_migration',
      airdropRegistrationSource: 'seed',
    },
  })
}

function buildLedgerOnlyAuthData(): string {
  return JSON.stringify({
    TestLedgerWallet: {
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    },
  })
}

function buildPreStampedAuthData(): string {
  return JSON.stringify({
    TestWallet1: {
      ledger: false,
      address: 'terra1test000e2e000wallet001',
      password: 'testPassword1!',
      encryptedKey: encrypt(PK1, 'testPassword1!'),
      airdropBucket: 'campaign_new',
      airdropRegistrationSource: 'vault_share',
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
  it('seeds, migrates, and stamps airdrop metadata', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, authData)
    expect(await LegacyKeystore.readLegacy(KeystoreEnum.AuthData)).toBe(authData)

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(
      buildStampedAuthData(authData)
    )
  })

  it('cleans up legacy data after successful migration', async () => {
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, buildAuthData())
    await migrateLegacyKeystore()
    const legacyAfter = await LegacyKeystore.readLegacy(KeystoreEnum.AuthData)
    expect(legacyAfter === null || legacyAfter === '').toBe(true)
  })

  it('is idempotent on second run', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, authData)
    await migrateLegacyKeystore()
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(
      buildStampedAuthData(authData)
    )
  })

  it('sets the legacyKeystoreMigrated preference flag', async () => {
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, buildAuthData())
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(true)
  })

  it('decrypts migrated wallet keys with their passwords', async () => {
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, buildAuthData())
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
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, buildAuthData())
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

  it('preserves ledger-only legacy data without stamping buckets', async () => {
    const authData = buildLedgerOnlyAuthData()
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, authData)

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('preserves pre-stamped airdrop metadata', async () => {
    const authData = buildPreStampedAuthData()
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, authData)

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('does not migrate malformed legacy entries', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    await LegacyKeystore.seedLegacyTestData(
      KeystoreEnum.AuthData,
      JSON.stringify({ BrokenWallet: 'not-an-object' })
    )

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe('')
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(false)
    consoleSpy.mockRestore()
  })

  it('derives expected secp256k1 public key from decrypted wallet 1', async () => {
    await LegacyKeystore.seedLegacyTestData(KeystoreEnum.AuthData, buildAuthData())
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
