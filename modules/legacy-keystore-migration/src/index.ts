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
   * TEST ONLY (Android): Write a value into the deprecated StorageCipher18
   * RSA+AES format — the pre-2021-07-22 cohort whose data the V1 migration
   * could not decrypt. Mirrors the OLD `StorageCipher18Implementation.encrypt`.
   * Returns false on iOS (no equivalent format).
   */
  seedLegacyTestDataStorageCipher18(
    key: string,
    value: string
  ): Promise<boolean>

  /**
   * Remove the RSA+AES material left behind by the StorageCipher18 path after
   * a confirmed V2 migration. Wipes the Android Keystore alias, the wrapped AES
   * key in SecureKeyStorage, and the ciphertext entries in SecureStorage.
   *
   * Idempotent — safe to call multiple times (no-op if already cleaned).
   * Android only; no-op (returns true) on iOS since the format never existed there.
   *
   * MUST only be called after legacyKeystoreMigratedV2 has been confirmed true.
   */
  cleanupStorageCipher18(): Promise<boolean>

  /**
   * TEST ONLY: Remove all legacy keystore data including the AES encryption key.
   */
  clearAllLegacyData(): Promise<boolean>
}

export default requireOptionalNativeModule<LegacyKeystoreMigrationModule>(
  'LegacyKeystoreMigration'
)
