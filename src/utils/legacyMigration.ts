import * as SecureStore from 'expo-secure-store'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

// These must match the constants in src/nativeModules/keystore.ts
const LEGACY_SERVICE_PREFIX = 'app.keystore'
const LEGACY_ACCOUNT = 'keystore'

function keychainOpts(key: string): SecureStore.SecureStoreOptions {
  return { keychainService: `${LEGACY_SERVICE_PREFIX}-${key}` }
}

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
  const alreadyDone = await preferences.getString(
    PreferencesEnum.legacyKeystoreMigrated
  )
  if (alreadyDone === 'true') return

  try {
    // Check if new-format data already exists (user already on new app)
    const existingNewData = await SecureStore.getItemAsync(
      LEGACY_ACCOUNT,
      keychainOpts('AD')
    )
    if (existingNewData) {
      // Data already in new format — mark done and return
      await preferences.setString(
        PreferencesEnum.legacyKeystoreMigrated, 'true'
      )
      return
    }

    // Attempt to read from old native keystore
    const legacyData = await LegacyKeystore.readLegacy('AD')

    if (legacyData) {
      // Validate it's parseable JSON before writing
      JSON.parse(legacyData)

      // Write to new expo-secure-store location
      await SecureStore.setItemAsync(LEGACY_ACCOUNT, legacyData, keychainOpts('AD'))

      // Verify the write succeeded
      const verification = await SecureStore.getItemAsync(
        LEGACY_ACCOUNT,
        keychainOpts('AD')
      )
      if (verification !== legacyData) {
        throw new Error('Migration verification failed: written data does not match')
      }

      // Clean up old data only after verified write
      await LegacyKeystore.removeLegacy('AD')
    }
  } catch (error) {
    // Log but don't crash — the old data is still intact if migration failed
    console.error('Legacy keystore migration error:', error)
    // Don't mark as done so we retry next launch
    return
  }

  await preferences.setString(
    PreferencesEnum.legacyKeystoreMigrated, 'true'
  )
}
