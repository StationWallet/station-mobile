# Legacy Keystore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure wallets stored by the old native React Native app (main branch) are accessible after upgrading to the Expo-based app (feat/expo-migration branch), on both iOS and Android.

**Architecture:** Create a local Expo native module (`legacy-keystore-migration`) that reads wallet data from the old storage format (iOS: Keychain with AES encryption at `_secure_storage_service`; Android: `EncryptedSharedPreferences("SecureStorage")`), decrypts it, and makes it available to JavaScript. A migration function runs once on first launch, reads from the legacy module, writes to expo-secure-store, and marks migration complete. A persistent Detox E2E test validates the full migration path by seeding old-format data via native helpers, restarting the app, and asserting the wallet is accessible.

**Tech Stack:** Swift (iOS native module), Kotlin (Android native module), expo-modules-core, CommonCrypto (iOS), androidx.security.crypto (Android), Detox (E2E testing)

---

## File Structure

### New files

```
modules/legacy-keystore-migration/
├── package.json                          # npm package metadata for local module
├── expo-module.config.json               # Expo module registration
├── src/
│   └── index.ts                          # TypeScript bindings
├── ios/
│   ├── LegacyKeystoreMigration.podspec   # CocoaPods spec
│   └── LegacyKeystoreMigrationModule.swift  # iOS native: keychain read + AES decrypt
└── android/
    ├── build.gradle                      # Gradle config with EncryptedSharedPreferences dep
    └── src/main/java/expo/modules/legacykeystoremigration/
        └── LegacyKeystoreMigrationModule.kt  # Android native: read EncryptedSharedPrefs

src/utils/legacyMigration.ts              # JS migration orchestration (read legacy → write new)
e2e/legacy-migration.test.js              # Detox E2E test
```

### Modified files

```
app.json                                  # Add module to plugins array
src/App/index.tsx                         # Call migration before init()
src/nativeModules/keystore.ts             # Fix misleading comment
src/nativeModules/preferences.ts          # Add legacyKeystoreMigrated enum value
```

---

### Task 1: Create the Expo native module skeleton

**Files:**
- Create: `modules/legacy-keystore-migration/package.json`
- Create: `modules/legacy-keystore-migration/expo-module.config.json`
- Create: `modules/legacy-keystore-migration/src/index.ts`
- Modify: `app.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "legacy-keystore-migration",
  "version": "1.0.0",
  "main": "src/index.ts",
  "description": "Reads wallet data from the old native Keystore module format for migration to expo-secure-store",
  "private": true
}
```

Write to `modules/legacy-keystore-migration/package.json`.

- [ ] **Step 2: Create expo-module.config.json**

```json
{
  "platforms": ["apple", "android"],
  "apple": {
    "modules": ["LegacyKeystoreMigrationModule"]
  },
  "android": {
    "modules": ["expo.modules.legacykeystoremigration.LegacyKeystoreMigrationModule"]
  }
}
```

Write to `modules/legacy-keystore-migration/expo-module.config.json`.

- [ ] **Step 3: Create TypeScript bindings**

```typescript
import { requireNativeModule } from 'expo-modules-core'

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

export default requireNativeModule<LegacyKeystoreMigrationModule>(
  'LegacyKeystoreMigration'
)
```

Write to `modules/legacy-keystore-migration/src/index.ts`.

- [ ] **Step 4: Register module in app.json**

Add `"./modules/legacy-keystore-migration"` to the `plugins` array in `app.json`:

```json
"plugins": [
  "expo-secure-store",
  "expo-camera",
  "expo-local-authentication",
  "@config-plugins/detox",
  "./modules/legacy-keystore-migration"
]
```

- [ ] **Step 5: Commit**

```bash
git add modules/legacy-keystore-migration/package.json \
       modules/legacy-keystore-migration/expo-module.config.json \
       modules/legacy-keystore-migration/src/index.ts \
       app.json
git commit -m "feat: scaffold legacy-keystore-migration Expo native module"
```

---

### Task 2: Implement iOS native migration module

**Files:**
- Create: `modules/legacy-keystore-migration/ios/LegacyKeystoreMigration.podspec`
- Create: `modules/legacy-keystore-migration/ios/LegacyKeystoreMigrationModule.swift`

**Context:** The old iOS app (main branch `ios/TerraStation/KeystoreLib/Keystore.m`) stores data in the iOS Keychain like this:
- `kSecAttrService = "_secure_storage_service"`
- `kSecAttrAccount = <key>` (e.g., `"AD"` for wallet data, `"key"` for the AES encryption key)
- The value is AES-256-CBC encrypted (zero IV, PKCS7 padding) using a randomly-generated base64 key stored under account `"key"`.
- The AES key is a base64-encoded 24-byte random string, C-string-copied into a 33-byte buffer (zeroed first), giving a 32-byte key for AES-256.

- [ ] **Step 1: Create the podspec**

```ruby
require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LegacyKeystoreMigration'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { type: 'MIT' }
  s.author         = 'Vultisig'
  s.homepage       = 'https://github.com/ApotheosisTeam/station-mobile'
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
```

Write to `modules/legacy-keystore-migration/ios/LegacyKeystoreMigration.podspec`.

- [ ] **Step 2: Create the Swift module**

```swift
import ExpoModulesCore
import CommonCrypto
import Security

public final class LegacyKeystoreMigrationModule: Module {
  private let legacyService = "_secure_storage_service"
  private let aesKeyAccount = "key"

  public func definition() -> ModuleDefinition {
    Name("LegacyKeystoreMigration")

    AsyncFunction("readLegacy") { (key: String) -> String? in
      guard let aesKeyString = self.readKeychain(account: self.aesKeyAccount) else {
        // No AES key means no legacy data was ever written
        return nil
      }
      guard let encryptedData = self.readKeychainRaw(account: key) else {
        return nil
      }
      return self.aesDecrypt(data: encryptedData, keyString: aesKeyString)
    }

    AsyncFunction("removeLegacy") { (key: String) -> Bool in
      return self.deleteKeychain(account: key)
    }

    AsyncFunction("seedLegacyTestData") { (key: String, value: String) -> Bool in
      // Generate or retrieve AES key
      let aesKeyString: String
      if let existingKey = self.readKeychain(account: self.aesKeyAccount) {
        aesKeyString = existingKey
      } else {
        var randomBytes = [UInt8](repeating: 0, count: 24)
        let status = SecRandomCopyBytes(kSecRandomDefault, 24, &randomBytes)
        guard status == errSecSuccess else { return false }
        aesKeyString = Data(randomBytes).base64EncodedString()
        guard self.writeKeychainRaw(
          account: self.aesKeyAccount,
          data: aesKeyString.data(using: .utf8)!
        ) else { return false }
      }

      guard let valueData = value.data(using: .utf8) else { return false }
      guard let encrypted = self.aesEncrypt(data: valueData, keyString: aesKeyString) else {
        return false
      }
      return self.writeKeychainRaw(account: key, data: encrypted)
    }

    AsyncFunction("clearAllLegacyData") { () -> Bool in
      let _ = self.deleteKeychain(account: self.aesKeyAccount)
      let _ = self.deleteKeychain(account: "AD")
      return true
    }
  }

  // MARK: - Keychain helpers

  private func searchQuery(account: String) -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: legacyService,
      kSecAttrAccount as String: account.data(using: .utf8)!,
    ]
  }

  /// Read raw bytes from keychain (for encrypted wallet data).
  private func readKeychainRaw(account: String) -> Data? {
    var query = searchQuery(account: account)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = kCFBooleanTrue

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return nil }
    return data
  }

  /// Read a UTF-8 string from keychain (for the AES key, which is stored unencrypted as raw UTF-8 bytes).
  private func readKeychain(account: String) -> String? {
    guard let data = readKeychainRaw(account: account) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// Write raw bytes to keychain.
  private func writeKeychainRaw(account: String, data: Data) -> Bool {
    // Delete any existing item first
    let _ = deleteKeychain(account: account)

    var query = searchQuery(account: account)
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked

    let status = SecItemAdd(query as CFDictionary, nil)
    return status == errSecSuccess
  }

  /// Delete a keychain item.
  private func deleteKeychain(account: String) -> Bool {
    let query = searchQuery(account: account)
    let status = SecItemDelete(query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }

  // MARK: - AES-256-CBC (matching old Keystore.m / NSData+AES.m)

  /// Decrypt data using AES-256-CBC with zero IV and PKCS7 padding.
  /// The key is a base64 string copied into a 32-byte zero-padded buffer
  /// (matching the old Obj-C `getCString:maxLength:encoding:` behavior).
  private func aesDecrypt(data: Data, keyString: String) -> String? {
    let keyBytes = aesKeyBytes(from: keyString)
    let iv = [UInt8](repeating: 0, count: kCCBlockSizeAES128)

    let bufferSize = data.count + kCCBlockSizeAES128
    var buffer = [UInt8](repeating: 0, count: bufferSize)
    var numBytesDecrypted: size_t = 0

    let status = keyBytes.withUnsafeBufferPointer { keyPtr in
      data.withUnsafeBytes { dataPtr in
        CCCrypt(
          CCOperation(kCCDecrypt),
          CCAlgorithm(kCCAlgorithmAES128),
          CCOptions(kCCOptionPKCS7Padding),
          keyPtr.baseAddress, kCCKeySizeAES256,
          iv,
          dataPtr.baseAddress, data.count,
          &buffer, bufferSize,
          &numBytesDecrypted
        )
      }
    }

    guard status == CCCryptorStatus(kCCSuccess) else { return nil }
    return String(bytes: buffer.prefix(numBytesDecrypted), encoding: .utf8)
  }

  /// Encrypt data using AES-256-CBC with zero IV and PKCS7 padding.
  private func aesEncrypt(data: Data, keyString: String) -> Data? {
    let keyBytes = aesKeyBytes(from: keyString)
    let iv = [UInt8](repeating: 0, count: kCCBlockSizeAES128)

    let bufferSize = data.count + kCCBlockSizeAES128
    var buffer = [UInt8](repeating: 0, count: bufferSize)
    var numBytesEncrypted: size_t = 0

    let status = keyBytes.withUnsafeBufferPointer { keyPtr in
      data.withUnsafeBytes { dataPtr in
        CCCrypt(
          CCOperation(kCCEncrypt),
          CCAlgorithm(kCCAlgorithmAES128),
          CCOptions(kCCOptionPKCS7Padding),
          keyPtr.baseAddress, kCCKeySizeAES256,
          iv,
          dataPtr.baseAddress, data.count,
          &buffer, bufferSize,
          &numBytesEncrypted
        )
      }
    }

    guard status == CCCryptorStatus(kCCSuccess) else { return nil }
    return Data(buffer.prefix(numBytesEncrypted))
  }

  /// Convert the base64 key string to a 32-byte (kCCKeySizeAES256 + 1 for null terminator, then 32 used)
  /// buffer matching the old Obj-C behavior:
  ///   char keyPtr[keySize+1]; bzero(keyPtr, sizeof(keyPtr));
  ///   [key getCString:keyPtr maxLength:sizeof(keyPtr) encoding:NSUTF8StringEncoding];
  private func aesKeyBytes(from keyString: String) -> [UInt8] {
    var keyBytes = [UInt8](repeating: 0, count: kCCKeySizeAES256 + 1)
    let utf8 = Array(keyString.utf8)
    let copyLen = min(utf8.count, kCCKeySizeAES256)
    for i in 0..<copyLen {
      keyBytes[i] = utf8[i]
    }
    // Return only 32 bytes (the extra null terminator byte is not part of the key)
    return Array(keyBytes.prefix(kCCKeySizeAES256))
  }
}
```

Write to `modules/legacy-keystore-migration/ios/LegacyKeystoreMigrationModule.swift`.

- [ ] **Step 3: Run pod install to verify the module links**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile/ios && pod install
```

Expected: Pod install succeeds and `LegacyKeystoreMigration` appears in the installed pods list.

- [ ] **Step 4: Commit**

```bash
git add modules/legacy-keystore-migration/ios/
git commit -m "feat(ios): implement legacy keychain reader with AES-256-CBC decryption"
```

---

### Task 3: Implement Android native migration module

**Files:**
- Create: `modules/legacy-keystore-migration/android/build.gradle`
- Create: `modules/legacy-keystore-migration/android/src/main/java/expo/modules/legacykeystoremigration/LegacyKeystoreMigrationModule.kt`

**Context:** The old Android app (`android/app/src/main/java/money/terra/station/KeystoreLib/Keystore.java`) stores data using `EncryptedSharedPreferences` with:
- Preferences name: `"SecureStorage"`
- Master key: `MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)`
- Key encryption: `AES256_SIV`
- Value encryption: `AES256_GCM`
- Keys stored directly (e.g., `"AD"` for wallet data)

There is also a legacy path using `StorageCipher18Implementation` (RSA-wrapped AES keys), but `migratePreferences` in the old app already migrates from that format to `EncryptedSharedPreferences`. We only need to handle the modern format.

- [ ] **Step 1: Create build.gradle**

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'host.exp.exponent'
version = '1.0.0'

android {
  namespace "expo.modules.legacykeystoremigration"
  defaultConfig {
    versionCode 1
    versionName '1.0.0'
  }
}

dependencies {
  implementation "androidx.security:security-crypto:1.1.0-alpha06"
}
```

Write to `modules/legacy-keystore-migration/android/build.gradle`.

- [ ] **Step 2: Create the Kotlin module**

```kotlin
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
```

Write to `modules/legacy-keystore-migration/android/src/main/java/expo/modules/legacykeystoremigration/LegacyKeystoreMigrationModule.kt`.

- [ ] **Step 3: Verify Android build compiles**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile && npx expo run:android --no-install 2>&1 | tail -20
```

Expected: Build succeeds (or at least the module compiles without errors).

- [ ] **Step 4: Commit**

```bash
git add modules/legacy-keystore-migration/android/
git commit -m "feat(android): implement legacy EncryptedSharedPreferences reader"
```

---

### Task 4: Create JavaScript migration orchestration

**Files:**
- Create: `src/utils/legacyMigration.ts`

- [ ] **Step 1: Write the migration utility**

```typescript
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
```

Note: This requires adding `legacyKeystoreMigrated = 'legacyKeystoreMigrated'` to `PreferencesEnum` in `src/nativeModules/preferences.ts` (see Task 9).

Write to `src/utils/legacyMigration.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/utils/legacyMigration.ts
git commit -m "feat: add legacy keystore migration orchestration"
```

---

### Task 5: Integrate migration into app startup and fix comments

**Files:**
- Modify: `src/App/index.tsx:203-223`
- Modify: `src/nativeModules/keystore.ts:17-28`

- [ ] **Step 1: Update App/index.tsx to call migration before init**

In `src/App/index.tsx`, add the import and call `migrateLegacyKeystore()` before `init()`. Replace the `useEffect` block (lines 203-223):

```typescript
// Add import at top of file (after existing imports):
import { migrateLegacyKeystore } from 'utils/legacyMigration'
```

Replace lines 203-223 with:

```typescript
  useEffect(() => {
    const startup = async (): Promise<void> => {
      await clearKeystoreWhenFirstRun()
      await migrateLegacyKeystore()

      try {
        await keystore.migratePreferences('AD')
      } catch {}

      const local = await settings.get()
      setLocal(local)
      const wallets = await getWallets()
      setUser(wallets)
    }

    startup().then((): void => {
      setInitComplete(true)
    })
  }, [])
```

Note: `clearKeystoreWhenFirstRun()` was previously called without `await` — it must complete before migration runs, so we `await` it now.

- [ ] **Step 2: Fix the misleading comment in keystore.ts**

In `src/nativeModules/keystore.ts`, replace lines 17-28:

Old:
```typescript
// Match the old react-native-keychain storage location exactly so that
// existing wallet data is accessible after the Expo upgrade.
//
// Old app (react-native-keychain):
//   kSecAttrService = "app.keystore-AD"
//   kSecAttrAccount = "keystore"
//
// expo-secure-store maps:
//   keychainService option → kSecAttrService
//   key parameter          → kSecAttrAccount
//
// So we use keychainService="app.keystore-{key}" and key="keystore".
```

New:
```typescript
// New storage location for expo-secure-store.
//
// The old native app used a DIFFERENT keychain location
// (kSecAttrService="_secure_storage_service") with an additional AES
// encryption layer. Migration from old → new is handled by
// legacyMigration.ts using the legacy-keystore-migration native module.
//
// expo-secure-store maps:
//   keychainService option → kSecAttrService
//   key parameter          → kSecAttrAccount
```

- [ ] **Step 3: Verify the app builds and launches on iOS simulator**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile && npm run ios -- --simulator="iPhone 16"
```

Expected: App builds and launches without crashes. No wallet data expected yet.

- [ ] **Step 4: Commit**

```bash
git add src/App/index.tsx src/nativeModules/keystore.ts
git commit -m "feat: integrate legacy keystore migration into app startup"
```

---

### Task 6: Add dev-only migration test UI for Detox

**Files:**
- Create: `src/components/DevMigrationTest.tsx`

**Context:** The existing Detox test pattern (see `e2e/crypto-parity.test.js`) works by tapping a dev-only button on the auth screen which navigates to a screen that computes values and renders them as `Text` elements with `testID` props. The Detox test then asserts on those text values. We follow the same pattern.

- [ ] **Step 1: Create the dev migration test component**

```typescript
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import { migrateLegacyKeystore } from 'utils/legacyMigration'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

const TEST_WALLET_DATA = JSON.stringify({
  TestLegacyWallet: {
    ledger: false,
    address: 'terra1test000legacy000migration000addr',
    password: 'testpass',
    encryptedKey: 'abc123encryptedkey',
  },
})

export default function DevMigrationTest(): React.ReactElement {
  const [results, setResults] = useState<Record<string, string>>({})

  useEffect(() => {
    runTest()
  }, [])

  const runTest = async (): Promise<void> => {
    const r: Record<string, string> = {}

    try {
      // Step 1: Clean slate
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setString(PreferencesEnum.legacyKeystoreMigrated, '')
      r['clean'] = 'true'

      // Step 2: Seed legacy data
      const seeded = await LegacyKeystore.seedLegacyTestData('AD', TEST_WALLET_DATA)
      r['seeded'] = String(seeded)

      // Step 3: Verify legacy data is readable via native module
      const legacyRead = await LegacyKeystore.readLegacy('AD')
      r['legacy-readable'] = String(legacyRead === TEST_WALLET_DATA)
      r['legacy-data'] = legacyRead || 'null'

      // Step 4: Run migration
      await migrateLegacyKeystore()
      r['migration-ran'] = 'true'

      // Step 5: Read from new expo-secure-store location
      const newData = await keystore.read(KeystoreEnum.AuthData)
      r['new-readable'] = String(newData === TEST_WALLET_DATA)
      r['new-data'] = newData || 'null'

      // Step 6: Verify legacy data was cleaned up
      const legacyAfter = await LegacyKeystore.readLegacy('AD')
      r['legacy-cleaned'] = String(legacyAfter === null || legacyAfter === '')

      // Step 7: Verify migration is idempotent
      await migrateLegacyKeystore()
      const newDataAfterSecondRun = await keystore.read(KeystoreEnum.AuthData)
      r['idempotent'] = String(newDataAfterSecondRun === TEST_WALLET_DATA)

      // Step 8: Parse the migrated data to verify structure
      const parsed = JSON.parse(newData)
      r['wallet-name'] = Object.keys(parsed)[0] || 'missing'
      r['wallet-address'] = parsed?.TestLegacyWallet?.address || 'missing'

      r['all-passed'] = String(
        r['seeded'] === 'true' &&
        r['legacy-readable'] === 'true' &&
        r['new-readable'] === 'true' &&
        r['legacy-cleaned'] === 'true' &&
        r['idempotent'] === 'true'
      )
    } catch (error) {
      r['error'] = String(error)
      r['all-passed'] = 'false'
    }

    // Clean up after test
    try {
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setString(PreferencesEnum.legacyKeystoreMigrated, '')
    } catch {}

    setResults(r)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Legacy Migration Test Results</Text>
      {Object.entries(results).map(([key, value]) => (
        <Text key={key} testID={`migration-${key}`} style={styles.result}>
          {key}: {value}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 18, marginBottom: 12, fontWeight: 'bold' },
  result: { color: '#0f0', fontSize: 14, marginBottom: 4, fontFamily: 'monospace' },
})
```

Write to `src/components/DevMigrationTest.tsx`.

- [ ] **Step 2: Find where the existing dev-crypto-test button lives and add a migration test button next to it**

Search for `dev-crypto-test` in the codebase to find the auth screen where dev buttons are rendered. Add a `dev-migration-test` button alongside it that navigates to the `DevMigrationTest` component. The exact integration depends on the navigation structure — look at how `dev-crypto-test` is wired up and follow the same pattern.

- [ ] **Step 3: Verify the dev button appears and the test screen renders**

Build and run on simulator. Tap the "Migration Test" dev button. Verify text results render.

- [ ] **Step 4: Commit**

```bash
git add src/components/DevMigrationTest.tsx
# Also add any navigation/screen registration changes
git commit -m "feat: add dev-only legacy migration test component for E2E"
```

---

### Task 7: Write Detox E2E test

**Files:**
- Create: `e2e/legacy-migration.test.js`

- [ ] **Step 1: Write the Detox test**

```javascript
describe('Legacy Keystore Migration', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();

    // Tap the dev-only "Migration Test" button on AuthMenu
    await waitFor(element(by.id('dev-migration-test')))
      .toBeVisible()
      .withTimeout(30000);
    await element(by.id('dev-migration-test')).tap();

    // Wait for test results to render
    await waitFor(element(by.id('migration-all-passed')))
      .toExist()
      .withTimeout(30000);
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  it('seeds legacy data successfully', async () => {
    await expect(element(by.id('migration-seeded'))).toHaveText('seeded: true');
  });

  it('reads legacy data via native module', async () => {
    await expect(element(by.id('migration-legacy-readable'))).toHaveText(
      'legacy-readable: true'
    );
  });

  it('migrates data to new expo-secure-store location', async () => {
    await expect(element(by.id('migration-new-readable'))).toHaveText(
      'new-readable: true'
    );
  });

  it('cleans up legacy data after migration', async () => {
    await expect(element(by.id('migration-legacy-cleaned'))).toHaveText(
      'legacy-cleaned: true'
    );
  });

  it('migration is idempotent', async () => {
    await expect(element(by.id('migration-idempotent'))).toHaveText(
      'idempotent: true'
    );
  });

  it('preserves wallet name', async () => {
    await expect(element(by.id('migration-wallet-name'))).toHaveText(
      'wallet-name: TestLegacyWallet'
    );
  });

  it('preserves wallet address', async () => {
    await expect(element(by.id('migration-wallet-address'))).toHaveText(
      'wallet-address: terra1test000legacy000migration000addr'
    );
  });

  it('all migration checks pass', async () => {
    await expect(element(by.id('migration-all-passed'))).toHaveText(
      'all-passed: true'
    );
  });
});
```

Write to `e2e/legacy-migration.test.js`.

- [ ] **Step 2: Build the Detox debug app and run the test**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
npx detox build --configuration ios.sim.debug
npx detox test --configuration ios.sim.debug e2e/legacy-migration.test.js
```

Expected: All 8 test assertions pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/legacy-migration.test.js
git commit -m "test: add persistent E2E test for legacy keystore migration"
```

---

### Task 8: Manual cross-branch integration test

This is a one-time manual verification that real old-app keychain data migrates correctly. It is NOT automated — it verifies that the native module correctly matches the actual old app's storage format.

**Prerequisites:** iOS simulator with a clean state.

- [ ] **Step 1: Reset the iOS simulator**

```bash
xcrun simctl shutdown all
xcrun simctl erase all
```

- [ ] **Step 2: Build and run the old app (main branch) on the simulator**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
git stash
git checkout main
npm install
cd ios && pod install && cd ..
npm run ios -- --simulator="iPhone 16"
```

Wait for the app to launch.

- [ ] **Step 3: Create a test wallet on the old app**

Since the webview may not work, we inject wallet data directly. While the old app is running, open Safari and navigate to the Metro debug console, or use a patch:

Create a temporary file `__test_seed_wallet.js` at the project root:

```javascript
// Run this in the Metro bundler debug console
const keystore = require('./src/nativeModules/keystore').default;
const { encrypt } = require('./src/utils/crypto');

const testData = JSON.stringify({
  ManualTestWallet: {
    ledger: false,
    address: 'terra1manualtest12345',
    password: 'testpassword',
    encryptedKey: encrypt('deadbeef1234567890abcdef', 'testpassword'),
  },
});

keystore.write('AD', testData);
console.log('TEST WALLET WRITTEN:', testData);
```

Alternative approach if debug console is not available: temporarily modify `src/App/index.tsx` on the main branch to auto-create a wallet in the `init` function:

Add after `const wallets = await getWallets()` in the init function:

```typescript
if (wallets.length === 0) {
  const { encrypt } = require('../utils/crypto')
  const testData = JSON.stringify({
    ManualTestWallet: {
      ledger: false,
      address: 'terra1manualtest12345',
      password: 'testpassword',
      encryptedKey: encrypt('deadbeef1234567890abcdef', 'testpassword'),
    },
  })
  keystore.write('AD', testData)
  console.log('[TEST] Seeded wallet data for migration test')
}
```

Rebuild and run. Verify the wallet was seeded by checking the console log.

- [ ] **Step 4: Stop the old app (do NOT uninstall)**

Press Ctrl+C to stop Metro. The app data remains on the simulator.

- [ ] **Step 5: Switch to the new branch and build**

```bash
git checkout feat/expo-migration
git stash pop  # if you stashed changes
npm install
cd ios && pod install && cd ..
npm run ios -- --simulator="iPhone 16"
```

The app should launch on the SAME simulator, with the old keychain data still present.

- [ ] **Step 6: Verify migration succeeded**

The app should detect the legacy wallet data during startup (`migrateLegacyKeystore()`), migrate it, and show `ManualTestWallet` in the wallet list.

If using the dev migration test button: tap it and verify all results show `true`.

If the wallet appears in the list, migration is confirmed working. If not, check the console logs for migration errors.

- [ ] **Step 7: Clean up temporary changes**

Remove any temporary patches made to the main branch:

```bash
git checkout main -- src/App/index.tsx  # revert if modified
rm -f __test_seed_wallet.js
git checkout feat/expo-migration
```

- [ ] **Step 8: Document the result**

Record whether the migration succeeded or failed. If it failed, examine the error and fix the native module before proceeding.

---

### Task 9: Add migration flag to PreferencesEnum

**Files:**
- Modify: `src/nativeModules/preferences.ts:3-13`

The migration code uses `PreferencesEnum.legacyKeystoreMigrated` to track whether migration has run. This enum value must be added.

- [ ] **Step 1: Add enum value**

In `src/nativeModules/preferences.ts`, add to the `PreferencesEnum`:

```typescript
export enum PreferencesEnum {
  settings = 'settings',
  onboarding = 'skipOnboarding',
  useBioAuth = 'useBioAuth',
  firstRun = 'firstRun',
  walletHideSmall = 'walletHideSmall',
  scheme = 'scheme',
  walletConnectSession = 'walletConnectSession',
  stakingFilter = 'stakingFilter',
  tokens = 'tokens',
  legacyKeystoreMigrated = 'legacyKeystoreMigrated',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/nativeModules/preferences.ts
git commit -m "feat: add legacyKeystoreMigrated to PreferencesEnum"
```
