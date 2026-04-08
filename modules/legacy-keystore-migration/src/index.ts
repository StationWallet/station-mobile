import { requireOptionalNativeModule } from 'expo-modules-core'

interface LegacyKeystoreMigrationModule {
  /**
   * Read a value from the old native keystore.
   * iOS: reads from Keychain (service "_secure_storage_service", account = key),
   *      decrypts AES-256-CBC layer using the stored encryption key.
   * Android: reads from EncryptedSharedPreferences("SecureStorage").
   * Returns the plaintext string, or null if not found.
   */
  readLegacy(key: string): Promise<string | null>

  /**
   * Remove a value from the old native keystore.
   * Call after successful migration to clean up.
   */
  removeLegacy(key: string): Promise<boolean>

  /**
   * TEST ONLY: Write a value into the old native keystore format.
   * iOS: generates an AES key, stores it, AES-encrypts the value, writes to keychain.
   * Android: writes to EncryptedSharedPreferences("SecureStorage").
   * Used by E2E tests to simulate a pre-upgrade app installation.
   */
  seedLegacyTestData(key: string, value: string): Promise<boolean>

  /**
   * TEST ONLY: Remove all legacy keystore data including the AES encryption key.
   */
  clearAllLegacyData(): Promise<boolean>
}

export default requireOptionalNativeModule<LegacyKeystoreMigrationModule>(
  'LegacyKeystoreMigration'
)
