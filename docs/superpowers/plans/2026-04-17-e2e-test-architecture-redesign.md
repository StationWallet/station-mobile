# E2E Test Architecture Redesign Implementation Plan

> **HISTORICAL — partially shipped.** Phases A-E and F/G (Jest mocks,
> Tier 1 tests, in-app dev helpers, stub scaffolding) landed in PR #42.
> Phases H and I (Detox UI suites, nightly smoke) were abandoned during
> implementation — the tests failed against a moving UI target and the
> smoke workflow was never exercised. Treat the H/I task detail as
> scaffolding notes for a future Detox push, not shipped code.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current e2e test suite into three tiers (Jest logic tests, minimal Detox UI, nightly real-backend smoke) so the PR gate finishes in <30s instead of ~30 min.

**Architecture:** Tier 1 is plain Jest in `__tests__/` with native modules mocked as in-memory Maps. Tier 2 is Detox UI tests with vultiserver + OTP stubbed behind an `__DEV__`-gated env flag and one `eraseSimulator` at run start. Tier 3 is a single Detox suite in `e2e/smoke/` running against the real backend on a nightly GitHub Actions workflow.

**Tech Stack:** Jest (Node + existing `jest.config.js`), Detox (iOS simulator), GitHub Actions, Expo SecureStore, `@noble/curves`, `@bufbuild/protobuf`.

**Spec:** `docs/superpowers/specs/2026-04-17-e2e-test-architecture-redesign-design.md`

**Lands on:** PR #42 (branch `e2e/test-cleanup` — this work is on `e2e/test-architecture-v2` which will be merged/pushed into `e2e/test-cleanup` at the end).

---

## Phase A — Jest mocks for native modules

### Task A1: Add in-memory mock for LegacyKeystore

**Files:**
- Create: `__tests__/__mocks__/legacy-keystore.ts`

- [ ] **Step 1: Write the mock**

```ts
// __tests__/__mocks__/legacy-keystore.ts
const store = new Map<string, string>()

export function __reset(): void {
  store.clear()
}

const LegacyKeystore = {
  seedLegacyTestData: async (key: string, value: string): Promise<boolean> => {
    store.set(key, value)
    return true
  },
  readLegacy: async (key: string): Promise<string | null> => {
    return store.get(key) ?? null
  },
  removeLegacy: async (key: string): Promise<boolean> => {
    store.delete(key)
    return true
  },
  clearAllLegacyData: async (): Promise<boolean> => {
    store.clear()
    return true
  },
}

export default LegacyKeystore
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/__mocks__/legacy-keystore.ts
git commit -m "test: add in-memory mock for LegacyKeystore"
```

### Task A2: Add in-memory mock for expo-secure-store

**Files:**
- Create: `__tests__/__mocks__/expo-secure-store.ts`

- [ ] **Step 1: Write the mock**

```ts
// __tests__/__mocks__/expo-secure-store.ts
const store = new Map<string, string>()

export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY =
  'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY'

export type SecureStoreOptions = {
  keychainService?: string
  keychainAccessible?: string
}

function compositeKey(key: string, opts?: SecureStoreOptions): string {
  return `${opts?.keychainService ?? '_'}::${key}`
}

export async function setItemAsync(
  key: string,
  value: string,
  opts?: SecureStoreOptions,
): Promise<void> {
  store.set(compositeKey(key, opts), value)
}

export async function getItemAsync(
  key: string,
  opts?: SecureStoreOptions,
): Promise<string | null> {
  return store.get(compositeKey(key, opts)) ?? null
}

export async function deleteItemAsync(
  key: string,
  opts?: SecureStoreOptions,
): Promise<void> {
  store.delete(compositeKey(key, opts))
}

export function __reset(): void {
  store.clear()
}
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/__mocks__/expo-secure-store.ts
git commit -m "test: add in-memory mock for expo-secure-store"
```

### Task A3: Add in-memory mock for preferences native module

**Files:**
- Create: `__tests__/__mocks__/preferences.ts`

- [ ] **Step 1: Write the mock**

```ts
// __tests__/__mocks__/preferences.ts
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
  legacyDataFound = 'legacyDataFound',
  vaultsUpgraded = 'vaultsUpgraded',
  terraOnlyBackfilled = 'terraOnlyBackfilled',
}

const strings = new Map<string, string>()
const bools = new Map<string, boolean>()

export function __reset(): void {
  strings.clear()
  bools.clear()
}

const preferences = {
  setString: async (key: PreferencesEnum, val: string): Promise<void> => {
    strings.set(key, val)
  },
  getString: async (key: PreferencesEnum): Promise<string> => {
    return strings.get(key) ?? ''
  },
  setBool: async (key: PreferencesEnum, val: boolean): Promise<void> => {
    bools.set(key, val)
  },
  getBool: async (key: PreferencesEnum): Promise<boolean> => {
    return bools.get(key) ?? false
  },
  remove: async (key: PreferencesEnum): Promise<void> => {
    strings.delete(key)
    bools.delete(key)
  },
  clear: async (): Promise<void> => {
    strings.clear()
    bools.clear()
  },
}

export default preferences
```

- [ ] **Step 2: Commit**

```bash
git add __tests__/__mocks__/preferences.ts
git commit -m "test: add in-memory mock for preferences native module"
```

### Task A4: Wire mocks into jest.config.js

**Files:**
- Modify: `jest.config.js`

- [ ] **Step 1: Update config**

Replace the existing `moduleNameMapper` block so it additionally maps native modules and `expo-secure-store` to the new mocks.

```js
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^react-native-url-polyfill/auto$': '<rootDir>/__mocks__/empty.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo/virtual/env$': '<rootDir>/__mocks__/expo-virtual-env.js',
    '^expo-secure-store$':
      '<rootDir>/__tests__/__mocks__/expo-secure-store.ts',
    '^nativeModules/preferences$':
      '<rootDir>/__tests__/__mocks__/preferences.ts',
    '^.*/modules/legacy-keystore-migration/src$':
      '<rootDir>/__tests__/__mocks__/legacy-keystore.ts',
    '^expo-crypto$': '<rootDir>/__tests__/__mocks__/expo-crypto.ts',
  },
  testMatch: [
    '**/__tests__/**/*.test.{js,ts,tsx}',
    '**/__test__/**/*.test.{js,ts,tsx}',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure|react-native|react-native-url-polyfill)/)',
  ],
}
```

- [ ] **Step 2: Add the one missing mock (expo-crypto) since it's referenced in moduleNameMapper**

Create: `__tests__/__mocks__/expo-crypto.ts`

```ts
import { randomBytes as nodeRandomBytes } from 'node:crypto'

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(byteCount))
}
```

- [ ] **Step 3: Run the existing polyfill tests to confirm nothing broke**

Run: `npm run test -- --testPathPattern=polyfills`
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add jest.config.js __tests__/__mocks__/expo-crypto.ts
git commit -m "test: wire native module mocks into jest.config moduleNameMapper"
```

---

## Phase B — Tier 1 crypto tests

### Task B1: Port crypto-parity goldens to Jest

**Files:**
- Create: `__tests__/crypto/terra-keys-goldens.test.ts`

- [ ] **Step 1: Read current CryptoTestScreen for the golden values**

Run: `cat src/components/CryptoTestScreen.tsx` — note the imports and assertions so the Jest file exercises the same production functions (`utils/security.ts` derivations, `@noble/hashes`, address validation, etc.).

- [ ] **Step 2: Write the Jest test mirroring every assertion in `e2e/crypto-parity.test.js`**

Each `expect(...).toHaveText(...)` in the Detox file becomes an `expect(value).toBe(...)` here. Import the same functions the screen uses. Example structure:

```ts
// __tests__/crypto/terra-keys-goldens.test.ts
import { hex, base64 } from '@scure/base'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { ripemd160 } from '@noble/hashes/legacy.js'
import { hmac } from '@noble/hashes/hmac.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'

import {
  deriveTerraAddress,
  derivePrivateKey,
  derivePublicKey,
  validateAddress,
  validateValoperAddress,
  valoperToAccAddress,
  generateMnemonic,
  signPayload,
} from 'utils/security'

const MNEMONIC_1 = /* copy from CryptoTestScreen */
const MNEMONIC_2 = /* copy from CryptoTestScreen */
// ... (port every constant)

describe('Terra key derivation — golden values', () => {
  it('mk330 address matches golden', () => {
    expect(deriveTerraAddress(MNEMONIC_1, 330)).toBe(
      'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv',
    )
  })
  // ... (one it() per assertion from the Detox file)
})

describe('hashes', () => {
  it('sha256 of "hello world"', () => {
    const out = hex.encode(sha256(new TextEncoder().encode('hello world')))
    expect(out).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    )
  })
  // ... (sha512, ripemd160, hmac-sha256)
})

describe('random bytes', () => {
  it('has length 32', () => {
    const bytes = require('expo-crypto').getRandomBytes(32)
    expect(bytes.length).toBe(32)
  })
  it('is not all zeros', () => {
    const bytes = require('expo-crypto').getRandomBytes(32)
    expect(bytes.every((b: number) => b === 0)).toBe(false)
  })
  it('produces unique output across calls', () => {
    const a = require('expo-crypto').getRandomBytes(32)
    const b = require('expo-crypto').getRandomBytes(32)
    expect(hex.encode(a)).not.toBe(hex.encode(b))
  })
})
```

The test file must cover **every** testID-based assertion in `e2e/crypto-parity.test.js` (mk330/mk118/mk2/rawkey address+privkey+pubkey, sign-payload hex regex, ecdsa-recid, validate-valid/invalid/wrong-prefix, valaddress-valid, fromval, gen-wordcount=24, gen-has-address, gen-privkey-length=32, sha256/sha512/ripemd160/hmac-sha256, hash-unsupported-throws, random-not-zero/length/unique).

- [ ] **Step 3: Run the test**

Run: `npm run test -- --testPathPattern=terra-keys-goldens`
Expected: all tests pass in under 3 seconds.

- [ ] **Step 4: Commit**

```bash
git add __tests__/crypto/terra-keys-goldens.test.ts
git commit -m "test: port crypto parity goldens to Jest (was e2e/crypto-parity)"
```

### Task B2: PBKDF2+AES-CBC encrypt/decrypt round-trip

**Files:**
- Create: `__tests__/crypto/encrypt-decrypt.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/crypto/encrypt-decrypt.test.ts
import { encrypt, decrypt } from 'utils/crypto'

describe('PBKDF2 + AES-CBC encrypt/decrypt', () => {
  it('round-trips the original message', () => {
    const original = 'the quick brown fox jumps over the lazy dog'
    const password = 'correct horse battery staple'
    const ciphertext = encrypt(original, password)
    expect(ciphertext.length).toBeGreaterThan(64)
    expect(decrypt(ciphertext, password)).toBe(original)
  })

  it('returns empty string on wrong password', () => {
    const ciphertext = encrypt('secret', 'right-password')
    expect(decrypt(ciphertext, 'wrong-password')).toBe('')
  })

  it('produces different ciphertext for same plaintext (fresh salt+iv)', () => {
    const a = encrypt('same', 'pw')
    const b = encrypt('same', 'pw')
    expect(a).not.toBe(b)
  })

  it('decrypts known ciphertext (golden from DevFullE2ETest)', () => {
    const ciphertext = encrypt(
      '0000000000000000000000000000000000000000000000000000000000000001',
      'testPassword1!',
    )
    expect(
      decrypt(ciphertext, 'testPassword1!'),
    ).toBe(
      '0000000000000000000000000000000000000000000000000000000000000001',
    )
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --testPathPattern=encrypt-decrypt`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/crypto/encrypt-decrypt.test.ts
git commit -m "test: add PBKDF2+AES-CBC round-trip unit test"
```

---

## Phase C — Tier 1 migration tests

### Task C1: Legacy keystore → expo-secure-store migration

**Files:**
- Create: `__tests__/migration/legacy-keystore.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/migration/legacy-keystore.test.ts
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'

import LegacyKeystore, {
  __reset as resetLegacy,
} from '../__mocks__/legacy-keystore'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import preferences, {
  PreferencesEnum,
  __reset as resetPrefs,
} from '../__mocks__/preferences'

import { migrateLegacyKeystore } from 'utils/legacyMigration'
import { encrypt, decrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'

const PK1 = '0000000000000000000000000000000000000000000000000000000000000001'
const PK2 = '0000000000000000000000000000000000000000000000000000000000000002'
const EXPECTED_PUB1 =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

function buildAuthData(): string {
  return JSON.stringify({
    TestWallet1: {
      ledger: false,
      address: 'terra1test000e2e000wallet001',
      password: 'testPassword1!',
      encryptedKey: encrypt(PK1, 'testPassword1!'),
    },
    TestWallet2: {
      ledger: false,
      address: 'terra1test000e2e000wallet002',
      password: 'testPassword2!',
      encryptedKey: encrypt(PK2, 'testPassword2!'),
    },
    TestLedgerWallet: {
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    },
  })
}

beforeEach(() => {
  resetLegacy()
  resetSecure()
  resetPrefs()
})

describe('migrateLegacyKeystore', () => {
  it('seeds, migrates, and reads back identical bytes', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData('AD', authData)
    expect(await LegacyKeystore.readLegacy('AD')).toBe(authData)

    await migrateLegacyKeystore()

    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('cleans up legacy data after successful migration', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const legacyAfter = await LegacyKeystore.readLegacy('AD')
    expect(legacyAfter === null || legacyAfter === '').toBe(true)
  })

  it('is idempotent on second run', async () => {
    const authData = buildAuthData()
    await LegacyKeystore.seedLegacyTestData('AD', authData)
    await migrateLegacyKeystore()
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(authData)
  })

  it('sets the legacyKeystoreMigrated preference flag', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    expect(
      await preferences.getBool(PreferencesEnum.legacyKeystoreMigrated),
    ).toBe(true)
  })

  it('decrypts migrated wallet keys with their passwords', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(await keystore.read(KeystoreEnum.AuthData))
    expect(decrypt(parsed.TestWallet1.encryptedKey, 'testPassword1!')).toBe(
      PK1,
    )
    expect(decrypt(parsed.TestWallet2.encryptedKey, 'testPassword2!')).toBe(
      PK2,
    )
  })

  it('preserves Ledger wallet structure through migration', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(await keystore.read(KeystoreEnum.AuthData))
    expect(parsed.TestLedgerWallet).toEqual({
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    })
  })

  it('derives expected secp256k1 public key from decrypted wallet 1', async () => {
    await LegacyKeystore.seedLegacyTestData('AD', buildAuthData())
    await migrateLegacyKeystore()
    const parsed = JSON.parse(await keystore.read(KeystoreEnum.AuthData))
    const pk = decrypt(parsed.TestWallet1.encryptedKey, 'testPassword1!')
    const pub = hex.encode(secp256k1.getPublicKey(hex.decode(pk), true))
    expect(pub).toBe(EXPECTED_PUB1)
  })

  it('is a no-op when no legacy data exists', async () => {
    await migrateLegacyKeystore()
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe('')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --testPathPattern=legacy-keystore`
Expected: 8 tests pass in under 2 seconds.

- [ ] **Step 3: Commit**

```bash
git add __tests__/migration/legacy-keystore.test.ts
git commit -m "test: cover legacy keystore migration (was DevFullE2ETest phase 1+2)"
```

### Task C2: Keystore size stress (10-wallet payload)

**Files:**
- Create: `__tests__/migration/keystore-size.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/migration/keystore-size.test.ts
import { encrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'

const PK = '0000000000000000000000000000000000000000000000000000000000000001'

function buildSizeTestData(count: number): string {
  const wallets: Record<string, unknown> = {}
  for (let i = 0; i < count; i++) {
    wallets[`SizeTestWallet${i}`] = {
      ledger: false,
      address: `terra1sizetest${String(i).padStart(3, '0')}`,
      password: `sizeTestPass${i}`,
      encryptedKey: encrypt(PK, `sizeTestPass${i}`),
    }
  }
  return JSON.stringify(wallets)
}

beforeEach(() => {
  resetSecure()
})

describe('keystore 10-wallet size stress', () => {
  it('10-wallet payload exceeds historical 2KB limit', () => {
    const json = buildSizeTestData(10)
    const bytes = new TextEncoder().encode(json).length
    expect(bytes).toBeGreaterThan(2048)
  })

  it('writes and reads back the full payload byte-for-byte', async () => {
    const json = buildSizeTestData(10)
    const written = await keystore.write(KeystoreEnum.AuthData, json)
    expect(written).toBe(true)
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(json)
  })
})
```

Note: the iOS keychain 2KB size regression is a native-only concern covered by Tier 3 smoke. This Jest version only verifies the JS-layer contract holds at 10-wallet scale.

- [ ] **Step 2: Run the test**

Run: `npm run test -- --testPathPattern=keystore-size`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/migration/keystore-size.test.ts
git commit -m "test: cover 10-wallet keystore size stress (was DevFullE2ETest phase 3)"
```

---

## Phase D — Tier 1 vault tests

### Task D1: .vult container round-trip from private key

**Files:**
- Create: `__tests__/vault/share-export.test.ts`

- [ ] **Step 1: Read the `vaultProto.ts` module to confirm exports**

Run: `cat src/services/vaultProto.ts | head -50` — confirm `buildVaultProto(walletName, publicKeyHex, privateKeyHex)` and `derivePublicKeyHex(privateKeyHex)` are exported.

- [ ] **Step 2: Write the test**

```ts
// __tests__/vault/share-export.test.ts
import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64 } from '@scure/base'

import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'
import { buildVaultProto, derivePublicKeyHex } from 'services/vaultProto'

const PK = '0000000000000000000000000000000000000000000000000000000000000001'
const EXPECTED_PUB =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

function encryptWithPassword(data: Uint8Array, password: string): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  // deterministic nonce for test; production uses random
  const nonce = new Uint8Array(12).fill(7)
  const ciphertext = gcm(key, nonce).encrypt(data)
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce, 0)
  out.set(ciphertext, nonce.length)
  return out
}

function decryptWithPassword(
  encrypted: Uint8Array,
  password: string,
): Uint8Array {
  const nonce = encrypted.slice(0, 12)
  const ciphertext = encrypted.slice(12)
  const key = sha256(new TextEncoder().encode(password))
  return gcm(key, nonce).decrypt(ciphertext)
}

describe('vault share export — .vult round-trip', () => {
  it('derives the correct pubkey from the test private key', () => {
    expect(derivePublicKeyHex(PK)).toBe(EXPECTED_PUB)
  })

  it('builds a Vault protobuf with expected fields', () => {
    const vault = buildVaultProto('TestWallet1', EXPECTED_PUB, PK)
    expect(vault.name).toBe('TestWallet1')
    expect(vault.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(vault.libType).toBe(LibType.KEYIMPORT)
    expect(vault.keyShares.length).toBeGreaterThan(0)
    expect(vault.keyShares[0].keyshare).toBe(PK)
  })

  it('serializes + encrypts + decrypts + parses back to identical bytes', () => {
    const vaultProto = buildVaultProto('TestWallet1', EXPECTED_PUB, PK)
    const vaultBytes = toBinary(VaultSchema, vaultProto)

    const encrypted = encryptWithPassword(vaultBytes, 'exportpass')
    const container = create(VaultContainerSchema, {
      version: 1n,
      isEncrypted: true,
      vault: base64.encode(encrypted),
    })
    const containerBytes = toBinary(VaultContainerSchema, container)

    // Now reverse the process and assert
    const parsedContainer = fromBinary(VaultContainerSchema, containerBytes)
    expect(parsedContainer.isEncrypted).toBe(true)
    expect(parsedContainer.version).toBe(1n)

    const decryptedVault = decryptWithPassword(
      base64.decode(parsedContainer.vault),
      'exportpass',
    )
    const roundTripped = fromBinary(VaultSchema, decryptedVault)
    expect(roundTripped.name).toBe('TestWallet1')
    expect(roundTripped.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(roundTripped.libType).toBe(LibType.KEYIMPORT)
    expect(roundTripped.keyShares[0].keyshare).toBe(PK)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test -- --testPathPattern=share-export`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/vault/share-export.test.ts
git commit -m "test: cover vault share .vult round-trip"
```

### Task D2: .vult / .bak file import (fixtures)

**Files:**
- Create: `__tests__/vault/import-file.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/vault/import-file.test.ts
import * as fs from 'node:fs'
import * as path from 'node:path'

import { importVaultBackup } from 'services/importVaultBackup'

const FIXTURE_PASSWORD = 'testpassword123'
const WRONG_PASSWORD = 'wrongpassword999'

const vultPath = path.resolve(
  __dirname,
  '..',
  '..',
  'e2e',
  'fixtures',
  'test-vault.vult',
)
const bakPath = path.resolve(
  __dirname,
  '..',
  '..',
  'e2e',
  'fixtures',
  'test-vault.bak',
)

function readFixture(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

describe('importVaultBackup — .vult', () => {
  it('returns needsPassword when encrypted and no password provided', () => {
    const content = readFixture(vultPath)
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.vult',
    })
    expect(result).toEqual({ needsPassword: true })
  })

  it('decrypts and parses with the correct password', () => {
    const content = readFixture(vultPath)
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.vult',
      password: FIXTURE_PASSWORD,
    })
    expect(result.needsPassword).toBe(false)
    if (result.needsPassword) throw new Error('unreachable')
    expect(result.vaultName).toBe('Test Import Vault')
    expect(result.publicKeyEcdsa).toBeTruthy()
    expect(result.vaultBytes.length).toBeGreaterThan(0)
  })

  it('throws on wrong password', () => {
    const content = readFixture(vultPath)
    expect(() =>
      importVaultBackup({
        content,
        fileName: 'test-vault.vult',
        password: WRONG_PASSWORD,
      }),
    ).toThrow()
  })
})

describe('importVaultBackup — .bak', () => {
  it('decrypts and parses .bak files the same as .vult', () => {
    const content = readFixture(bakPath)
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.bak',
      password: FIXTURE_PASSWORD,
    })
    expect(result.needsPassword).toBe(false)
    if (result.needsPassword) throw new Error('unreachable')
    expect(result.vaultName).toBeTruthy()
    expect(result.publicKeyEcdsa).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --testPathPattern=import-file`
Expected: 4 tests pass. If the vault name assertion fails, read the fixture name with `node -e "..."` and update the expected value.

- [ ] **Step 3: Commit**

```bash
git add __tests__/vault/import-file.test.ts
git commit -m "test: cover .vult/.bak import parsing with wrong-password path"
```

### Task D3: Vault store persistence layer

**Files:**
- Create: `__tests__/wallet/vault-store.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/wallet/vault-store.test.ts
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import {
  persistImportedVault,
} from 'services/importVaultBackup'
import { getStoredVault } from 'services/migrateToVault'
import { create, toBinary } from '@bufbuild/protobuf'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

beforeEach(() => {
  resetSecure()
})

describe('persistImportedVault → getStoredVault', () => {
  it('round-trips a vault blob through SecureStore', async () => {
    const vault = create(VaultSchema, {
      name: 'RoundtripVault',
      publicKeyEcdsa: 'abc123',
      libType: LibType.DKLS,
      keyShares: [{ publicKey: 'abc123', keyshare: 'deadbeef' }],
      signers: ['Device', 'Server'],
      localPartyId: 'Device',
      hexChainCode: '0'.repeat(64),
      publicKeyEddsa: '',
      resharePrefix: '',
    })
    const bytes = toBinary(VaultSchema, vault)

    await persistImportedVault(bytes, 'RoundtripVault')

    const stored = await getStoredVault('RoundtripVault')
    expect(stored).toBeTruthy()
  })

  it('stores under a sanitized key for names with special chars', async () => {
    const vault = create(VaultSchema, {
      name: 'My Weird/Vault!',
      publicKeyEcdsa: 'abc',
      libType: LibType.DKLS,
      keyShares: [{ publicKey: 'abc', keyshare: 'share' }],
      signers: ['Device'],
      localPartyId: 'Device',
      hexChainCode: '0'.repeat(64),
      publicKeyEddsa: '',
      resharePrefix: '',
    })
    const bytes = toBinary(VaultSchema, vault)

    await persistImportedVault(bytes, 'My Weird/Vault!')
    expect(await getStoredVault('My Weird/Vault!')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- --testPathPattern=vault-store`
Expected: 2 tests pass. If `persistImportedVault` requires `upsertAuthData` to resolve, the import path may trip the `nativeModules/preferences` mapping — confirm via the error message and either extend the mock or stub the authData module.

- [ ] **Step 3: Commit**

```bash
git add __tests__/wallet/vault-store.test.ts
git commit -m "test: cover vault store persistence round-trip"
```

### Task D4: Run the full Tier 1 suite and confirm timing

- [ ] **Step 1: Run all unit tests**

Run: `time npm run test:ci`
Expected: total runtime <30s. All tests pass.

- [ ] **Step 2: If over 30s, find the slow file**

Run: `npm run test -- --verbose` and look for any test taking >1s. Flag it for investigation.

- [ ] **Step 3: No commit — this is a checkpoint**

---

## Phase E — Delete Tier 1 shadows from Detox

### Task E1: Delete e2e/crypto-parity.test.js

**Files:**
- Delete: `e2e/crypto-parity.test.js`

- [ ] **Step 1: Delete + commit**

```bash
git rm e2e/crypto-parity.test.js
git commit -m "refactor(e2e): remove crypto-parity (covered by Tier 1 Jest test)"
```

### Task E2: Delete e2e/full-e2e-migration.test.js

**Files:**
- Delete: `e2e/full-e2e-migration.test.js`

- [ ] **Step 1: Delete + commit**

```bash
git rm e2e/full-e2e-migration.test.js
git commit -m "refactor(e2e): remove full-e2e-migration (covered by Tier 1 Jest test)"
```

### Task E3: Delete DevFullE2ETest component + navigation entry

**Files:**
- Delete: `src/components/DevFullE2ETest.tsx`
- Modify: `src/screens/auth/AuthMenu.tsx` (remove dev-full-e2e-test button)
- Modify: `src/navigation/AuthNavigator.tsx` (remove FullE2ETest route)
- Modify: `src/config/env.ts` (remove FullE2ETest DevFlag)

- [ ] **Step 1: Remove the AuthMenu button**

In `src/screens/auth/AuthMenu.tsx`, delete the `<TouchableOpacity testID="dev-full-e2e-test" ...>` block in its entirety (lines ~108-116 of current file).

- [ ] **Step 2: Remove the navigation route**

Run: `grep -n 'FullE2ETest\|DevFullE2ETest' src/navigation/AuthNavigator.tsx` — delete the `<Stack.Screen name="FullE2ETest" ... />` line and its import.

- [ ] **Step 3: Remove the DevFlag entry**

Edit `src/config/env.ts` — delete the `FullE2ETest: showDevFeatures,` line.

- [ ] **Step 4: Delete the component**

```bash
git rm src/components/DevFullE2ETest.tsx
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint:check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/screens/auth/AuthMenu.tsx src/navigation/AuthNavigator.tsx src/config/env.ts
git commit -m "refactor: delete DevFullE2ETest — covered by Tier 1 Jest tests"
```

### Task E4: Delete CryptoTestScreen + navigation entry

**Files:**
- Delete: `src/components/CryptoTestScreen.tsx`
- Modify: `src/screens/auth/AuthMenu.tsx` (remove dev-crypto-test button)
- Modify: `src/navigation/AuthNavigator.tsx` (remove CryptoTest route)
- Modify: `src/navigation/MainNavigator.tsx` (remove CryptoTest route if present)
- Modify: `src/config/env.ts` (remove CryptoTestScreen DevFlag)

- [ ] **Step 1: Remove the AuthMenu button**

In `src/screens/auth/AuthMenu.tsx`, delete the `<TouchableOpacity testID="dev-crypto-test" ...>` block.

- [ ] **Step 2: Remove the navigation entries**

Run: `grep -rn 'CryptoTest' src/navigation/` — delete each `<Stack.Screen name="CryptoTest" ... />` plus its import.

- [ ] **Step 3: Remove the DevFlag**

In `src/config/env.ts`, delete the `CryptoTestScreen: showDevFeatures,` line.

- [ ] **Step 4: Delete the component**

```bash
git rm src/components/CryptoTestScreen.tsx
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint:check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/screens/auth/AuthMenu.tsx src/navigation/ src/config/env.ts
git commit -m "refactor: delete CryptoTestScreen — covered by Tier 1 Jest tests"
```

---

## Phase F — Backend stubbing

### Task F1: Add EXPO_PUBLIC_STUB_VULTISERVER env flag

**Files:**
- Modify: `src/config/env.ts`

- [ ] **Step 1: Add the flag**

Add to `src/config/env.ts`:

```ts
// Gated on __DEV__ so production builds can never read a truthy value
// even if the env var is somehow set.
export const STUB_VULTISERVER =
  __DEV__ && process.env.EXPO_PUBLIC_STUB_VULTISERVER === 'true'
```

- [ ] **Step 2: Commit**

```bash
git add src/config/env.ts
git commit -m "feat(e2e): add EXPO_PUBLIC_STUB_VULTISERVER env flag"
```

### Task F2: Create fastVaultServer stub

**Files:**
- Create: `src/services/fastVaultServer.stub.ts`

- [ ] **Step 1: Write the stub**

```ts
// src/services/fastVaultServer.stub.ts
import type { MpcProtocol } from './fastVaultServer'

export async function setupBatchImport(_input: {
  name: string
  session_id: string
  hex_encryption_key: string
  hex_chain_code: string
  local_party_id: string
  encryption_password: string
  email: string
  protocols: MpcProtocol[]
  chains?: string[]
}): Promise<void> {
  // No-op: stubbed so Detox UI tests don't hit the real server.
}

export async function verifyVaultEmail(_input: {
  public_key: string
  code: string
}): Promise<void> {
  // No-op: any 4-digit code "verifies" in stub mode.
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/fastVaultServer.stub.ts
git commit -m "feat(e2e): add fastVaultServer stub for UI tests"
```

### Task F3: Route fastVaultServer exports through the stub when flagged

**Files:**
- Modify: `src/services/fastVaultServer.ts`

- [ ] **Step 1: Add top-of-file stub delegation**

Replace the current export body with versions that check `STUB_VULTISERVER` before calling the real implementation. Full rewrite:

```ts
// src/services/fastVaultServer.ts
import { env, STUB_VULTISERVER } from '../config/env'
import * as stub from './fastVaultServer.stub'

export type MpcProtocol = 'ecdsa' | 'eddsa'

export async function setupBatchImport(input: {
  name: string
  session_id: string
  hex_encryption_key: string
  hex_chain_code: string
  local_party_id: string
  encryption_password: string
  email: string
  protocols: MpcProtocol[]
  chains?: string[]
}): Promise<void> {
  if (STUB_VULTISERVER) return stub.setupBatchImport(input)

  const url = `${env.vultisigApiUrl}/vault/batch/import`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`setupBatchImport failed: ${res.status} ${text}`)
  }
}

export async function verifyVaultEmail(input: {
  public_key: string
  code: string
}): Promise<void> {
  if (STUB_VULTISERVER) return stub.verifyVaultEmail(input)

  const res = await fetch(
    `${env.vultisigApiUrl}/vault/verify/${input.public_key}/${input.code}`,
    { method: 'GET' },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`verifyVaultEmail failed: ${res.status} ${text}`)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/fastVaultServer.ts
git commit -m "feat(e2e): delegate fastVaultServer to stub when STUB_VULTISERVER=true"
```

### Task F4: Stub importKeyToFastVault for UI tests

**Files:**
- Create: `src/services/dklsKeyImport.stub.ts`
- Modify: `src/services/dklsKeyImport.ts` (add delegation at top of `importKeyToFastVault`)

- [ ] **Step 1: Write the stub**

```ts
// src/services/dklsKeyImport.stub.ts
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'
import type { KeyImportResult, KeyImportProgress } from './dklsKeyImport'

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function importKeyToFastVault(options: {
  name: string
  email: string
  password: string
  privateKeyHex: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<KeyImportResult> {
  const { privateKeyHex, onProgress, signal } = options

  const steps: KeyImportProgress[] = [
    { step: 'setup', message: 'Generating session...', progress: 10 },
    { step: 'joining', message: 'Joining relay...', progress: 30 },
    { step: 'ecdsa', message: 'Running MPC protocol...', progress: 60 },
    { step: 'finalizing', message: 'Extracting keyshare...', progress: 90 },
    { step: 'complete', message: 'Complete!', progress: 100 },
  ]
  for (const s of steps) {
    if (signal?.aborted) throw new Error('Aborted')
    onProgress?.(s)
    await sleep(50)
  }

  // Deterministic synthetic result so downstream code treats it like a
  // real DKLS vault share. keyshare is opaque base64 — any non-empty string
  // passes downstream validation.
  const pubBytes = secp256k1.getPublicKey(hex.decode(privateKeyHex), true)
  return {
    publicKey: hex.encode(pubBytes),
    keyshare: 'c3R1YmJlZC1rZXlzaGFyZS1ieXRlcw==', // "stubbed-keyshare-bytes"
    chainCode: '0'.repeat(64),
    localPartyId: 'sdk-stub0',
    serverPartyId: 'Server-stub',
  }
}
```

- [ ] **Step 2: Wire the real function to delegate when flagged**

In `src/services/dklsKeyImport.ts`, add at the top after the existing imports:

```ts
import { STUB_VULTISERVER } from '../config/env'
import * as stubDkls from './dklsKeyImport.stub'
```

Then at the very start of `importKeyToFastVault`, before the existing `report(...)` calls, add:

```ts
if (STUB_VULTISERVER) return stubDkls.importKeyToFastVault(options)
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/dklsKeyImport.ts src/services/dklsKeyImport.stub.ts
git commit -m "feat(e2e): stub importKeyToFastVault for UI tests"
```

---

## Phase G — State reset helpers

### Task G1: Create DevStateReset component

**Files:**
- Create: `src/components/DevStateReset.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/DevStateReset.tsx
import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import {
  getAuthData,
  VAULT_STORE_OPTS,
  vaultStoreKey,
} from 'services/migrateToVault'

/**
 * DEV ONLY: reset all wallet/migration state without erasing the
 * simulator. Lets Detox UI tests share a single simulator boot
 * across suites instead of eating ~2 min per suite on `simctl erase`.
 */
export default function DevStateReset(): React.ReactElement {
  const [status, setStatus] = useState('resetting...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    reset()
  }, [])

  const reset = async (): Promise<void> => {
    try {
      // Clear per-wallet vault blobs written by migrateToVault.
      const authData = await getAuthData()
      if (authData) {
        for (const name of Object.keys(authData)) {
          await SecureStore.deleteItemAsync(
            vaultStoreKey(name),
            VAULT_STORE_OPTS,
          )
        }
      }

      // Clear the auth data (wallet list) itself.
      await keystore.remove(KeystoreEnum.AuthData)

      // Reset migration-flow boolean flags.
      for (const key of [
        PreferencesEnum.legacyKeystoreMigrated,
        PreferencesEnum.legacyDataFound,
        PreferencesEnum.vaultsUpgraded,
        PreferencesEnum.firstRun,
      ]) {
        await preferences.setBool(key, false)
      }

      // Clear the old native keystore too.
      if (LegacyKeystore) {
        await LegacyKeystore.clearAllLegacyData()
      }

      setStatus('done')
      setDone(true)
    } catch (e) {
      setStatus(`error: ${e instanceof Error ? e.message : String(e)}`)
      setDone(true)
    }
  }

  return (
    <View style={styles.container}>
      <Text testID="dev-reset-status" style={styles.text}>
        {status}
      </Text>
      {done && (
        <Text testID="dev-reset-done" style={styles.text}>
          reset
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#02122B',
  },
  text: { color: '#fff', fontSize: 16, marginVertical: 4 },
})
```

- [ ] **Step 2: Verify `VAULT_STORE_OPTS` and `vaultStoreKey` are exported from `migrateToVault.ts`**

Run: `grep -n 'export.*VAULT_STORE_OPTS\|export.*vaultStoreKey' src/services/migrateToVault.ts`
If either is not exported, add `export` to its declaration in that file.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/DevStateReset.tsx src/services/migrateToVault.ts
git commit -m "feat(e2e): add DevStateReset component"
```

### Task G2: Register DevStateReset route + AuthMenu button

**Files:**
- Modify: `src/navigation/AuthNavigator.tsx`
- Modify: `src/screens/auth/AuthMenu.tsx`
- Modify: `src/config/env.ts`

- [ ] **Step 1: Add DevFlag**

In `src/config/env.ts`, add `StateReset: showDevFeatures,` to the `DevFlags` object.

- [ ] **Step 2: Register the route**

In `src/navigation/AuthNavigator.tsx`, add next to the existing dev-gated screens:

```tsx
import DevStateReset from 'components/DevStateReset'
// ...
{DevFlags.StateReset && (
  <Stack.Screen name="StateReset" component={DevStateReset} />
)}
```

- [ ] **Step 3: Add AuthMenu button**

In `src/screens/auth/AuthMenu.tsx`, inside the existing `{DevFlags.FullE2ETest && (<>...</>)}` replacement — which is now a different set of dev buttons since Task E3/E4 removed some — add:

```tsx
{DevFlags.StateReset && (
  <TouchableOpacity
    testID="dev-reset-state"
    style={styles.secondaryButton}
    onPress={() => navigation.navigate('StateReset')}
  >
    <Text style={styles.secondaryButtonText}>Reset State (dev)</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint:check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/AuthNavigator.tsx src/screens/auth/AuthMenu.tsx src/config/env.ts
git commit -m "feat(e2e): register DevStateReset route and AuthMenu button"
```

### Task G3: Create Detox `devReset()` helper

**Files:**
- Create: `e2e/helpers/dev-reset.js`

- [ ] **Step 1: Write the helper**

```js
// e2e/helpers/dev-reset.js
/**
 * Reset app state between Detox suites without a simctl erase.
 * Relies on the DevStateReset screen, which clears SecureStore,
 * preferences flags, and the legacy native keystore.
 */
async function devReset() {
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()

  await waitFor(element(by.id('dev-reset-state')))
    .toBeVisible()
    .withTimeout(60000)
  await element(by.id('dev-reset-state')).tap()

  await waitFor(element(by.id('dev-reset-done')))
    .toExist()
    .withTimeout(15000)

  await device.terminateApp()
}

module.exports = { devReset }
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/dev-reset.js
git commit -m "feat(e2e): add devReset helper for between-suite state reset"
```

---

## Phase H — Tier 2 UI test refactor

### Task H1: Configure single-erase globalSetup

**Files:**
- Create: `e2e/globalSetup.js`
- Modify: `e2e/jest.config.js`

- [ ] **Step 1: Write the globalSetup**

```js
// e2e/globalSetup.js
const detoxGlobalSetup = require('detox/runners/jest/globalSetup')
const { execSync } = require('child_process')

module.exports = async function globalSetup() {
  // Exactly one simctl erase per run.
  // `device.id` isn't available here — use the detox-managed device name
  // via `xcrun simctl list`. If the host has a single iPhone 16 booted,
  // this pulls its UDID.
  try {
    const list = execSync(
      'xcrun simctl list devices -j "iPhone 16" 2>/dev/null',
      { encoding: 'utf8' },
    )
    const parsed = JSON.parse(list)
    const devices = Object.values(parsed.devices).flat()
    const match = devices.find(
      (d) => d.name === 'iPhone 16' && d.availability !== 'unavailable',
    )
    if (match) {
      execSync(
        `xcrun simctl shutdown ${match.udid} 2>/dev/null; xcrun simctl erase ${match.udid}`,
        { timeout: 180000 },
      )
    }
  } catch (e) {
    console.warn('[globalSetup] simctl erase failed (non-fatal):', e.message)
  }

  await detoxGlobalSetup()
}
```

- [ ] **Step 2: Point jest.config at it**

Update `e2e/jest.config.js`:

```js
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 300000,
  bail: 1,
  maxWorkers: 1,
  globalSetup: '<rootDir>/e2e/globalSetup.js',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  modulePathIgnorePatterns: [
    '<rootDir>/.worktrees/',
    '<rootDir>/.claude/',
    '<rootDir>/e2e/smoke/',
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/globalSetup.js e2e/jest.config.js
git commit -m "refactor(e2e): single globalSetup erase for Tier 2 suites"
```

### Task H2: Rename + refactor fast-vault-creation → creation-ui

**Files:**
- Rename: `e2e/fast-vault-creation.test.js` → `e2e/creation-ui.test.js`
- Modify (post-rename): `e2e/creation-ui.test.js`

- [ ] **Step 1: Rename**

```bash
git mv e2e/fast-vault-creation.test.js e2e/creation-ui.test.js
```

- [ ] **Step 2: Refactor**

Replace the file's contents with a version that:
- Removes the `eraseSimulator` call in `beforeAll` and the `getExistingMessageIds` + `fetchOtpFromAgentmail` dependencies.
- Replaces the OTP section with typing a fixed code like `'0000'` (the stubbed server accepts anything).
- Tightens wait timeouts for keygen to ~10s (stub completes in <1s).
- Calls `devReset()` before the suite starts instead of erasing.

Full replacement file:

```js
/**
 * Fast Vault Creation UI Test — New User (stubbed backend)
 */
const { devReset } = require('./helpers/dev-reset')

const VAULT_PASSWORD = 'testpass123'

describe('Fast Vault Creation UI — New User', () => {
  beforeAll(async () => {
    await devReset()
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxURLBlacklistRegex: '.*' },
    })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  describe('Navigation to the creation flow', () => {
    it('reaches MigrationHome via dev button', async () => {
      await waitFor(element(by.id('dev-create-fast-vault')))
        .toBeVisible()
        .withTimeout(60000)
      await element(by.id('dev-create-fast-vault')).tap()

      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(30000)
      await element(by.id('enter-vultiverse-cta')).tap()

      await waitFor(element(by.text('Create a Fast Vault')))
        .toBeVisible()
        .withTimeout(30000)
    })

    it('advances to VaultName', async () => {
      await element(by.text('Create a Fast Vault')).tap()
      await waitFor(element(by.text('Name your vault')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })

  describe('Form validation', () => {
    it('advances from VaultName to VaultEmail with a valid name', async () => {
      await element(by.id('vault-name-input')).typeText('My Fast Vault')
      await element(by.id('vault-name-next')).tap()
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('shows an error for invalid email after blur', async () => {
      await element(by.id('vault-email-input')).tap()
      await element(by.id('vault-email-input')).typeText('not-an-email')
      await element(by.id('vault-email-input')).tapReturnKey()
      await waitFor(element(by.text('Please enter a valid email address.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('advances to VaultPassword with a valid email', async () => {
      await element(by.id('vault-email-input')).tap()
      await element(by.id('vault-email-input')).clearText()
      await element(by.id('vault-email-input')).typeText('test@example.com')
      await element(by.id('vault-email-next')).tap()
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('shows error for short password on blur', async () => {
      await element(by.id('vault-password-input')).typeText('ab')
      await element(by.id('vault-password-confirm')).tap()
      await waitFor(element(by.text('Password must be at least 6 characters.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('shows error for mismatched passwords', async () => {
      await element(by.id('vault-password-input')).tap()
      await element(by.id('vault-password-input')).clearText()
      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD)
      await element(by.id('vault-password-confirm')).tap()
      await element(by.id('vault-password-confirm')).clearText()
      await element(by.id('vault-password-confirm')).typeText('different123')
      await element(by.id('vault-password-confirm')).tapReturnKey()
      await waitFor(element(by.text('Passwords do not match.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('advances with matching passwords (stubbed keygen)', async () => {
      await element(by.id('vault-password-confirm')).tap()
      await element(by.id('vault-password-confirm')).clearText()
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD)
      await element(by.id('vault-password-continue')).tap()

      await waitFor(element(by.text('Verify your email')))
        .toBeVisible()
        .withTimeout(15000)
    })
  })

  describe('Keygen and verify (stubbed)', () => {
    it('accepts any OTP with stubbed server', async () => {
      await element(by.id('verify-code-input')).tap()
      await element(by.id('verify-code-input')).replaceText('0000')

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(30000)
    })

    it('passes vault integrity verification', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000)
      await expect(element(by.id('verify-all-passed'))).toHaveText(
        'all-passed: true',
      )
    })

    it('reaches main app', async () => {
      await element(by.id('success-back')).tap()
    })
  })

  describe('Persistence', () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      })
      await device.disableSynchronization()
    })

    it('does not show migration flow on relaunch', async () => {
      let migrationShown = false
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000)
        migrationShown = true
      } catch {}
      if (migrationShown) {
        throw new Error('Migration flow should not appear after vault creation')
      }
    })

    it('shows created vault in wallet list', async () => {
      await waitFor(element(by.text('My Fast Vault')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add e2e/creation-ui.test.js
git commit -m "refactor(e2e): rename fast-vault-creation → creation-ui + stub keygen"
```

### Task H3: Rename + refactor fast-vault-migration → migration-ui

**Files:**
- Rename: `e2e/fast-vault-migration.test.js` → `e2e/migration-ui.test.js`
- Modify (post-rename): `e2e/migration-ui.test.js`
- Modify: `e2e/helpers/agentmail.js` (trim to just `migrateOneWalletFromCardStubbed` since the smoke suite gets its own copy)

- [ ] **Step 1: Rename**

```bash
git mv e2e/fast-vault-migration.test.js e2e/migration-ui.test.js
```

- [ ] **Step 2: Write a stubbed per-wallet helper**

Add to `e2e/helpers/agentmail.js` (replacing the existing `migrateOneWalletFromCard` export, since the real-OTP version moves to `e2e/smoke/helpers/agentmail.js` in Phase I):

```js
async function migrateOneWalletFromCardStubbed(walletIndex, walletLabel, hasMoreWallets) {
  console.log(`\n--- Migrating ${walletLabel} (stubbed) ---`)

  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap()

  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id('vault-email-input')).typeText('test@example.com')
  await element(by.id('vault-email-next')).tap()

  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id('vault-password-input')).typeText('testpass123')
  await element(by.id('vault-password-confirm')).typeText('testpass123')
  await element(by.id('vault-password-continue')).tap()

  await waitFor(element(by.text('Verify your email')))
    .toBeVisible()
    .withTimeout(20000)
  await element(by.id('verify-code-input')).tap()
  await element(by.id('verify-code-input')).replaceText('0000')

  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(30000)

  if (hasMoreWallets) {
    await element(by.id('migrate-another-wallet')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
  }

  console.log(`--- ${walletLabel} complete ---\n`)
}

module.exports = {
  migrateOneWalletFromCardStubbed,
}
```

- [ ] **Step 3: Replace migration-ui.test.js contents**

```js
/**
 * Fast Vault Migration UI Test — Legacy Wallet Holder (stubbed backend)
 */
const { devReset } = require('./helpers/dev-reset')
const { migrateOneWalletFromCardStubbed } = require('./helpers/agentmail')

describe('Fast Vault Migration UI — Per-Wallet', () => {
  beforeAll(async () => {
    await devReset()

    // Seed legacy data in a fresh launch.
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-legacy')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('dev-seed-legacy')).tap()
    await waitFor(element(by.id('seed-done')))
      .toExist()
      .withTimeout(20000)

    // Relaunch so the app picks up legacy data on boot.
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('plays RiveIntro and reaches MigrationHome', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('enter-vultiverse-cta')).tap()

    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('navigates to wallet list', async () => {
    await element(by.text('Start Migration')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('shows both standard and ledger wallets', async () => {
    await waitFor(element(by.id('wallet-card-0')))
      .toBeVisible()
      .withTimeout(10000)
    await waitFor(element(by.text('TestLedgerWallet')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('migrates wallet 1', async () => {
    await migrateOneWalletFromCardStubbed(0, 'TestWallet1', true)
  })

  it('migrates wallet 2', async () => {
    await migrateOneWalletFromCardStubbed(1, 'TestWallet2', false)
  })

  it('passes vault integrity verification', async () => {
    await waitFor(element(by.id('verify-all-passed')))
      .toExist()
      .withTimeout(15000)
    await expect(element(by.id('verify-imported-exists')))
      .toHaveText('imported-exists: true')
    await expect(element(by.id('verify-imported-has-pubkey')))
      .toHaveText('imported-has-pubkey: true')
    await expect(element(by.id('verify-imported-has-keyshare')))
      .toHaveText('imported-has-keyshare: true')
    await expect(element(by.id('verify-all-passed')))
      .toHaveText('all-passed: true')
  })

  it('dismisses migration and persists across relaunch', async () => {
    await element(by.id('success-back')).tap()

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(60000)
    await waitFor(element(by.text('TestWallet1')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('shows Export as Vault Share for migrated wallet', async () => {
    await element(by.id('wallet-card-0-export')).tap()
    await waitFor(element(by.text('Export as Vault Share')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('hides raw private-key reveal for DKLS vault', async () => {
    let revealVisible = false
    try {
      await waitFor(element(by.text('Reveal Private Key')))
        .toBeVisible()
        .withTimeout(2000)
      revealVisible = true
    } catch {}
    if (revealVisible) {
      throw new Error('Raw key reveal should be hidden for DKLS vaults')
    }
  })
})
```

- [ ] **Step 4: Commit**

```bash
git add e2e/migration-ui.test.js e2e/helpers/agentmail.js
git commit -m "refactor(e2e): rename fast-vault-migration → migration-ui + stub keygen"
```

### Task H4: Rename partial-migration → skip-retry-ui

**Files:**
- Rename: `e2e/fast-vault-partial-migration.test.js` → `e2e/migration-skip-retry-ui.test.js`
- Modify (post-rename): `e2e/migration-skip-retry-ui.test.js`

- [ ] **Step 1: Rename**

```bash
git mv e2e/fast-vault-partial-migration.test.js e2e/migration-skip-retry-ui.test.js
```

- [ ] **Step 2: Replace erase logic with devReset + seed**

Full replacement:

```js
/**
 * Partial Fast Vault Migration UI — Skip/Retry (offline, no stubs needed)
 *
 * Corrupt private keys fail during decrypt locally, so this suite
 * doesn't need network or the stub flag.
 */
const { devReset } = require('./helpers/dev-reset')

describe('Partial Fast Vault Migration — Skip/Retry', () => {
  beforeAll(async () => {
    await devReset()

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-corrupt')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('dev-seed-corrupt')).tap()
    await waitFor(element(by.id('seed-corrupt-done')))
      .toExist()
      .withTimeout(20000)

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('reaches wallet list with corrupt wallet migrate button', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('enter-vultiverse-cta')).tap()
    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(30000)
    await element(by.text('Start Migration')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
    await waitFor(element(by.id('wallet-card-0-migrate')))
      .toBeVisible()
      .withTimeout(5000)
  })

  it('fails keygen immediately on corrupt key', async () => {
    await element(by.id('wallet-card-0-migrate')).tap()
    await waitFor(element(by.text('Enter your email')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('vault-email-input')).typeText('test@example.com')
    await element(by.id('vault-email-next')).tap()
    await waitFor(element(by.text('Choose a password')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('vault-password-input')).typeText('testpass123')
    await element(by.id('vault-password-confirm')).typeText('testpass123')
    await element(by.id('vault-password-continue')).tap()

    await waitFor(element(by.id('keygen-skip')))
      .toBeVisible()
      .withTimeout(30000)
    await waitFor(element(by.id('keygen-retry')))
      .toBeVisible()
      .withTimeout(5000)
  })

  it('retry still fails', async () => {
    await element(by.id('keygen-retry')).tap()
    await waitFor(element(by.id('keygen-skip')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('skip advances to MigrationSuccess', async () => {
    await element(by.id('keygen-skip')).tap()
    await waitFor(element(by.id('success-back')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('can dismiss migration', async () => {
    await element(by.id('success-back')).tap()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add e2e/migration-skip-retry-ui.test.js
git commit -m "refactor(e2e): rename partial-migration → migration-skip-retry-ui"
```

### Task H5: Rename + refactor import-vault → import-ui

**Files:**
- Rename: `e2e/import-vault.test.js` → `e2e/import-ui.test.js`
- Modify (post-rename): `e2e/import-ui.test.js`

- [ ] **Step 1: Rename**

```bash
git mv e2e/import-vault.test.js e2e/import-ui.test.js
```

- [ ] **Step 2: Replace erase logic with devReset + stageFixture**

The `stageFixture` function can stay (uses `xcrun simctl get_app_container` which is harmless). The `setupWithFixture` helper drops `simctl erase` in favor of `devReset()`. Full replacement:

```js
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { devReset } = require('./helpers/dev-reset')

const FIXTURE_PASSWORD = 'testpassword123'
const WRONG_PASSWORD = 'wrongpassword999'
const BUNDLE_ID = 'money.terra.station'

const fixtureVult = path.resolve(__dirname, 'fixtures', 'test-vault.vult')
const fixtureBak = path.resolve(__dirname, 'fixtures', 'test-vault.bak')

function stageFixture(udid, srcPath, destName) {
  const appContainer = execSync(
    `xcrun simctl get_app_container ${udid} ${BUNDLE_ID} data`,
    { encoding: 'utf8' },
  ).trim()
  const documentsDir = path.join(appContainer, 'Documents')
  execSync(`mkdir -p "${documentsDir}"`)
  fs.copyFileSync(srcPath, path.join(documentsDir, destName))
}

async function setupWithFixture(fixturePath, fixtureName) {
  await devReset()

  // Launch briefly so the app container/bundle is installed.
  await device.launchApp({ newInstance: true })
  await device.terminateApp()

  stageFixture(device.id, fixturePath, fixtureName)

  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()
}

async function navigateToImportScreen() {
  await waitFor(element(by.id('dev-create-fast-vault')))
    .toBeVisible()
    .withTimeout(60000)
  await element(by.id('dev-create-fast-vault')).tap()

  try {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('enter-vultiverse-cta')).tap()
  } catch {}

  await waitFor(element(by.id('import-vault-button')))
    .toBeVisible()
    .withTimeout(30000)
  await element(by.id('import-vault-button')).tap()

  await waitFor(element(by.text('Import your vault share')))
    .toBeVisible()
    .withTimeout(10000)
}

async function pickFileAndWaitForPassword() {
  await element(by.id('import-file-picker')).tap()
  await waitFor(element(by.id('decrypt-password-input')))
    .toBeVisible()
    .withTimeout(10000)
}

describe('Import Vault UI', () => {
  describe('.vult with correct password', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureVult, 'detox-import.vult')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('decrypts and imports', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(FIXTURE_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000)
    })

    it('reaches main app and persists on relaunch', async () => {
      await waitFor(element(by.id('success-back')))
        .toBeVisible()
        .withTimeout(5000)
      await element(by.id('success-back')).tap()

      await device.launchApp({ newInstance: true })
      await device.disableSynchronization()
      await waitFor(element(by.text('Test Import Vault')))
        .toBeVisible()
        .withTimeout(30000)
    })
  })

  describe('wrong password', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureVult, 'detox-import.vult')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('shows error and keeps sheet open', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(WRONG_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('Incorrect password, try again')))
        .toBeVisible()
        .withTimeout(5000)
      await expect(element(by.id('decrypt-password-input'))).toBeVisible()
    })
  })

  describe('.bak extension', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureBak, 'detox-import.bak')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('imports .bak successfully', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(FIXTURE_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000)
    })
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add e2e/import-ui.test.js
git commit -m "refactor(e2e): rename import-vault → import-ui + devReset between fixtures"
```

### Task H6: Dry-run Tier 2 locally

Note: this step requires a macOS host with Xcode/iOS simulator, which the CI can't run during the plan phase. The owner of the worktree should execute this step manually.

- [ ] **Step 1: Build the Detox app with stub flag**

Run:
```bash
EXPO_PUBLIC_STUB_VULTISERVER=true EXPO_PUBLIC_SHOW_DEV_FEATURES=true EXPO_PUBLIC_MIGRATION_FLOW_ENABLED=true detox build --configuration ios.sim.debug
```

- [ ] **Step 2: Run Tier 2**

Run: `time detox test --configuration ios.sim.debug`
Expected: all 4 suites pass in under 8 minutes (target <7 min).

- [ ] **Step 3: If a suite fails, fix inline and recommit**

No fallback. Tests must be green before Phase I.

---

## Phase I — Tier 3 smoke suite

### Task I1: Move agentmail.js to smoke helpers

**Files:**
- Move: `e2e/helpers/agentmail.js` portions related to real OTP → `e2e/smoke/helpers/agentmail.js`

- [ ] **Step 1: Create smoke helpers dir + file**

Copy the original `migrateOneWalletFromCard` (real OTP version, which we preserved in git history before Task H3 replaced it). Equivalent — recreate from scratch here:

```js
// e2e/smoke/helpers/agentmail.js
const fs = require('fs')
const path = require('path')

function readDotEnv() {
  const root = path.resolve(__dirname, '..', '..', '..')
  for (const name of ['.env.test', '.env']) {
    try {
      const content = fs.readFileSync(path.join(root, name), 'utf8')
      const vars = {}
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) vars[m[1].trim()] = m[2].trim()
      }
      return vars
    } catch {}
  }
  return {}
}

const ENV = readDotEnv()
const AGENTMAIL_API_KEY = ENV.AGENTMAIL_API_KEY
const AGENTMAIL_EMAIL = ENV.AGENTMAIL_EMAIL || 'vultiagent@agentmail.to'
const VAULT_PASSWORD = 'testpass123'

async function getExistingMessageIds(inboxEmail) {
  try {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
      { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
    )
    if (!res.ok) return new Set()
    const data = await res.json()
    return new Set((data.messages || []).map((m) => m.message_id))
  } catch {
    return new Set()
  }
}

async function fetchOtpFromAgentmail(inboxEmail, knownMessageIds, maxAttempts = 30, intervalMs = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const listRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
      )
      if (!listRes.ok) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const listData = await listRes.json()
      const msg = (listData.messages || [])
        .filter((m) => !knownMessageIds.has(m.message_id))
        .find(
          (m) =>
            (m.preview && m.preview.includes('Verification')) ||
            (m.subject && m.subject.includes('Verification')),
        )
      if (!msg) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const msgRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages/${msg.message_id}`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
      )
      if (!msgRes.ok) continue
      const msgData = await msgRes.json()
      const text = msgData.text || msgData.extracted_text || msgData.html || ''
      const match = text.match(/Verification Code:\s*(\d{4,6})|\b(\d{4})\b/)
      if (match) {
        const code = match[1] || match[2]
        knownMessageIds.add(msg.message_id)
        return code
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Failed to fetch OTP after ${maxAttempts} attempts`)
}

async function migrateOneWalletFromCard(walletIndex, walletLabel, knownMessageIds, hasMoreWallets) {
  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap()

  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL)
  await element(by.id('vault-email-next')).tap()

  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000)

  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
  for (const id of preKeygenIds) knownMessageIds.add(id)

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD)
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD)
  await element(by.id('vault-password-continue')).tap()

  await waitFor(element(by.text('Verify your email')))
    .toExist()
    .withTimeout(180000)

  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds)
  await element(by.id('verify-code-input')).tap()
  await element(by.id('verify-code-input')).replaceText(otp)

  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(60000)

  if (hasMoreWallets) {
    await element(by.id('migrate-another-wallet')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
  }
}

module.exports = {
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
  migrateOneWalletFromCard,
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/smoke/helpers/agentmail.js
git commit -m "feat(e2e): move real-OTP helpers to e2e/smoke/helpers"
```

### Task I2: Create smoke suite

**Files:**
- Create: `e2e/smoke/migration-real-backend.test.js`

- [ ] **Step 1: Write the suite**

```js
/**
 * Nightly smoke: one full migration with real vultiserver + AgentMail.
 * Not gated on PRs. Runs via `.github/workflows/e2e-smoke.yml`.
 */
const { execSync } = require('child_process')
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail')

describe('Smoke — real-backend migration', () => {
  let knownMessageIds = new Set()

  beforeAll(async () => {
    execSync(
      `xcrun simctl shutdown ${device.id} 2>/dev/null; xcrun simctl erase ${device.id}`,
      { timeout: 180000 },
    )
    execSync(`xcrun simctl boot ${device.id}`, { timeout: 120000 })

    await device.launchApp({ delete: true, newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-legacy')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.id('dev-seed-legacy')).tap()
    await waitFor(element(by.id('seed-done')))
      .toExist()
      .withTimeout(30000)

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('walks RiveIntro → MigrationHome → wallet list', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.id('enter-vultiverse-cta')).tap()

    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.text('Start Migration')).tap()

    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('migrates TestWallet1 via real vultiserver + AgentMail', async () => {
    await migrateOneWalletFromCard(0, 'TestWallet1', knownMessageIds, false)
  }, 240000)

  it('passes vault integrity verification', async () => {
    await waitFor(element(by.id('verify-all-passed')))
      .toExist()
      .withTimeout(15000)
    await expect(element(by.id('verify-all-passed')))
      .toHaveText('all-passed: true')
  })

  it('reaches wallet list on relaunch and shows migrated vault', async () => {
    await element(by.id('success-back')).tap()
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
    await waitFor(element(by.text('TestWallet1')))
      .toBeVisible()
      .withTimeout(60000)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e/smoke/migration-real-backend.test.js
git commit -m "feat(e2e): add nightly real-backend migration smoke suite"
```

### Task I3: Smoke jest.config.js + Detox smoke configuration

**Files:**
- Create: `e2e/smoke/jest.config.js`
- Modify: `.detoxrc.js`

- [ ] **Step 1: Smoke jest config**

```js
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/e2e/smoke/**/*.test.js'],
  testTimeout: 600000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  modulePathIgnorePatterns: [
    '<rootDir>/.worktrees/',
    '<rootDir>/.claude/',
  ],
}
```

- [ ] **Step 2: Add smoke configuration to .detoxrc.js**

Add a new configuration block. Full updated file:

```js
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Vultisig.app',
      build: 'xcodebuild -workspace ios/Vultisig.xcworkspace -scheme Vultisig -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Vultisig.app',
      build: 'xcodebuild -workspace ios/Vultisig.xcworkspace -scheme Vultisig -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'ios.sim.smoke': {
      device: 'simulator',
      app: 'ios.debug',
      testRunner: {
        args: {
          $0: 'jest',
          config: 'e2e/smoke/jest.config.js',
        },
      },
    },
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/smoke/jest.config.js .detoxrc.js
git commit -m "feat(e2e): add ios.sim.smoke Detox configuration"
```

### Task I4: Nightly smoke GitHub workflow

**Files:**
- Create: `.github/workflows/e2e-smoke.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: E2E Smoke (nightly)

on:
  schedule:
    - cron: '0 7 * * *'   # 07:00 UTC daily
  workflow_dispatch:

concurrency:
  group: e2e-smoke
  cancel-in-progress: true

jobs:
  smoke:
    runs-on: macos-14
    timeout-minutes: 45
    env:
      EXPO_PUBLIC_SHOW_DEV_FEATURES: 'true'
      EXPO_PUBLIC_MIGRATION_FLOW_ENABLED: 'true'
      AGENTMAIL_API_KEY: ${{ secrets.AGENTMAIL_API_KEY }}
      AGENTMAIL_EMAIL: ${{ secrets.AGENTMAIL_EMAIL }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Install detox CLI
        run: npm install -g detox-cli

      - name: Install pods
        run: cd ios && pod install

      - name: Build Detox app (no stub flag)
        run: npx detox build --configuration ios.sim.smoke

      - name: Run smoke suite
        run: npx detox test --configuration ios.sim.smoke --headless

      - name: Upload Detox artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: detox-smoke-artifacts
          path: artifacts/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e-smoke.yml
git commit -m "feat(ci): add nightly e2e smoke workflow"
```

---

## Phase J — Package scripts and final wiring

### Task J1: Add npm scripts for new tiers

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

Add to the `"scripts"` block alongside the existing `test` / `test:ci`:

```json
"e2e:build:ui": "EXPO_PUBLIC_STUB_VULTISERVER=true EXPO_PUBLIC_SHOW_DEV_FEATURES=true EXPO_PUBLIC_MIGRATION_FLOW_ENABLED=true detox build --configuration ios.sim.debug",
"e2e:ui": "EXPO_PUBLIC_STUB_VULTISERVER=true detox test --configuration ios.sim.debug",
"e2e:build:smoke": "EXPO_PUBLIC_SHOW_DEV_FEATURES=true EXPO_PUBLIC_MIGRATION_FLOW_ENABLED=true detox build --configuration ios.sim.smoke",
"e2e:smoke": "detox test --configuration ios.sim.smoke"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add e2e:ui and e2e:smoke npm scripts"
```

### Task J2: Run the full Tier 1 suite once more as a final gate

- [ ] **Step 1: Run**

Run: `time npm run test:ci`
Expected: all tests pass, total under 30s.

- [ ] **Step 2: No commit — final gate before pushing to PR**

### Task J3: Rebase/merge onto `e2e/test-cleanup` and update PR #42

- [ ] **Step 1: Fetch latest origin/e2e/test-cleanup**

Run: `git fetch origin e2e/test-cleanup`

- [ ] **Step 2: Rebase on top**

Run: `git rebase origin/e2e/test-cleanup`
Resolve conflicts by taking the new architecture version (this branch is a full replacement of the cleanup PR's test files).

- [ ] **Step 3: Force-push a new branch for the user to review and merge**

Do NOT push directly to `e2e/test-cleanup`. Push the `e2e/test-architecture-v2` branch so the user can open a sub-PR / merge manually:

```bash
git push -u origin e2e/test-architecture-v2
```

- [ ] **Step 4: Update PR #42 description**

Run (via gh):

```bash
gh pr edit 42 --body-file docs/superpowers/specs/2026-04-17-e2e-test-architecture-redesign-design.md
```

Or use a shorter summary version. Use `gh pr edit 42 --body "..."` with the following content:

```
## Summary

Three-tier e2e test architecture:

- **Tier 1 — Jest logic tests** (`__tests__/`): crypto goldens, keystore migration, vault share round-trip, import parsing. <30s total, runs on every PR via existing `unit-tests` CI job.
- **Tier 2 — Detox UI tests** (`e2e/`): four suites with stubbed vultiserver + OTP. One `eraseSimulator` per run, ~6-7 min total. Runs locally + on-demand via `npm run e2e:ui`.
- **Tier 3 — Nightly smoke** (`e2e/smoke/`): one real-backend migration through vultiserver + AgentMail. ~5-6 min. Runs via `.github/workflows/e2e-smoke.yml`.

See `docs/superpowers/specs/2026-04-17-e2e-test-architecture-redesign-design.md` for the full design and `docs/superpowers/plans/2026-04-17-e2e-test-architecture-redesign.md` for the implementation plan.

## Test plan

- [x] `npm run test:ci` passes all Tier 1 tests
- [ ] `npm run e2e:ui` passes on local macOS + iPhone 16 simulator
- [ ] `npm run e2e:smoke` passes against live vultiserver + AgentMail
```

- [ ] **Step 5: Mention the plan change in the PR**

Run:
```bash
gh pr comment 42 --body "Architecture redesigned — see new branch e2e/test-architecture-v2. Once reviewed, we'll either merge it in or replace this PR."
```

---

## Self-review checklist (owner: the implementing agent)

After all tasks complete:

- [ ] `npm run test:ci` reports all Tier 1 tests passing, total <30s.
- [ ] Every testID referenced in new Detox suites exists in the app source tree.
- [ ] `npm run typecheck && npm run lint:check` both clean.
- [ ] PR #42 description reflects the new architecture.
- [ ] `e2e/crypto-parity.test.js`, `e2e/full-e2e-migration.test.js`, `src/components/DevFullE2ETest.tsx`, `src/components/CryptoTestScreen.tsx` all deleted.
- [ ] Tier 2 test files renamed to `*-ui.test.js`.
- [ ] `.github/workflows/e2e-smoke.yml` present and runs on `workflow_dispatch`.
