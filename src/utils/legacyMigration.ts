import * as SecureStore from 'expo-secure-store'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'
import { LEGACY_ACCOUNT, keychainOpts } from 'nativeModules/keystore'

/**
 * Migrate wallet data from the old native Keystore module to expo-secure-store.
 *
 * This runs once on first launch after upgrade. It reads from:
 *   iOS:     Keychain (service "_secure_storage_service", AES-256-CBC encrypted)
 *   Android: EncryptedSharedPreferences("SecureStorage")
 *
 * And writes to:
 *   expo-secure-store (keychainService "app.keystore-AD", account "keystore")
 *
 * The function is idempotent — if migration was already performed or there is
 * no legacy data, it returns immediately.
 */
export async function migrateLegacyKeystore(): Promise<void> {
  // Check if already migrated
  const alreadyDone = await preferences.getBool(
    PreferencesEnum.legacyKeystoreMigrated
  )
  if (alreadyDone) return

  try {
    // Check if new-format data already exists (user already on new app)
    const existingNewData = await SecureStore.getItemAsync(
      LEGACY_ACCOUNT,
      keychainOpts('AD')
    )
    if (existingNewData) {
      // Data already in new format — mark done and return
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated, true
      )
      return
    }

    // Native module unavailable (e.g. running in Expo Go) — skip migration
    if (!LegacyKeystore) {
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated, true
      )
      return
    }

    // Attempt to read from old native keystore
    let timer: ReturnType<typeof setTimeout>
    const legacyData = await Promise.race([
      LegacyKeystore.readLegacy('AD'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Legacy keystore read timed out after 10s')), 10_000)
      }),
    ]).finally(() => clearTimeout(timer!))
    if (legacyData) {
      // Validate it's parseable JSON before writing
      JSON.parse(legacyData)

      // Write to new expo-secure-store location
      await SecureStore.setItemAsync(LEGACY_ACCOUNT, legacyData, keychainOpts('AD'))

      // Clean up old data only after successful write
      await LegacyKeystore.removeLegacy('AD')
    }
  } catch (error) {
    // Log but don't crash — the old data is still intact if migration failed
    console.error('Legacy keystore migration error:', error)
    // Don't mark as done so we retry next launch
    return
  }

  await preferences.setBool(
    PreferencesEnum.legacyKeystoreMigrated, true
  )
}
