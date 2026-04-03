# Legacy Keystore Migration

This document describes how wallet data is migrated from the old React Native native
keystore to the new Expo-based `expo-secure-store` storage layer. This migration runs
automatically on first launch after a user upgrades from the old app to the Expo build.

**Why this matters:** Wallet private keys are encrypted and stored in the device keystore.
If migration fails or reads from the wrong location, users permanently lose access to
their funds. Every decision in this system is made with that risk in mind.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Storage Locations](#storage-locations)
3. [iOS: How It Works](#ios-how-it-works)
4. [Android: How It Works](#android-how-it-works)
5. [Migration Orchestration (JavaScript)](#migration-orchestration-javascript)
6. [App Startup Sequence](#app-startup-sequence)
7. [Safety Mechanisms](#safety-mechanisms)
8. [What Works](#what-works)
9. [What Does Not Work](#what-does-not-work)
10. [Testing](#testing)
11. [File Reference](#file-reference)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The migration has three layers:

```
┌─────────────────────────────────────────────────────────┐
│  src/utils/legacyMigration.ts                           │
│  JavaScript orchestrator — coordinates read/write/verify │
├─────────────────────────────────────────────────────────┤
│  modules/legacy-keystore-migration/                     │
│  Custom Expo native module (Swift + Kotlin)             │
│  Reads from OLD keystore locations using OLD encryption  │
├─────────────────────────────────────────────────────────┤
│  expo-secure-store                                      │
│  New storage backend — writes to NEW keystore locations  │
└─────────────────────────────────────────────────────────┘
```

The native module exists solely to read data from the old storage format. Once data
is migrated, only `expo-secure-store` is used going forward.

---

## Storage Locations

The old and new apps store wallet data in **different locations** with **different
encryption**. The migration bridges this gap.

### iOS

| Property | Old App (React Native) | New App (Expo) |
|----------|----------------------|----------------|
| API | `Security.framework` (Obj-C) | `expo-secure-store` |
| `kSecAttrService` | `_secure_storage_service` | `app.keystore-AD` |
| `kSecAttrAccount` | `AD` (as UTF-8 Data) | `keystore` |
| Encryption | AES-256-CBC (zero IV, PKCS7) with app-generated key | `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (OS-managed) |
| AES key location | Keychain account `key`, same service | N/A (OS-managed encryption) |

### Android

| Property | Old App (React Native) | New App (Expo) |
|----------|----------------------|----------------|
| API | `EncryptedSharedPreferences` (Java) | `expo-secure-store` |
| Preferences file | `SecureStorage` | `SecureStore` |
| Key encryption | `AES256_SIV` | `AES256_SIV` (expo-secure-store default) |
| Value encryption | `AES256_GCM` | `AES256_GCM` (expo-secure-store default) |
| Master key | `AndroidKeyStore` via `MasterKeys.AES256_GCM_SPEC` | `AndroidKeyStore` (expo-secure-store default) |

---

## iOS: How It Works

**Source:** `modules/legacy-keystore-migration/ios/LegacyKeystoreMigrationModule.swift`

The old iOS app (`Keystore.m` + `NSData+AES.m`) stored wallet data as follows:

1. Generated a random 24-byte AES key, base64-encoded it (32 chars), stored in Keychain
   at account `key`, service `_secure_storage_service`
2. Encrypted wallet JSON with AES-256-CBC using that key as a C-string (zero-padded to
   32 bytes), a zero IV, and PKCS7 padding
3. Stored the ciphertext in Keychain at account `AD`, service `_secure_storage_service`

The migration module replicates this exactly:

```swift
// Same service name as old Keystore.m
private let legacyService = "_secure_storage_service"
private let aesKeyAccount = "key"

// Key derivation matches old getCString behavior:
// UTF-8 bytes copied into a 32-byte zero-filled buffer
private func aesKeyBytes(from keyString: String) -> [UInt8] {
    var keyBytes = [UInt8](repeating: 0, count: kCCKeySizeAES256 + 1)
    let utf8 = Array(keyString.utf8)
    let copyLen = min(utf8.count, kCCKeySizeAES256)
    for i in 0..<copyLen { keyBytes[i] = utf8[i] }
    return Array(keyBytes.prefix(kCCKeySizeAES256))
}
```

**Fallback path:** If AES decryption fails (no key found, or data was written before
the AES layer was added), the module attempts to read the raw keychain data as plaintext
UTF-8. This matches `Keystore.m`'s own fallback behavior.

---

## Android: How It Works

**Source:** `modules/legacy-keystore-migration/android/.../LegacyKeystoreMigrationModule.kt`

The old Android app stored wallet data in `EncryptedSharedPreferences` with file name
`SecureStorage`, using AndroidX Security's `AES256_SIV` key encryption and `AES256_GCM`
value encryption, backed by the Android Keystore system.

The migration module opens the same file with the same encryption parameters:

```kotlin
private val prefsName = "SecureStorage"

private fun openLegacyPrefs(): SharedPreferences? {
    return EncryptedSharedPreferences.create(
        prefsName,
        MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
        reactContext,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
}
```

Since both old and new apps run on the same device with the same Android Keystore
master key, the module can read the old data directly.

### StorageCipher18 (Legacy RSA+AES Format)

Before `EncryptedSharedPreferences` was adopted, an even older format stored data with
a base64 prefix (`VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg`) using
RSA-wrapped AES keys. The old app's `migratePreferences()` method (called on every
launch) converted this format to `EncryptedSharedPreferences`.

The Expo migration module **detects** this format but **cannot decrypt it**. See
[What Does Not Work](#what-does-not-work) for details.

---

## Migration Orchestration (JavaScript)

**Source:** `src/utils/legacyMigration.ts`

```
migrateLegacyKeystore()
│
├─ Check flag: legacyKeystoreMigrated === 'true' ?
│  └─ YES → return (already done)
│
├─ Check new location: expo-secure-store has data?
│  └─ YES → set flag, return (data already in new format)
│
├─ Check native module available?
│  └─ NO → set flag, return (Expo Go — can't read native keystore)
│
├─ Call LegacyKeystore.readLegacy('AD')
│  └─ null → set flag, return (no legacy data exists)
│
├─ Validate: JSON.parse(legacyData)
│  └─ throws → catch block, DON'T set flag, return (retry next launch)
│
├─ Write: SecureStore.setItemAsync(...)
│
├─ Verify: SecureStore.getItemAsync(...) === legacyData ?
│  └─ NO → throw (DON'T set flag, retry next launch)
│
├─ Clean up: LegacyKeystore.removeLegacy('AD')
│
└─ Set flag: legacyKeystoreMigrated = 'true'
```

The entire function is wrapped in a try/catch. Any exception **prevents the flag from
being set**, so migration retries on the next app launch. The old data is never removed
until the new data is verified.

---

## App Startup Sequence

**Source:** `src/App/index.tsx` (lines 206-228)

```typescript
const startup = async (): Promise<void> => {
  await clearKeystoreWhenFirstRun()   // Step 1
  await migrateLegacyKeystore()       // Step 2
  await keystore.migratePreferences('AD')  // Step 3 (no-op)
  const local = await settings.get()
  const wallets = await getWallets()  // Step 4
}
```

### Step 1: `clearKeystoreWhenFirstRun()`

iOS only. Clears keychain data on fresh install (iOS preserves keychain across
uninstall/reinstall). On upgrade from the old app:

- `firstRun` flag was in MMKV (now inaccessible) so reads as `false`
- Reads from **new** expo-secure-store location (empty, not yet migrated)
- `keystore.remove('AD')` removes from **new** location only (no-op)
- Sets `firstRun = true`
- **Does NOT touch the old keychain** — legacy data is preserved for Step 2

### Step 2: `migrateLegacyKeystore()`

Runs the migration described above. On successful completion, wallet data is in the
new expo-secure-store location.

### Step 3: `keystore.migratePreferences('AD')`

No-op on the Expo branch. The old app's `migratePreferences` converted StorageCipher18
data to EncryptedSharedPreferences. On main, this ran on every launch. On the Expo
branch, it exists only for interface compatibility and does nothing.

### Step 4: `getWallets()`

Reads from `keystore.read('AD')` which now points to the new expo-secure-store location.
Returns the migrated wallet data.

**Important:** All steps are `await`ed sequentially. The app renders nothing until
`initComplete` is true, so there is no window where wallets appear missing.

---

## Safety Mechanisms

### Verification Before Deletion

Data is written to the new location, then **read back and compared byte-for-byte**
with the source. Only after this verification succeeds is the old data removed.

```typescript
await SecureStore.setItemAsync(LEGACY_ACCOUNT, legacyData, keychainOpts('AD'))
const verification = await SecureStore.getItemAsync(LEGACY_ACCOUNT, keychainOpts('AD'))
if (verification !== legacyData) {
  throw new Error('Migration verification failed')
}
await LegacyKeystore.removeLegacy('AD')  // only after verified
```

### Fail-Safe Error Handling

Any exception during migration is caught. The `legacyKeystoreMigrated` flag is **not
set**, so the next app launch retries the migration. The old data remains untouched.

### Idempotency

The migration checks three conditions before proceeding:
1. Flag already set → skip
2. Data already in new location → set flag, skip
3. Native module unavailable → set flag, skip

Running `migrateLegacyKeystore()` multiple times is safe and produces the same result.

### No Race Conditions

The old app's `clearKeystoreWhenFirstRun()` was **not awaited** (fire-and-forget),
creating a potential race with `migratePreferences()`. The Expo branch fixes this by
awaiting all startup steps sequentially.

---

## What Works

### iOS: All production users

Any user who can see their wallet on the current `main` branch will retain access after
upgrading. The migration module handles:

- **AES-encrypted data** (normal path): decrypts with the stored key from keychain
  account `key`, same algorithm and key derivation as the old `NSData+AES.m`
- **Plaintext data** (pre-AES fallback): reads raw UTF-8 bytes, same fallback as the
  old `Keystore.m`'s `readKeychain:` method
- **Single or multiple wallets**: the entire `AD` value is one JSON blob containing all
  wallets, so all wallets migrate in a single operation

### Android: All production users

Any user who can see their wallet on `main` will retain access. The current `main` app
calls `migratePreferences('AD')` on every launch, which converts StorageCipher18 data
to `EncryptedSharedPreferences`. By the time a user upgrades:

- Their data is in `EncryptedSharedPreferences("SecureStorage")` with plain key `AD`
- The migration module reads from this exact location with the same encryption scheme

### Fresh installs

No legacy data exists. `readLegacy` returns `null`. The migration marks itself complete
and the user proceeds to the wallet creation flow.

### Post-migration launches

The `legacyKeystoreMigrated` flag causes immediate return on all subsequent launches.
Zero performance overhead.

---

## What Does Not Work

### Android: StorageCipher18 data that was never migrated

**Scenario:** A user has wallet data encrypted in the old RSA+AES format (keys prefixed
with `VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg_AD`) and the old app's
`migratePreferences()` never successfully ran.

**What happens:** The migration module detects the prefixed key, logs a `CRITICAL`
error, and returns `null`. The migration marks itself complete with no data transferred.

**Impact:** The user's wallet data is not migrated and will not be accessible.

**Why this is acceptable:** The old app's `read()` method (`Keystore.java`) only reads
from `EncryptedSharedPreferences`, not from StorageCipher18. If `migratePreferences()`
never ran, the user **already cannot see their wallet on the current `main` branch**.
This is a pre-existing condition, not a regression introduced by the Expo migration.

**Mitigation if needed:** The user would need to install a build of the old `main`
branch app, which calls `migratePreferences()` on launch, converting their data to
`EncryptedSharedPreferences`. Then upgrade to the Expo build.

#### Investigation: Was StorageCipher18 ever shipped to the store?

**Conclusion: No. This format was never present in any store release. The risk is
theoretical only and does not affect any real user.**

This was investigated against the git history to confirm it is safe to ignore.
Key findings:

- `StorageCipher18Implementation.java` was present in `4dfb12a Initialize project`
  — the very first commit in this repository. It was never introduced mid-lifecycle.
  It arrived as legacy scaffolding from a prior codebase.
- `v1.0.0` (tagged 2021-02-16, the first store release) already contained
  `StorageCipher18` and also already contained the `EncryptedSharedPreferences`
  write path in `Keystore.java`. By the time any user ever installed the app,
  **all writes went directly to `EncryptedSharedPreferences`**.
- The `@Deprecated` annotation was added to `StorageCipher18Implementation` in a
  later commit (`a82c6dd Add deprecated annotation to unused codes - android`),
  confirming the team already knew it was dead code.
- The `latest/android-153` store tag (2022-07-04, the most recent Android store
  build on `main`) is well past any point where StorageCipher18 was relevant.
- `StorageCipher18` was a compatibility shim for data written by a version of the
  app that **predates this git repository entirely**. There is no migration path from
  that era that goes through the store.

**In short:** If you are ever tempted to implement StorageCipher18 decryption in the
Expo migration module — don't. There are no affected users.

### Expo Go (development only)
**Scenario:** Running the app via Expo Go, which cannot load custom native modules.

**What happens:** `LegacyKeystore` is `null`. Migration marks itself complete with
no data transferred.

**Impact:** Wallets from a previous native build are not accessible in Expo Go.

**Why this is acceptable:** Expo Go is a development tool. Production builds (EAS Build)
include the native module and migrate correctly.

### Corrupted keychain / keystore data

**Scenario:** The device's keychain (iOS) or Android Keystore has been corrupted,
cleared by the OS, or the master key was rotated.

**What happens:** The native module fails to read data. Migration catches the error,
does not set the flag, and retries next launch.

**Impact:** If the underlying keychain is unrecoverable, the wallet data is lost. This
is true for any keychain-based storage and is not specific to the migration.

### iOS: Data encrypted with zero-byte key only (pre-AES-key era)

**Scenario:** A user's wallet was encrypted with 32 zero bytes (the `readOldKeychain:`
path in the old `Keystore.m`) and the old app's `migratePreferences:` never re-encrypted
it with the random AES key.

**What happens:** The migration module tries the random AES key (fails), then falls
back to plaintext (fails because the data is AES-encrypted with zeros, not plaintext).

**Why this is acceptable:** The old app calls `migratePreferences:` on every launch,
which reads with the zero key and re-encrypts with the random key. Any user who ever
opened a version of the app with the random-key code has had their data re-encrypted.
This only affects users who have not opened the app since the AES key was introduced,
which predates the Vultisig rebrand.

---

## Testing

### Dev Migration Test Component

**Source:** `src/components/DevMigrationTest.tsx`

A development-only component that runs the full migration cycle:
1. Clears all legacy and new data (clean slate)
2. Seeds test wallet data into the old native keystore format
3. Verifies the native module can read it back
4. Runs `migrateLegacyKeystore()`
5. Verifies data appears in the new expo-secure-store location
6. Verifies old data was cleaned up
7. Runs migration again to verify idempotency
8. Parses migrated JSON to verify structure integrity

This component is accessible in dev builds via a button on the AuthMenu screen.

### Detox E2E Test

**Source:** `e2e/legacy-migration.test.js`

Automated end-to-end test using Detox that launches the app, navigates to the
migration test component, and asserts all 8 test steps pass. Run with:

```bash
npx detox test -c ios.sim.debug e2e/legacy-migration.test.js
```

### Manual Verification Procedure

For highest confidence before a production release:

1. Install the current `main` branch build on a physical device
2. Create one or more wallets
3. Note the wallet names and addresses
4. Install the Expo branch build (upgrade in place, do not uninstall)
5. Launch the app
6. Verify all wallets appear in the wallet picker / home screen
7. Verify wallet addresses match
8. Verify you can export a private key (proves the full data is intact)

Repeat on both iOS and Android.

---

## File Reference

| File | Purpose |
|------|---------|
| `src/utils/legacyMigration.ts` | JavaScript migration orchestrator |
| `src/nativeModules/keystore.ts` | New keystore abstraction (expo-secure-store) |
| `src/nativeModules/preferences.ts` | New preferences abstraction (expo-secure-store) |
| `src/App/index.tsx` | Startup sequence calling migration |
| `modules/legacy-keystore-migration/src/index.ts` | TypeScript interface for native module |
| `modules/legacy-keystore-migration/ios/LegacyKeystoreMigrationModule.swift` | iOS: Keychain reader with AES-256-CBC decryption |
| `modules/legacy-keystore-migration/android/.../LegacyKeystoreMigrationModule.kt` | Android: EncryptedSharedPreferences reader |
| `modules/legacy-keystore-migration/expo-module.config.json` | Expo module registration |
| `src/components/DevMigrationTest.tsx` | Dev-only migration test component |
| `e2e/legacy-migration.test.js` | Detox E2E test |

### Old App Files (on `main` branch, for reference)

| File | Purpose |
|------|---------|
| `ios/TerraStation/KeystoreLib/Keystore.m` | Old iOS keychain read/write |
| `ios/TerraStation/NSData+AES.m` | Old iOS AES encryption/decryption |
| `android/.../KeystoreLib/Keystore.java` | Old Android keystore read/write |
| `android/.../KeystoreLib/StorageCipher18Implementation.java` | Old Android RSA+AES format |

---

## Troubleshooting

### User reports wallets missing after upgrade

1. Check if migration ran: look for `legacyKeystoreMigrated` in secure storage
2. If flag is `'true'` but no wallet data: migration ran but found nothing to migrate.
   Check if the old keystore location actually had data (requires debug build with
   `DevMigrationTest` component)
3. If flag is empty/missing: migration either failed or hasn't run yet. Check console
   logs for `Legacy keystore migration error:` messages
4. On Android, check for `CRITICAL: Found wallet data in old StorageCipher18 format`
   in logcat. If present, the user needs to run the old app version first

### Migration keeps retrying

The flag isn't being set, meaning migration throws every time. Common causes:
- `SecureStore.setItemAsync` fails (disk full, permissions)
- Verification mismatch (data corruption during write)
- JSON parse failure (corrupted legacy data)

Check console logs for the specific error.

### Wallets appear on one platform but not the other

iOS and Android use completely different storage backends. A wallet created on one
platform exists only on that platform's keychain/keystore. Cross-platform access
requires the wallet's seed phrase or private key.
