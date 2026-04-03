# Full E2E Keystore Migration + Vault Export Test

**Date:** 2026-04-03
**Branch:** feat/expo-migration

## Purpose

Validate the complete real-world upgrade path: old-format wallet data in native keystore → migration to expo-secure-store → private key decryption → vault share export → .vult file verification. Covers multi-wallet scenarios and expo-secure-store size limits.

## Test Data

### Private Keys

Two hardcoded secp256k1 test private keys (well-known test vectors, not funded):

- **Wallet 1:** `0x1` padded to 32 bytes → `0000000000000000000000000000000000000000000000000000000000000001`
- **Wallet 2:** `0x2` padded to 32 bytes → `0000000000000000000000000000000000000000000000000000000000000002`

These are standard test vectors with known public keys:
- Key 1 pubkey: `0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798`
- Key 2 pubkey: `02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5`

### Auth Data Structure

```json
{
  "TestWallet1": {
    "ledger": false,
    "address": "terra1test000e2e000wallet001",
    "password": "password1",
    "encryptedKey": "<encrypt(privateKey1Hex, 'password1')>"
  },
  "TestWallet2": {
    "ledger": false,
    "address": "terra1test000e2e000wallet002",
    "password": "password2",
    "encryptedKey": "<encrypt(privateKey2Hex, 'password2')>"
  },
  "TestLedgerWallet": {
    "ledger": true,
    "address": "terra1test000e2e000ledger001",
    "path": 0
  }
}
```

Encrypted keys are generated at runtime using `encrypt()` from `utils/crypto.ts` — the same PBKDF2+AES-CBC function the old app used.

## Test Steps

### Phase 1: Migration

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Clear all legacy and new stores, reset migration flag | Clean slate |
| 2 | Build auth data JSON with 3 wallets (encrypt keys at runtime) | JSON is valid |
| 3 | Seed into legacy keystore via `LegacyKeystore.seedLegacyTestData('AD', json)` | Returns true |
| 4 | Read back via `LegacyKeystore.readLegacy('AD')` | Matches seeded JSON |
| 5 | Run `migrateLegacyKeystore()` | No errors |
| 6 | Read from new expo-secure-store via `keystore.read(KeystoreEnum.AuthData)` | Matches seeded JSON |
| 7 | Verify legacy data cleaned up via `LegacyKeystore.readLegacy('AD')` | Returns null/empty |
| 8 | Run `migrateLegacyKeystore()` again | Idempotent — no errors |

### Phase 2: Decrypt + Validate

| Step | Action | Assertion |
|------|--------|-----------|
| 9 | Parse migrated auth data JSON | Has 3 wallets |
| 10 | Decrypt wallet 1's `encryptedKey` with `password1` using `decrypt()` | Matches original private key hex |
| 11 | Decrypt wallet 2's `encryptedKey` with `password2` | Matches original private key hex |
| 12 | Verify Ledger wallet has `ledger: true`, correct address, `path: 0` | Structure preserved |
| 13 | Derive secp256k1 public key from wallet 1's decrypted key | Matches known pubkey |

### Phase 3: Vault Export + Verification

| Step | Action | Assertion |
|------|--------|-----------|
| 14 | Call `exportVaultShare(privateKey1Hex, 'TestWallet1', 'exportpass')` | Returns file URI |
| 15 | Read .vult file contents (base64 string) | Non-empty |
| 16 | Base64 decode → parse VaultContainer protobuf | `isEncrypted === true`, `version === 1` |
| 17 | Base64 decode container's `vault` field → decrypt with AES-256-GCM (key=SHA256('exportpass')) | Decryption succeeds |
| 18 | Parse decrypted bytes as Vault protobuf | `name === 'TestWallet1'` |
| 19 | Verify Vault fields | `publicKeyEcdsa` matches known pubkey, `libType === KEYIMPORT`, `keyShares[0].keyshare === privateKey1Hex` |

### Phase 4: Size Stress Test

| Step | Action | Assertion |
|------|--------|-----------|
| 20 | Build JSON with 10 wallets (each with realistic ~172-char encrypted keys) | JSON > 2048 bytes (historical limit) |
| 21 | Write to expo-secure-store via `keystore.write()` | Returns true |
| 22 | Read back via `keystore.read()` | Byte-for-byte match |
| 23 | Report exact payload size in results | Logged for QA |

## Files

### New Files

- `src/components/DevFullE2ETest.tsx` — Test component with all steps above, renders results with testIDs
- `e2e/full-e2e-migration.test.js` — Detox test that taps trigger button and asserts all steps

### Modified Files

- `src/screens/AuthMenu.tsx` (or wherever dev buttons live) — Add "Full E2E Test" button with testID `dev-full-e2e-test`

### Unchanged Files

- `src/components/DevMigrationTest.tsx` — Existing test stays as-is
- `src/services/exportVaultShare.ts` — Production code, no changes
- `src/utils/legacyMigration.ts` — Production code, no changes
- `modules/legacy-keystore-migration/` — Native module, no changes

## Vault Verification Logic

Inline in the test component (not a separate utility file):

```typescript
// Pseudo-code for vault verification
const containerBytes = base64.decode(fileContents)
const container = fromBinary(VaultContainerSchema, containerBytes)
// container.vault is base64 of: nonce(12) + ciphertext + tag(16)
const encryptedBytes = base64.decode(container.vault)
const nonce = encryptedBytes.slice(0, 12)
const ciphertext = encryptedBytes.slice(12)
const key = sha256('exportpass')
const decryptedBytes = gcm(key, nonce).decrypt(ciphertext)
const vault = fromBinary(VaultSchema, decryptedBytes)
// Assert vault.name, vault.publicKeyEcdsa, vault.keyShares, etc.
```

## Dependencies

All imports already available in the project:
- `@bufbuild/protobuf` — `create`, `toBinary`, `fromBinary`
- `@noble/ciphers/aes.js` — `gcm`
- `@noble/hashes/sha2.js` — `sha256`
- `@noble/curves/secp256k1.js` — `secp256k1`
- `@scure/base` — `hex`, `base64`
- `expo-file-system/legacy` — `readAsStringAsync`
- `utils/crypto` — `encrypt`, `decrypt`
- `modules/legacy-keystore-migration/src` — `LegacyKeystore`
- `nativeModules/keystore` — `keystore`, `KeystoreEnum`
- `nativeModules/preferences` — `preferences`, `PreferencesEnum`

## Success Criteria

All 23 steps pass. Results rendered on screen with testIDs for Detox assertions. Any failure stops the test and reports which step failed.
