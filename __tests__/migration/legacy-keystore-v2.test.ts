/**
 * V2 retry flag tests for migrateLegacyKeystore().
 *
 * The V2 retry exists because v5.0.x users have `legacyKeystoreMigrated`
 * (V1) already set to true even though the native side either gave up
 * (Android StorageCipher18 detect-only) or was blocked by the missing iOS
 * keychain-access-groups entitlement. The V2 flag forces those users to
 * run the migration ONE more time on the fixed build.
 *
 * See `.spikes/station-mobile-old-storage-paths-2026-05-08.md`.
 */

import LegacyKeystore, {
  __reset as resetLegacy,
} from '../__mocks__/legacy-keystore'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

import { migrateLegacyKeystore } from 'utils/legacyMigration'
import { encrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'

const PK1 =
  '0000000000000000000000000000000000000000000000000000000000000001'

function buildAuthData(): string {
  return JSON.stringify({
    TestWallet1: {
      ledger: false,
      address: 'terra1test000e2e000wallet001',
      password: 'testPassword1!',
      encryptedKey: encrypt(PK1, 'testPassword1!'),
    },
  })
}

beforeEach(() => {
  resetLegacy()
  resetSecure()
})

describe('migrateLegacyKeystore — V2 retry flag', () => {
  it('skips migration when V2 flag is already true', async () => {
    await preferences.setBool(
      PreferencesEnum.legacyKeystoreMigratedV2,
      true
    )
    // Seed legacy data — it must NOT be migrated because V2 says we're done.
    await LegacyKeystore.seedLegacyTestData(
      KeystoreEnum.AuthData,
      buildAuthData()
    )
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe('')
  })

  it('runs migration when V1 is true but V2 is false (the v5.0.x retry cohort)', async () => {
    // Simulate a user who ran v5.0.x: V1 already true (the bad build set it
    // even though it couldn't actually decrypt), V2 still false.
    await preferences.setBool(
      PreferencesEnum.legacyKeystoreMigrated,
      true
    )
    await preferences.setBool(
      PreferencesEnum.legacyKeystoreMigratedV2,
      false
    )

    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData(
      KeystoreEnum.AuthData,
      authData
    )

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('also retries the StorageCipher18 (V1 RSA+AES) path when V2 is false', async () => {
    // Same v5.0.x cohort, but the seeded data is in the deprecated
    // StorageCipher18 location — exactly the format v5.0.x detected
    // and gave up on. The new code should now recover it.
    await preferences.setBool(
      PreferencesEnum.legacyKeystoreMigrated,
      true
    )
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestDataStorageCipher18(
      KeystoreEnum.AuthData,
      authData
    )

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('sets BOTH V1 and V2 flags to true on successful run', async () => {
    await LegacyKeystore.seedLegacyTestData(
      KeystoreEnum.AuthData,
      buildAuthData()
    )
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(true)
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigratedV2
      )
    ).toBe(true)
  })

  it('sets BOTH V1 and V2 flags to true even when no legacy data is found', async () => {
    // No seed → no data → migration is a no-op, but the flags must still
    // be set so we don't re-run on every launch forever.
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(true)
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigratedV2
      )
    ).toBe(true)
  })

  it('does NOT set V2 to true when migration throws — retry on next launch', async () => {
    // Seed corrupt JSON so the migration throws inside JSON.parse. The
    // legacy data itself stays intact (the function catches and returns
    // before remove/cleanup) and V2 remains false so we retry next launch.
    await LegacyKeystore.seedLegacyTestData(
      KeystoreEnum.AuthData,
      'not-valid-json{'
    )
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigratedV2
      )
    ).toBe(false)
  })

  it('does NOT set V2 to true when LegacyKeystore native module is null — retry on next launch', async () => {
    // Reproduces the iOS / OTA failure mode where
    // `requireOptionalNativeModule('LegacyKeystoreMigration')` returns
    // null at runtime (Pods not installed, OTA bundle ahead of binary,
    // transient load failure). The previous behavior was to silently
    // set V2=true and lock the user out forever — surfaced in the spike
    // at `.spikes/station-mobile-old-storage-paths-2026-05-08.md` as one
    // of the "missing vault" failure modes.
    jest.isolateModules(() => {
      jest.doMock(
        '../../modules/legacy-keystore-migration/src',
        () => ({
          __esModule: true,
          default: null,
        })
      )
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional dynamic import inside isolateModules
      const {
        migrateLegacyKeystore: m,
      } = require('utils/legacyMigration')
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {})
      return m().then(async () => {
        expect(
          await preferences.getBool(
            PreferencesEnum.legacyKeystoreMigratedV2
          )
        ).toBe(false)
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'LegacyKeystore native module unavailable'
          )
        )
        consoleSpy.mockRestore()
      })
    })
  })

  it('marks V2 done immediately if new-format data already exists', async () => {
    // User who already finished migration in a previous (working) flow:
    // we should detect new-format data, mark both flags, and exit.
    await keystore.write(KeystoreEnum.AuthData, buildAuthData())
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigrated
      )
    ).toBe(true)
    expect(
      await preferences.getBool(
        PreferencesEnum.legacyKeystoreMigratedV2
      )
    ).toBe(true)
  })
})
