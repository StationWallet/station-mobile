package expo.modules.legacykeystoremigration

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine

open class LegacyKeystoreMigrationModule : Module() {
  private val prefsName = "SecureStorage"

  private val reactContext: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LegacyKeystoreMigration")

    AsyncFunction("readLegacy") Coroutine { key: String ->
      val prefs = openLegacyPrefs() ?: return@Coroutine null
      return@Coroutine prefs.getString(key, null)
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
      null
    }
  }
}
