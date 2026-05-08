package expo.modules.legacykeystoremigration

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import java.math.BigInteger
import java.security.Key
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.util.Calendar
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.security.auth.x500.X500Principal

open class LegacyKeystoreMigrationModule : Module() {
  // Layer #8 — modern EncryptedSharedPreferences (post-2021-07-22 cohort).
  private val prefsName = "SecureStorage"
  // Layer #10 — RSA-wrapped AES key for the legacy StorageCipher18 format.
  private val secureKeyPrefsName = "SecureKeyStorage"

  // Constant SharedPreferences key under which the OLD app stored the
  // RSA-wrapped AES-128 key. From `terra-money/station-mobile@a06fc67`,
  // file `KeystoreLib/StorageCipher18Implementation.java:24`.
  private val aesPreferencesKey =
    "VGhpcyBpcyB0aGUga2V5IGZvciBhIHNlY3VyZSBzdG9yYWdlIEFFUyBLZXkK"

  // The OLD app stored every value under this prefix in SharedPreferences("SecureStorage").
  // From `KeystoreLib/Keystore.java:25`.
  private val storageCipher18Prefix =
    "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg"

  private val tag = "LegacyKeystoreMigration"
  private val ivSize = 16
  private val aesKeySize = 16 // AES-128, matches OLD `keySize = 16`
  private val androidKeyStore = "AndroidKeyStore"

  // Per-device alias: `${packageName}.SecureStoragePluginKey`. From
  // `KeystoreLib/RSACipher18Implementation.java:34-35`. Same applicationId
  // across OLD/NEW (`money.terra.station`) → the alias survives upgrade.
  private val rsaKeyAlias: String
    get() = "${reactContext.packageName}.SecureStoragePluginKey"

  private val reactContext: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LegacyKeystoreMigration")

    AsyncFunction("readLegacy") Coroutine { key: String ->
      // 1. Try modern EncryptedSharedPreferences first.
      val prefs = openLegacyPrefs()
        ?: throw Exception(
          "Failed to open legacy EncryptedSharedPreferences — Android Keystore may be " +
          "unavailable (backup/restore or key rotation). Migration will retry on next launch."
        )
      val modernValue = prefs.getString(key, null)
      if (modernValue != null) return@Coroutine modernValue

      // 2. Fall back to the deprecated StorageCipher18 RSA+AES format.
      val recovered = decryptStorageCipher18(key)
      if (recovered != null) {
        Log.i(
          tag,
          "Recovered '$key' from deprecated StorageCipher18 RSA+AES format. " +
            "Will be re-encrypted under the modern key on next write."
        )
        return@Coroutine recovered
      }

      // 3. Diagnostic — distinguish "no data" from "data present but unrecoverable".
      val oldPrefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      if (oldPrefs.getString(addStorageCipher18Prefix(key), null) != null) {
        Log.e(
          tag,
          "Found StorageCipher18 blob for '$key' but RSA unwrap failed — " +
            "Android Keystore alias likely wiped (uninstall+reinstall) or RSA key rotated. " +
            "Data is unrecoverable."
        )
      }
      return@Coroutine null
    }

    AsyncFunction("removeLegacy") Coroutine { key: String ->
      // Remove from modern EncryptedSharedPreferences.
      val prefs = openLegacyPrefs() ?: return@Coroutine false
      prefs.edit().remove(key).commit()

      // Also clear the deprecated StorageCipher18 entry for this key, if any.
      // Idempotent — silently no-ops if the entry does not exist.
      try {
        val oldPrefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        oldPrefs.edit().remove(addStorageCipher18Prefix(key)).apply()
      } catch (e: Exception) {
        Log.w(tag, "Failed to remove StorageCipher18 entry for '$key'", e)
      }

      // Note: we intentionally do NOT delete the AES wrap blob (in SecureKeyStorage)
      // or the Android Keystore RSA alias — other keys may still need them, and the
      // alias is harmless to leave behind. They become inert once all StorageCipher18
      // entries are migrated.
      return@Coroutine true
    }

    AsyncFunction("seedLegacyTestData") Coroutine { key: String, value: String ->
      // Seeds into the modern EncryptedSharedPreferences (used by existing iOS-parity
      // tests that simulate the post-2021-07-22 cohort).
      val prefs = openLegacyPrefs() ?: return@Coroutine false
      prefs.edit().putString(key, value).commit()
      return@Coroutine true
    }

    AsyncFunction("seedLegacyTestDataStorageCipher18") Coroutine { key: String, value: String ->
      // Seeds into the deprecated RSA+AES StorageCipher18 format. Android-only; required
      // to round-trip-test the recovery path locally without a real years-old install.
      // Mirrors `StorageCipher18Implementation` constructor + `encrypt()` from the OLD repo.
      try {
        val secretKey = getOrCreateAesKey()
        val plaintext = value.toByteArray(Charsets.UTF_8)
        val encrypted = aesEncryptCbcPkcs7(plaintext, secretKey)
        val encoded = Base64.encodeToString(encrypted, Base64.DEFAULT)
        val oldPrefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
        oldPrefs.edit().putString(addStorageCipher18Prefix(key), encoded).commit()
        return@Coroutine true
      } catch (e: Exception) {
        Log.e(tag, "seedLegacyTestDataStorageCipher18 failed for key=$key", e)
        return@Coroutine false
      }
    }

    AsyncFunction("cleanupStorageCipher18") Coroutine { ->
      // Remove the redundant RSA+AES material left behind after a successful V2
      // migration. These are protected by Android's per-app sandbox, so cross-app
      // exfiltration is impossible, but on a stolen unlocked device they represent
      // a redundant attack surface.
      //
      // MUST only be called after V2 migration is confirmed true (JS side checks
      // legacyKeystoreMigratedV2 before invoking this). Idempotent — no-op if
      // already cleaned.
      try {
        // 1. Clear the StorageCipher18 ciphertext entries from SecureStorage.
        reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
          .edit().clear().commit()
        // 2. Clear the RSA-wrapped AES key from SecureKeyStorage.
        reactContext.getSharedPreferences(secureKeyPrefsName, Context.MODE_PRIVATE)
          .edit().clear().commit()
        // 3. Delete the Android Keystore RSA alias.
        val ks = KeyStore.getInstance(androidKeyStore).apply { load(null) }
        if (ks.containsAlias(rsaKeyAlias)) ks.deleteEntry(rsaKeyAlias)
        Log.i(tag, "StorageCipher18 RSA+AES material cleaned up after V2 migration")
        return@Coroutine true
      } catch (e: Exception) {
        Log.w(tag, "cleanupStorageCipher18 failed (non-fatal, will retry on next launch)", e)
        return@Coroutine false
      }
    }

    AsyncFunction("clearAllLegacyData") Coroutine { ->
      // Clear modern EncryptedSharedPreferences.
      val prefs = openLegacyPrefs()
      prefs?.edit()?.clear()?.commit()

      // Clear the deprecated StorageCipher18 caches as well so dev/test cycles
      // start from a clean slate. Idempotent — safe to call repeatedly.
      try {
        reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
          .edit().clear().commit()
        reactContext.getSharedPreferences(secureKeyPrefsName, Context.MODE_PRIVATE)
          .edit().clear().commit()
      } catch (e: Exception) {
        Log.w(tag, "Failed to clear deprecated SharedPreferences", e)
      }

      // Clear the Android Keystore RSA alias too — without it, any leftover
      // StorageCipher18 ciphertext is unreadable, which is exactly what tests want.
      try {
        val ks = KeyStore.getInstance(androidKeyStore).apply { load(null) }
        if (ks.containsAlias(rsaKeyAlias)) ks.deleteEntry(rsaKeyAlias)
      } catch (e: Exception) {
        Log.w(tag, "Failed to delete Android Keystore RSA alias", e)
      }

      return@Coroutine prefs != null
    }
  }

  // -------- Modern EncryptedSharedPreferences --------

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

  // -------- StorageCipher18 (deprecated RSA-wrapped AES-128 / AES-CBC-PKCS7) --------

  private fun addStorageCipher18Prefix(key: String): String =
    "${storageCipher18Prefix}_$key"

  /**
   * Try to decrypt a value that was written by the OLD app's
   * `StorageCipher18Implementation.encrypt(...)` and stored under the
   * `VGhpcy..._<key>` prefixed name in `SharedPreferences("SecureStorage")`.
   *
   * Returns null if no such blob exists, the RSA alias has been wiped, or
   * any step fails. Never throws — caller treats null as "not recoverable".
   */
  private fun decryptStorageCipher18(key: String): String? {
    return try {
      val oldPrefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      val encodedCiphertext = oldPrefs.getString(addStorageCipher18Prefix(key), null)
        ?: return null

      val secretKey = readWrappedAesKey() ?: return null

      val combined = Base64.decode(encodedCiphertext, Base64.DEFAULT)
      if (combined.size <= ivSize) {
        Log.e(tag, "StorageCipher18 blob for '$key' is too short (${combined.size} bytes)")
        return null
      }
      val iv = combined.copyOfRange(0, ivSize)
      val payload = combined.copyOfRange(ivSize, combined.size)

      val cipher = Cipher.getInstance("AES/CBC/PKCS7Padding")
      cipher.init(Cipher.DECRYPT_MODE, secretKey, IvParameterSpec(iv))
      val plaintext = cipher.doFinal(payload)
      String(plaintext, Charsets.UTF_8)
    } catch (e: Exception) {
      // Never log key material; only the failure cause.
      Log.e(tag, "StorageCipher18 decryption failed for key=$key: ${e.javaClass.simpleName}")
      null
    }
  }

  /**
   * Read the RSA-wrapped AES key from SharedPreferences (preferring the post-migration
   * `SecureKeyStorage` location, falling back to the pre-migration `SecureStorage`
   * location used before `moveSecretFromPreferencesIfNeeded` ran), then unwrap with the
   * Android Keystore RSA private key under alias `<package>.SecureStoragePluginKey`.
   */
  private fun readWrappedAesKey(): Key? {
    val newLocation = reactContext.getSharedPreferences(secureKeyPrefsName, Context.MODE_PRIVATE)
    var encoded = newLocation.getString(aesPreferencesKey, null)

    if (encoded == null) {
      // Pre-migration cohort: AES wrap was originally written into the same
      // SharedPreferences("SecureStorage") that holds the values, then later
      // moved by `moveSecretFromPreferencesIfNeeded`. If the OLD app never
      // ran the move, the wrap is still there.
      val oldLocation = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      encoded = oldLocation.getString(aesPreferencesKey, null) ?: return null
    }

    return try {
      val wrapped = Base64.decode(encoded, Base64.DEFAULT)
      val privateKey = getRsaPrivateKey() ?: return null
      val cipher = getRsaCipher()
      cipher.init(Cipher.UNWRAP_MODE, privateKey)
      cipher.unwrap(wrapped, "AES", Cipher.SECRET_KEY)
    } catch (e: Exception) {
      Log.e(tag, "RSA unwrap of legacy AES key failed: ${e.javaClass.simpleName}")
      null
    }
  }

  private fun getRsaPrivateKey(): PrivateKey? {
    return try {
      val ks = KeyStore.getInstance(androidKeyStore).apply { load(null) }
      val key = ks.getKey(rsaKeyAlias, null) ?: return null
      key as? PrivateKey
    } catch (e: Exception) {
      Log.e(tag, "Failed to load RSA private key from Android Keystore", e)
      null
    }
  }

  private fun getRsaPublicKey(): PublicKey? {
    return try {
      val ks = KeyStore.getInstance(androidKeyStore).apply { load(null) }
      ks.getCertificate(rsaKeyAlias)?.publicKey
    } catch (e: Exception) {
      Log.e(tag, "Failed to load RSA public key from Android Keystore", e)
      null
    }
  }

  // The OLD code special-cased pre-M and used "AndroidOpenSSL"; minSdk for the
  // current build is well above M, so always use AndroidKeyStoreBCWorkaround.
  private fun getRsaCipher(): Cipher =
    Cipher.getInstance("RSA/ECB/PKCS1Padding", "AndroidKeyStoreBCWorkaround")

  // -------- Test seeding for StorageCipher18 (mirror of the OLD constructor + encrypt) --------

  /**
   * Mirror `StorageCipher18Implementation` constructor: read the wrapped AES
   * key from `SecureKeyStorage` if present, otherwise generate a fresh AES-128
   * key, RSA-wrap it under the Android Keystore alias, persist the wrap, and
   * return the in-memory key for immediate use.
   */
  private fun getOrCreateAesKey(): Key {
    readWrappedAesKey()?.let { return it }

    // Generate a fresh AES-128 key.
    val raw = ByteArray(aesKeySize).also { SecureRandom().nextBytes(it) }
    val secretKey: Key = SecretKeySpec(raw, "AES")

    createRsaKeysIfNeeded()
    val publicKey = getRsaPublicKey()
      ?: throw IllegalStateException("RSA public key missing after createRsaKeysIfNeeded()")
    val wrapCipher = getRsaCipher()
    wrapCipher.init(Cipher.WRAP_MODE, publicKey)
    val wrapped = wrapCipher.wrap(secretKey)

    reactContext
      .getSharedPreferences(secureKeyPrefsName, Context.MODE_PRIVATE)
      .edit()
      .putString(aesPreferencesKey, Base64.encodeToString(wrapped, Base64.DEFAULT))
      .commit()

    return secretKey
  }

  private fun createRsaKeysIfNeeded() {
    val ks = KeyStore.getInstance(androidKeyStore).apply { load(null) }
    if (ks.containsAlias(rsaKeyAlias)) return

    val start = Calendar.getInstance()
    val end = Calendar.getInstance().apply { add(Calendar.YEAR, 25) }

    val builder = KeyGenParameterSpec.Builder(
      rsaKeyAlias,
      KeyProperties.PURPOSE_DECRYPT or KeyProperties.PURPOSE_ENCRYPT
    )
      .setCertificateSubject(X500Principal("CN=$rsaKeyAlias"))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setBlockModes(KeyProperties.BLOCK_MODE_ECB)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_PKCS1)
      .setCertificateSerialNumber(BigInteger.valueOf(1))
      .setCertificateNotBefore(start.time)
      .setCertificateNotAfter(end.time)

    // OLD code requested StrongBox on Android P+. We deliberately do NOT here:
    // emulators don't have StrongBox; the OLD code itself fell back gracefully.
    // The wrap layout produced is identical regardless of where the private key lives.
    val kpg = KeyPairGenerator.getInstance("RSA", androidKeyStore)
    kpg.initialize(builder.build())
    kpg.generateKeyPair()
  }

  private fun aesEncryptCbcPkcs7(plaintext: ByteArray, key: Key): ByteArray {
    val iv = ByteArray(ivSize).also { SecureRandom().nextBytes(it) }
    val cipher = Cipher.getInstance("AES/CBC/PKCS7Padding")
    cipher.init(Cipher.ENCRYPT_MODE, key, IvParameterSpec(iv))
    val payload = cipher.doFinal(plaintext)
    return iv + payload
  }
}
