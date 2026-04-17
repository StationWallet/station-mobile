# E2E Test Architecture Redesign

**Date:** 2026-04-17
**Branch:** `e2e/test-architecture-v2` (lands on PR #42)
**Supersedes:** `docs/superpowers/specs/2026-04-16-e2e-test-cleanup-design.md`

> **HISTORICAL — partially shipped.** The three-tier design below was only
> partially adopted in PR #42. **Tier 1 (Jest unit tests) shipped and runs
> on CI.** Tier 2 (Detox UI tests) and Tier 3 (nightly real-backend smoke)
> were dropped during implementation: the Detox suites failed against a
> moving UI target, and the smoke workflow was never exercised. Keep this
> document as the plan-of-record for the Jest half; for the UI/smoke half,
> treat it as scaffolding to revisit if Detox is resurrected. The
> implementation plan at
> `docs/superpowers/plans/2026-04-17-e2e-test-architecture-redesign.md`
> has the same caveat.

## Problem

The current Detox e2e suite takes ~25-35 min on a clean run (often longer when keygen flakes) and regularly fails for reasons unrelated to the code under test. The post-cleanup state on PR #42 still has the three dominant cost drivers intact:

1. **`eraseSimulator` runs in 5 of 6 suites.** Each shutdown + erase + boot + reinstall + Metro bundle download is ~2 min. That's ~10 min of pure setup before any assertions run.
2. **Real `vultiserver` TSS ceremony** on every vault creation/migration. The real keygen floor is 30-120s per wallet and it flakes under load. Four wallets per run = 4-8 min of wall clock plus unbounded flake.
3. **Real AgentMail OTP polling** adds another 10-30s per wallet on top of keygen, dependent on external email delivery.

On top of the wall time, the suite structure mixes three unrelated concerns:

- **In-app unit tests** (`crypto-parity.test.js`, `full-e2e-migration.test.js`) — these tap a dev button and read testIDs from React component output. They don't drive UI flow, don't need the simulator, and are currently paying the full Detox setup cost anyway.
- **UI flow tests** (`fast-vault-creation`, `fast-vault-migration`, `fast-vault-partial-migration`, `import-vault`) — these legitimately need Detox to exercise form blur, modal sheets, keyboard avoiding view, Rive intro, and persistence across real relaunches.
- **Integration smoke** — today implicit, every flow hits the real backend.

The test value per minute of wall time is low, and PRs are routinely merged without waiting for e2e because the feedback is too slow.

## Goals

- Fast enough to gate every PR. Target CI fast-gate under 10 minutes.
- Real integration coverage preserved — just moved to a lane that doesn't block PRs.
- Legacy station-wallet migration flow fully covered end-to-end, including native keystore → expo-secure-store → DKLS vault share production.
- Zero duplicated coverage between tiers.

## Non-goals

- Android Detox. Current suite is iOS-only; this redesign keeps it that way.
- Parallel Detox workers. `maxWorkers: 1` stays — the wins here come from dropping work, not parallelising it.
- Replacing Detox with Maestro or another runner.

## Design

### Three-tier architecture

| Tier | Tool | Runs on | Wall time | Purpose |
|------|------|---------|-----------|---------|
| 1 — Logic | Jest (Node) | Every PR (CI) | <30s | Pure logic + native-module-orchestration covered with mocks |
| 2 — UI | Detox | Local + on-demand | ~6-7 min | Prove the UI is wired up to the logic |
| 3 — Smoke | Detox | Nightly + manual | ~5-6 min | One real end-to-end through vultiserver + AgentMail |

Tier 1 expands; Tier 2 shrinks to the minimum that Tier 1 genuinely cannot cover; Tier 3 is new and boxes the external-dependency flake into a single lane.

### Tier 1 — Jest unit tests

Location: `__tests__/` (alongside the existing `__tests__/polyfills/`). Uses the existing `jest.config.js` and `test:ci` GitHub Actions job — no new infrastructure.

Files:

- `__tests__/crypto/terra-keys-goldens.test.ts` — replaces `CryptoTest` screen + `e2e/crypto-parity.test.js`. Golden values for mk330/mk118/mk2/rawkey address, privkey, pubkey derivation; sha256/sha512/ripemd160/hmac-sha256; deterministic ECDSA signing; address validation + valoper conversion; mnemonic generation; random bytes sanity.
- `__tests__/crypto/encrypt-decrypt.test.ts` — PBKDF2 + AES-CBC round-trip using `utils/crypto.ts`.
- `__tests__/migration/legacy-keystore.test.ts` — Phase 1+2 of `DevFullE2ETest`. Seed legacy data with encrypted keys → `migrateLegacyKeystore()` → verify new expo-secure-store content → verify legacy cleaned → idempotency → decrypt migrated keys → derive correct pubkey. `LegacyKeystore`, `keystore`, `preferences` mocked as in-memory Maps.
- `__tests__/migration/keystore-size.test.ts` — Phase 3 of `DevFullE2ETest`. 10-wallet payload > 2KB, write/read byte-for-byte.
- `__tests__/migration/dkls-key-import.test.ts` — **new coverage.** Given a decrypted private key, call the production `dklsKeyImport` service with a stubbed vultiserver fetch (`global.fetch` mocked). Assert the returned vault share has the expected pubkey, libType === KEYIMPORT, a non-empty keyshare, and correct signers list.
- `__tests__/vault/share-export.test.ts` — replaces Phase 3 of `DevFullE2ETest`'s vault export path. Create vault share from private key → serialize to .vult container → base64-decode → parse VaultContainer protobuf → AES-GCM decrypt → parse Vault protobuf → assert name, pubkey, keyshare, libType.
- `__tests__/vault/import-file.test.ts` — feeds `e2e/fixtures/test-vault.vult` and `e2e/fixtures/test-vault.bak` through the real import service. Right password → vault parsed and keyshare extracted. Wrong password → specific error raised.
- `__tests__/wallet/vault-store.test.ts` — write vault via `vaultStore.save()`, read back via `vaultStore.load()`, verify rehydration. Mocked expo-secure-store.

Jest mocks live in `__tests__/__mocks__/`:

- `legacy-keystore.ts` — in-memory `Map<string, string>`, implements `seedLegacyTestData`, `readLegacy`, `clearAllLegacyData`.
- `expo-secure-store.ts` — in-memory `Map<string, string>`, implements `setItemAsync`, `getItemAsync`, `deleteItemAsync`.
- `preferences.ts` — in-memory `Map<string, boolean>`, implements `setBool`, `getBool`.

These mocks are **not** shared with the Detox tests — the Tier 2 UI tests use the real native modules.

### Tier 2 — Detox UI tests

Location: `e2e/` (flat, no subdirs). Four suites, each walks one UI path with edge cases.

Files:

- `e2e/creation-ui.test.js` — new user creates a Fast Vault.
  - Clean state → dev button → RiveIntro → MigrationHome → Create Fast Vault → VaultName → VaultEmail (invalid email → error after blur; valid email → advances) → VaultPassword (short → error; mismatch → error; valid → advances) → KeygenProgress → VerifyEmail → MigrationSuccess (integrity check) → success-back → relaunch → wallet list shows created vault.
  - Backend stubbed; keygen completes in ~500ms, verify accepts any code.
- `e2e/migration-ui.test.js` — legacy wallet holder migrates to DKLS vaults.
  - Seed legacy data via dev button → relaunch → MigrationHome → Start Migration → wallet list → migrate wallet 1 (email, password, stubbed keygen, OTP) → migrate wallet 2 → MigrationSuccess (integrity check for each migrated vault) → success-back → relaunch → wallet list shows both migrated vaults → export vault share modal appears on tap.
  - Legacy Ledger wallet preserved (no migrate button, visible in list).
- `e2e/migration-skip-retry-ui.test.js` — keygen failure handling.
  - Seed corrupt data → migrate → keygen fails (corrupt key decryption fails locally, no network) → Retry → fails again → Skip → MigrationSuccess with skipped wallet recorded as failed.
  - No stubbing needed.
- `e2e/import-ui.test.js` — .vult / .bak file import.
  - Stage `test-vault.vult` in app Documents → MigrationHome → ImportVault → file picker (auto-selects staged file in __DEV__) → decrypt sheet appears → wrong password → error shown, sheet stays open → correct password → success → relaunch → wallet list shows imported vault. Repeat with `test-vault.bak`.

**Shared setup (`e2e/jest.config.js` globalSetup):**

- `eraseSimulator` runs **once** at the start of the run.
- Detox `globalSetup` boots the simulator and installs the app.
- Each suite's `beforeAll` uses the new `devReset()` helper (Section: "State reset") instead of erasing.

**Deleted relative to current PR #42 state:**

- `e2e/crypto-parity.test.js` — moved to Tier 1.
- `e2e/full-e2e-migration.test.js` — moved to Tier 1.

**Renamed relative to current PR #42 state:**

- `fast-vault-creation.test.js` → `creation-ui.test.js`
- `fast-vault-migration.test.js` → `migration-ui.test.js`
- `fast-vault-partial-migration.test.js` → `migration-skip-retry-ui.test.js`
- `import-vault.test.js` → `import-ui.test.js`

### Tier 3 — Integration smoke

Location: `e2e/smoke/`. One file: `migration-real-backend.test.js`.

Flow: seed legacy data → walk full UI with **real** vultiserver + AgentMail → migrate TestWallet1 → verify integrity → export vault share → re-read .vult file → decrypt → verify bytes match the in-app vault.

Infrastructure:

- New Detox configuration `ios.sim.smoke` in `.detoxrc.js`. Same app binary as `ios.sim.debug` but without the stub flag (see below).
- `e2e/smoke/jest.config.js` — points at `e2e/smoke/**/*.test.js`. Uses `e2e/smoke/helpers/agentmail.js` (moved from `e2e/helpers/`).
- New GitHub Actions workflow `.github/workflows/e2e-smoke.yml` — runs on `schedule: cron '0 7 * * *'` (nightly at 07:00 UTC) + `workflow_dispatch`. Not required for PR merge.

### Backend stubbing mechanism

A single env var `EXPO_PUBLIC_STUB_VULTISERVER` (read via `process.env` in `src/config/env.ts`, `__DEV__`-guarded so it can only take effect in dev builds).

`src/services/fastVaultServer.ts` gains a runtime branch at the top of each exported function:

```ts
import { env } from '../config/env'
import * as stub from './fastVaultServer.stub'

export async function setupBatchImport(input: ...): Promise<void> {
  if (env.stubVultiserver) return stub.setupBatchImport(input)
  // existing real implementation
}
```

`src/services/fastVaultServer.stub.ts` implements both functions as immediate no-ops. The stubbed keygen resolves the ceremony using a deterministic test key so `dklsKeyImport` still produces valid vault-share bytes and integrity checks pass.

Tier 2 builds set `EXPO_PUBLIC_STUB_VULTISERVER=true`. Tier 3 smoke builds don't set it — production code path runs.

Keeping a runtime branch (rather than Metro resolver tricks) is intentional: one flag, one file to check, trivial to reason about, production code path is byte-identical when the flag is off.

### State reset between UI suites

New dev-only screen `src/components/DevStateReset.tsx`, reachable from `AuthMenu` in dev mode with testID `dev-reset-state`. On mount it:

1. Read the current `AuthData` to enumerate wallet names.
2. For each wallet name, `await SecureStore.deleteItemAsync(vaultStoreKey(name), VAULT_STORE_OPTS)` — removes the per-wallet vault blob written by `migrateToVault`.
3. `await keystore.remove(KeystoreEnum.AuthData)` — clears the wallet list itself.
4. For every `PreferencesEnum` boolean used by the migration flow (`legacyKeystoreMigrated`, `legacyDataFound`, `vaultsUpgraded`, `firstRun`), `await preferences.setBool(key, false)`.
5. `await LegacyKeystore.clearAllLegacyData()`.
6. Sets testID `dev-reset-done` so Detox can wait for completion.

New helper `e2e/helpers/dev-reset.js`:

```js
async function devReset() {
  await device.launchApp({ newInstance: true })
  await element(by.id('dev-reset-state')).tap()
  await waitFor(element(by.id('dev-reset-done'))).toExist().withTimeout(10000)
  await device.terminateApp()
}
```

Each UI suite's `beforeAll` calls `devReset()` (~5s) instead of `eraseSimulator` (~2 min). The single exception is the first suite in the run, which relies on `eraseSimulator` from the globalSetup to also clear keychain state that survives app deletion.

### Detox config changes

Two new entries in `.detoxrc.js`:

```js
configurations: {
  'ios.sim.debug': {
    device: 'simulator',
    app: 'ios.debug',
    // stub flag set via env at build time; no Detox change needed
  },
  'ios.sim.smoke': {
    device: 'simulator',
    app: 'ios.debug', // same binary; env var is the only difference at build time
  },
},
```

`e2e/jest.config.js` stays single-purpose (Tier 2 only). Smoke gets its own `e2e/smoke/jest.config.js`.

### Env / CI wiring

- `.github/workflows/ci.yml` — Tier 1 runs via the existing `unit-tests` job. No change beyond the new test files getting picked up by Jest's `testMatch`.
- `.github/workflows/e2e-smoke.yml` — new. Builds the iOS app (no stub flag), runs `detox test --configuration ios.sim.smoke`. Uses macOS runner, same as local dev.
- Local Tier 2 command (added to `package.json`): `"e2e:ui": "EXPO_PUBLIC_STUB_VULTISERVER=true detox test --configuration ios.sim.debug"`.
- Local Tier 3 command: `"e2e:smoke": "detox test --configuration ios.sim.smoke"`.

## Runtime targets

| Tier | Target | Floor | Flake budget |
|------|--------|-------|--------------|
| 1    | <30s   | ~1-3s | Zero — deterministic, no network |
| 2    | <7 min | ~6 min | Low — one erase, stubbed network, no OTP |
| 3    | <6 min | ~4 min | Medium — real backend, runs nightly not on PRs |

## Coverage preserved

Every meaningful assertion in the current suite has a home in the new architecture.

| Current coverage | New home |
|------------------|----------|
| Crypto golden values | Tier 1 `terra-keys-goldens.test.ts` |
| Encrypt/decrypt round-trip | Tier 1 `encrypt-decrypt.test.ts` |
| Legacy keystore seed → read | Tier 1 `legacy-keystore.test.ts` + Tier 2 `migration-ui.test.js` (via real native module) |
| `migrateLegacyKeystore()` | Tier 1 `legacy-keystore.test.ts` + Tier 2 `migration-ui.test.js` |
| Migration idempotency | Tier 1 `legacy-keystore.test.ts` |
| Decrypt migrated keys | Tier 1 `legacy-keystore.test.ts` |
| Keystore size >2KB | Tier 1 `keystore-size.test.ts` + Tier 3 (real iOS keychain) |
| DKLS vault share creation | Tier 1 `dkls-key-import.test.ts` (new) + Tier 2 `migration-ui.test.js` |
| Vault share .vult round-trip | Tier 1 `share-export.test.ts` |
| .vult / .bak import + decrypt | Tier 1 `import-file.test.ts` |
| Wrong password on import | Tier 1 `import-file.test.ts` + Tier 2 `import-ui.test.js` |
| Form validation (email/password) | Tier 2 `creation-ui.test.js` |
| Navigation wiring | Tier 2 (all UI suites) |
| Modal/sheet behavior | Tier 2 `import-ui.test.js` |
| Rive intro + keygen screen | Tier 2 (all UI suites) |
| Skip/retry keygen failure UI | Tier 2 `migration-skip-retry-ui.test.js` |
| Persistence across relaunch | Tier 2 (all UI suites) |
| Ledger wallet preservation | Tier 2 `migration-ui.test.js` |
| Real vultiserver integration | Tier 3 `migration-real-backend.test.js` |
| Real OTP roundtrip | Tier 3 `migration-real-backend.test.js` |
| Export .vult round-trip | Tier 3 `migration-real-backend.test.js` |

No coverage is lost. Three items **gain** coverage:

- `dkls-key-import.test.ts` is new unit coverage of a service that was previously only exercised through the UI.
- `vault-store.test.ts` is new coverage of the persistence layer in isolation.
- `import-file.test.ts` wrong-password path moves out of UI-only and into a deterministic unit test.

## Out of scope

- Android Detox support.
- Parallel Detox workers or multi-device runs.
- Retry/flake-tolerance logic in the test runner.
- Replacing Detox or moving to Maestro/Appium.
- Performance/load tests of the app or backend.

## Success criteria

- `npm run test:ci` completes Tier 1 in <30s with all tests passing.
- `npm run e2e:ui` completes Tier 2 in <7 min with all tests passing, with one `eraseSimulator` at the start.
- `npm run e2e:smoke` completes Tier 3 in <6 min with all tests passing against the real vultiserver + AgentMail.
- No test file contains both "in-app logic assertion" and "UI flow step" concerns.
- Every current assertion has a traceable replacement per the coverage table.
- PR #42 is updated to this architecture and the CI `unit-tests` job covers Tier 1.
