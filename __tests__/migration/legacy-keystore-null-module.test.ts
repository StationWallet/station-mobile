/**
 * Tests for migrateLegacyKeystore() when the LegacyKeystore native module is
 * null at runtime. This covers the iOS/OTA failure mode where
 * `requireOptionalNativeModule('LegacyKeystoreMigration')` returns null
 * (Pods not installed, OTA bundle ahead of binary, transient load failure).
 *
 * The test MUST live in its own file because jest.mock() is file-scoped and
 * hoisted to the top by Babel. A per-test jest.resetModules() approach
 * loses the shared expo-secure-store module instance and makes assertions
 * on a different store than the one the migration code writes to — resulting
 * in a false positive regardless of what the production code does.
 *
 * This file mocks the legacy-keystore module as null at file level, so every
 * test here runs with LegacyKeystore === null (the module returns { default: null }).
 */

// MUST be before any import that resolves the module.
jest.mock('../../modules/legacy-keystore-migration/src', () => ({
  __esModule: true,
  default: null,
}))

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'
import { migrateLegacyKeystore } from 'utils/legacyMigration'

beforeEach(() => {
  resetSecure()
})

describe('migrateLegacyKeystore — null native module', () => {
  it('does NOT set V2 to true when LegacyKeystore module is null — retry on next launch', async () => {
    // Reproduces the iOS / OTA failure mode surfaced in
    // `.spikes/station-mobile-old-storage-paths-2026-05-08.md`. The old
    // behavior was to silently set V2=true and lock the user out forever.
    const consoleSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    const result = await migrateLegacyKeystore()

    expect(result.status).toBe('failed')
    expect(
      await preferences.getBool(PreferencesEnum.legacyKeystoreMigratedV2)
    ).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('LegacyKeystore native module unavailable')
    )

    consoleSpy.mockRestore()
  })

  it('still returns skipped when V2 is already true (idempotent regardless of module state)', async () => {
    await preferences.setBool(
      PreferencesEnum.legacyKeystoreMigratedV2,
      true
    )
    const result = await migrateLegacyKeystore()
    expect(result.status).toBe('skipped')
  })
})
