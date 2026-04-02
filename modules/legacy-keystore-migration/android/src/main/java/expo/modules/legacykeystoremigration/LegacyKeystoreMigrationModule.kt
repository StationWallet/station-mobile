package expo.modules.legacykeystoremigration

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine

open class LegacyKeystoreMigrationModule : Module() {
  private val prefsName = "SecureStorage"
  private val tag = "LegacyKeystoreMigration"

  // The old StorageCipher18 format stored keys with this prefix.
  // If data exists under this prefix but NOT under the plain key in
  // EncryptedSharedPreferences, it means migratePreferences() never ran
  // on the old app and we cannot silently decrypt (RSA+AES is complex).
  // We detect this and log a critical warning.
  private val storageCipher18Prefix = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg"

  private val reactContext: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LegacyKeystoreMigration")

    AsyncFunction("readLegacy") Coroutine { key: String ->
      // First try EncryptedSharedPreferences (modern format)
      val prefs = openLegacyPrefs()
      if (prefs != null) {
        val value = prefs.getString(key, null)
        if (value != null) return@Coroutine value
      }

      // If not found, check for un-migrated StorageCipher18 data
      val oldPrefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      val prefixedKey = "${storageCipher18Prefix}_${key}"
      if (oldPrefs.getString(prefixedKey, null) != null) {
        Log.e(tag, "CRITICAL: Found wallet data in old StorageCipher18 format " +
          "(key=$prefixedKey) that was never migrated to EncryptedSharedPreferences. " +
          "This data cannot be read by the new app. The user must install the old " +
          "app version first to trigger migratePreferences(), then upgrade.")
      }

      return@Coroutine null
    }

    AsyncFunction("removeLegacy") Coroutine { key: String ->
      val prefs = openLegacyPrefs() ?: return@Coroutine false
      prefs.edit().remove(key).commit()
      return@Coroutine true
    }

    AsyncFunction("seedLegacyTestData") Coroutine { key: String, value: String ->
      val prefs = openLegacyPrefs() ?: return@Coroutine false
      prefs.edit().putString(key, value).commit()
      return@Coroutine true
    }

    AsyncFunction("clearAllLegacyData") Coroutine { ->
      val prefs = openLegacyPrefs() ?: return@Coroutine false
      prefs.edit().clear().commit()
      return@Coroutine true
    }
  }

  private fun openLegacyPrefs(): SharedPreferences? {
    return try {
      EncryptedSharedPreferences.create(
        prefsName,
        MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
        reactContext,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
      )
    } catch (e: Exception) {
      Log.e(tag, "Failed to open EncryptedSharedPreferences", e)
      null
    }
  }
}
