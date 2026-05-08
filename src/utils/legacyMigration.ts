import * as SecureStore from 'expo-secure-store'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import { LEGACY_ACCOUNT, keychainOpts } from 'nativeModules/keystore'

/**
 * Migrate wallet data from the old native Keystore module to expo-secure-store.
 *
 * This runs once on first launch after upgrade. It reads from:
 *   iOS:     Keychain (service "_secure_storage_service", AES-256-CBC encrypted)
 *   Android: EncryptedSharedPreferences("SecureStorage"), with fallback to the
 *            deprecated StorageCipher18 RSA+AES format for the pre-2021-07-22
 *            cohort that v5.0.x could only detect, never decrypt.
 *
 * And writes to:
 *   expo-secure-store (keychainService "app.keystore-AD", account "keystore")
 *
 * Idempotency is governed by `legacyKeystoreMigratedV2`. The older
 * `legacyKeystoreMigrated` (V1) flag is still respected for telemetry, but
 * any user whose V2 flag is unset will run the migration AGAIN — this lets
 * the post-fix build retry on devices that previously ran v5.0.x and got the
 * detect-only-then-give-up branch on Android (and the missing-entitlement
 * branch on iOS). See `.spikes/station-mobile-old-storage-paths-2026-05-08.md`.
 */
export async function migrateLegacyKeystore(): Promise<void> {
  const v2Done = await preferences.getBool(
    PreferencesEnum.legacyKeystoreMigratedV2
  )
  if (v2Done) return

  try {
    // Check if new-format data already exists (user already on new app).
    const existingNewData = await SecureStore.getItemAsync(
      LEGACY_ACCOUNT,
      keychainOpts('AD')
    )
    if (existingNewData) {
      // Data already in new format — mark both flags done and return.
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated,
        true
      )
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigratedV2,
        true
      )
      return
    }

    // Native module unavailable. Possible causes: running in Expo Go, an
    // OTA bundle referring to a module not in the underlying binary, or a
    // transient load failure. Do NOT set V2 here — leaving it false means
    // the migration retries on next launch once the module becomes
    // reachable. Setting V2=true here would silently lock affected users
    // out forever (this is one of the "missing vault" failure modes
    // surfaced in `.spikes/station-mobile-old-storage-paths-2026-05-08.md`).
    if (!LegacyKeystore) {
      // eslint-disable-next-line no-console -- diagnostic for missing module
      console.warn(
        '[legacyMigration] LegacyKeystore native module unavailable; ' +
          'leaving V2 flag false to retry on next launch'
      )
      return
    }

    // Attempt to read from old native keystore.
    let timer: ReturnType<typeof setTimeout>
    const legacyData = await Promise.race([
      LegacyKeystore.readLegacy('AD'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Legacy keystore read timed out after 10s')
            ),
          10_000
        )
      }),
    ]).finally(() => clearTimeout(timer!))
    if (legacyData) {
      // Validate it's parseable JSON before writing.
      JSON.parse(legacyData)

      // Write to new expo-secure-store location.
      await SecureStore.setItemAsync(
        LEGACY_ACCOUNT,
        legacyData,
        keychainOpts('AD')
      )

      // Mark that we found and migrated actual legacy data.
      await preferences.setBool(PreferencesEnum.legacyDataFound, true)

      // Clean up old data only after successful write.
      await LegacyKeystore.removeLegacy('AD')
    }
  } catch (error) {
    // Log but don't crash — the old data is still intact if migration failed.
    // Importantly: do NOT set the V2 flag, so we retry on next launch.
    // eslint-disable-next-line no-console -- migration failure must be logged for debugging
    console.error('Legacy keystore migration error:', error)
    return
  }

  // Both flags now true — migration completed (with or without finding data).
  await preferences.setBool(
    PreferencesEnum.legacyKeystoreMigrated,
    true
  )
  await preferences.setBool(
    PreferencesEnum.legacyKeystoreMigratedV2,
    true
  )
}
