# E2E Test Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split entangled UI/e2e branch, then clean up e2e tests — consolidate duplicates, remove sleeps, restore test discipline.

**Architecture:** Two-phase approach. Phase 1 uses interactive rebase to separate the UI branch from e2e work. Phase 2 operates on a new e2e branch to consolidate duplicate suites, replace hardcoded sleeps with `waitFor`, and reduce test infrastructure hacks.

**Tech Stack:** Git (interactive rebase), Detox (React Native e2e framework), Jest

---

## Phase 1: Branch Split

### Task 1: Create the e2e branch as a safety copy

Before touching the UI branch, preserve the full state on a new branch.

**Files:** None (git operations only)

- [ ] **Step 1: Create e2e branch off current HEAD**

```bash
git branch e2e/test-cleanup
```

This branch now has every commit including all e2e work. We'll switch to it in Phase 2.

- [ ] **Step 2: Verify the branch exists and points to the same commit**

```bash
git log --oneline -1 e2e/test-cleanup
git log --oneline -1 HEAD
```

Expected: Both show the same SHA (`22eefb8` or whatever HEAD is at execution time).

- [ ] **Step 3: Commit**

No commit needed — this is a branch pointer only.

---

### Task 2: Generate the rebase todo script

Interactive rebase on 64 commits is error-prone. We'll generate the todo script in advance so the engineer knows exactly what to do with each line.

**Files:** None (reference material)

- [ ] **Step 1: Generate the rebase todo and annotate each commit**

Run `git rebase -i 7819d81` (the merge-base with main). This opens an editor with ~64 `pick` lines.

Apply these actions to each commit (listed oldest-first):

```
pick fb7895c  fix: repair Detox e2e tests                    → EDIT (keep src/, drop e2e/)
pick 8aa2585  fix: flatten fast-vault-migration test          → DROP
pick 1aa4a75  fix: resolve remaining fast-vault-migration     → DROP
pick 5f5329b  fix: resolve test isolation and crypto golden   → DROP
pick 57a3685  fix: resolve prettier formatting                → KEEP
pick 5a259fe  refactor: simplify from code review findings    → EDIT (keep src/, drop e2e/)
pick e043cea  Merge pull request #38                          → DROP (merge commits can't survive rebase cleanly; the src/ content from its children is preserved via the EDIT steps above)
pick 03560e0  ui: align import flow design                    → KEEP
pick bffbfc2  fix: lint errors                                → KEEP
pick c516e62  fix: disable unstable_enablePackageExports      → KEEP
pick 3e947ff  ui: replace keygen progress bar with Rive       → KEEP
pick 5bbb136  ui: align MigrationHome screen with Figma       → KEEP
pick 81fcc79  fix: align station-mobile UI                    → KEEP
pick f556111  fix: InfoCard strip overlap                     → KEEP
pick 1a1e1be  fix: lightning icon glow                        → KEEP
pick 578ade4  fix: immediate validation                       → KEEP
pick 8290e78  fix: clip lightning icon                        → KEEP
pick cff09cf  fix(InfoCard): two-column layout                → KEEP
pick 09acf49  fix(InfoCard): increase lightning icon size     → KEEP
pick 33d2d81  fix: prevent lightning glow bleed               → KEEP
pick 73b447a  fix(InfoCard): reduce circle from 40px to 24px → KEEP
pick 0e1f19d  fix(InfoCard): increase to 30x30               → KEEP
pick 19d2698  fix(InfoCard): push glow further down           → KEEP
pick 9857cb2  fix(InfoCard): align glow style                 → KEEP
pick 0ce37b4  fix(InfoCard): soften glow                      → KEEP
pick f695131  fix(InfoCard): rebuild lightning icon            → KEEP
pick da0a3ea  fix(WalletCard): replace Fast Vault badge       → KEEP
pick 0d1ce17  fix: step progress bar glow                     → KEEP
pick e9c7dbc  feat: add info tooltip to ImportVault           → KEEP
pick fa7f7c2  style: align Button with PrimaryButton          → KEEP
pick c02fd96  fix: bump react-native-worklets                 → KEEP
pick 250f08d  fix: add layoutScaleFactor                      → KEEP
pick 75823e0  refactor: migrate expo-dkls to mpc-native       → KEEP
pick ac70909  fix: register withMpcNativeAars plugin           → KEEP
pick 8e48b43  fix: add walletcore-native + trustwallet maven  → KEEP
pick 18e7c6e  fix: disable watchman                            → KEEP
pick 88fea8b  feat: enable migration flow + VaultSetup         → KEEP
pick 767c42d  fix: extend dark bg on MigrationSuccess          → KEEP
pick 501de09  fix: set global dark background                  → KEEP
pick 6627336  fix: use adjustPan keyboard mode                 → KEEP
pick 2dfa82f  fix: set Android window background dark          → KEEP
pick c567cc2  fix: use KeyboardAvoidingView behavior='height'  → KEEP
pick 1e5c598  fix: resolve CI lint, typecheck, and test        → KEEP
pick 4122389  refactor: replace SafeAreaView with insets       → KEEP
pick f641b21  fix: rename TRUSTWALLET_PAT to GITHUB_TOKEN      → KEEP
pick 2d68d9e  fix: restore __DEV__ routing guard (1st)         → EDIT (keep src/, drop e2e/)
pick 722a772  feat: enable migration flow + VaultSetup (2nd)   → KEEP
pick 87ba838  fix: mute vault name input placeholder           → KEEP
pick 32f4ebc  fix: restore __DEV__ routing guard (2nd)         → EDIT (keep src/, drop e2e/)
pick fbc599f  fix: lazy-load KeygenProgress                    → KEEP
pick 6c39e10  fix: replace text back buttons with glass arrow  → KEEP
pick afe56e3  fix: restructure partial migration test          → DROP
pick 5334d16  fix: remove simctl erase from partial migration  → DROP
pick 7f28c38  fix: scroll to Seed Corrupt Data button          → DROP
pick 579e739  fix: use scrollTo bottom                         → DROP
pick 7ec6a0d  fix: account for bottom safe area in AuthMenu    → EDIT (drop e2e/ AND drop src/ AuthMenu padding — revert both parts)
pick 43c8918  fix: reduce AuthMenu paddingTop                  → EDIT (drop e2e/ AND drop src/ AuthMenu padding — revert both parts)
pick 8c780ff  fix: remove detoxURLBlacklistRegex (fast-vault)  → DROP
pick 783d50b  fix: remove detoxURLBlacklistRegex (import-vault)→ DROP
pick 036595c  fix: lint — format multi-line function signature → KEEP
pick e07b247  fix: increase post-erase wait timeout            → DROP
pick d20d127  fix: disable bail                                → DROP
pick e63f691  fix: lint + eslint overrides for e2e/config      → DROP
pick 22eefb8  docs: add e2e test cleanup design spec           → KEEP
```

Summary: **DROP 16 commits**, **EDIT 6 commits** (fb7895c, 5a259fe, 2d68d9e, 32f4ebc, 7ec6a0d, 43c8918), **KEEP the rest**.

- [ ] **Step 2: Verify the todo matches the plan**

Before saving the rebase todo, count: you should have 16 `drop` lines, 6 `edit` lines, and the rest `pick`. If the count doesn't match, stop and reconcile.

---

### Task 3: Execute the rebase — EDIT commits

This task handles each EDIT commit. When the rebase pauses at an `edit` commit, follow these instructions.

**Files:**
- Modify: `e2e/` (remove changes via `git checkout`)
- Modify: `src/screens/auth/AuthMenu.tsx` (for 7ec6a0d and 43c8918)

- [ ] **Step 1: Handle `fb7895c` (repair Detox e2e tests)**

When rebase pauses at this commit:

```bash
# Unstage all e2e/ changes from this commit, restore them to the pre-commit state
git checkout HEAD~1 -- e2e/
# Also unstage .detoxrc.js if it only has e2e-related changes
git diff --cached --name-only | grep -E '^(e2e/|\.detoxrc)' | xargs git checkout HEAD~1 --
# Re-commit with just the src/ changes
git add -A
git commit --amend --no-edit
git rebase --continue
```

The src/ files kept from this commit: `src/config/env.ts`, `src/navigation/hooks.ts`, `src/navigation/index.tsx`, `src/screens/WalletList.tsx`, `src/services/exportVaultShare.ts`, `package.json`, `.gitignore`, `e2e/jest.config.js` (the modulePathIgnorePatterns addition is useful for src/ too).

Wait — `e2e/jest.config.js` is an e2e file. Drop it too. And `.detoxrc.js`. Only keep: `src/`, `package.json`, `.gitignore`.

Revised:

```bash
# Keep only src/, package.json, .gitignore from this commit
git checkout HEAD~1 -- e2e/ .detoxrc.js
git add -A
git commit --amend --no-edit
git rebase --continue
```

- [ ] **Step 2: Handle `5a259fe` (simplify from code review)**

When rebase pauses:

```bash
# Drop e2e/ files, keep src/ changes
git checkout HEAD~1 -- e2e/
git add -A
git commit --amend --no-edit
git rebase --continue
```

Kept: `src/navigation/index.tsx` (refreshWallets reuse), `src/screens/WalletList.tsx` (single data source).

- [ ] **Step 3: Handle `2d68d9e` (restore __DEV__ guard, 1st)**

When rebase pauses:

```bash
git checkout HEAD~1 -- e2e/
git add -A
git commit --amend --no-edit
git rebase --continue
```

Kept: `src/navigation/index.tsx` (`__DEV__` routing guard).

- [ ] **Step 4: Handle `32f4ebc` (restore __DEV__ guard, 2nd)**

When rebase pauses:

```bash
git checkout HEAD~1 -- e2e/
git add -A
git commit --amend --no-edit
git rebase --continue
```

Kept: `src/navigation/index.tsx`.

- [ ] **Step 5: Handle `7ec6a0d` (bottom safe area in AuthMenu)**

This commit is entirely Detox-motivated (both the e2e/ and src/ parts). Drop the whole thing:

```bash
git reset HEAD~1
git checkout -- .
git rebase --continue
```

- [ ] **Step 6: Handle `43c8918` (reduce AuthMenu paddingTop)**

Same — entirely Detox-motivated. Drop the whole thing:

```bash
git reset HEAD~1
git checkout -- .
git rebase --continue
```

- [ ] **Step 7: Resolve any rebase conflicts**

If conflicts arise (likely around `src/navigation/index.tsx` which was touched by multiple commits), resolve by keeping the src/ changes and ensuring `__DEV__` guard is present. After each conflict:

```bash
git add <resolved files>
git rebase --continue
```

- [ ] **Step 8: Verify the rebase result**

```bash
# Confirm no e2e test files were modified vs main (they should be unchanged)
git diff main -- e2e/ --stat
# Confirm src/ changes are all present
git diff main -- src/ --stat
# Confirm the branch compiles
npx tsc --noEmit
```

The `git diff main -- e2e/` should show zero changes (or only changes that were on main originally). All e2e work should be gone from this branch.

- [ ] **Step 9: Commit note**

No commit needed — rebase rewrites history in place.

---

### Task 4: Verify UI branch is clean

**Files:** None (verification only)

- [ ] **Step 1: Check that no e2e-only commits remain**

```bash
git log main..HEAD --oneline -- e2e/
```

Expected: Empty output (or only the jest.config.js modulePathIgnorePatterns if we kept that).

- [ ] **Step 2: Check the commit count is reasonable**

```bash
git log main..HEAD --oneline | wc -l
```

Expected: ~46 commits (64 original minus 16 dropped minus 2 fully reverted 7ec6a0d/43c8918). Exact count may vary if merge commit `e043cea` was also dropped.

- [ ] **Step 3: Spot-check key src/ changes survived**

```bash
# __DEV__ guard
git show HEAD:src/navigation/index.tsx | grep '__DEV__'
# refreshWallets
git show HEAD:src/navigation/index.tsx | grep 'refreshWallets'
# Lazy-load KeygenProgress
git show HEAD:src/screens/migration/KeygenProgress.tsx | head -5
```

All three should produce output confirming the changes are present.

---

## Phase 2: E2E Test Cleanup

All remaining tasks happen on the `e2e/test-cleanup` branch.

### Task 5: Switch to e2e branch and verify state

**Files:** None (git operations only)

- [ ] **Step 1: Switch to the e2e branch**

```bash
git checkout e2e/test-cleanup
```

- [ ] **Step 2: Verify all 8 test files exist**

```bash
ls e2e/*.test.js
```

Expected: `crypto-parity`, `fast-vault-creation`, `fast-vault-migration`, `fast-vault-partial-migration`, `full-e2e-migration`, `import-vault`, `legacy-migration`, `migration-onboarding` (8 files).

---

### Task 6: Merge `legacy-migration` into `full-e2e-migration`

`legacy-migration.test.js` tests steps 3, 4, 6, 7, 8 — all of which are already covered by `full-e2e-migration.test.js` (steps 1-16). Zero unique coverage. Delete it.

**Files:**
- Delete: `e2e/legacy-migration.test.js`

- [ ] **Step 1: Verify legacy-migration is a strict subset**

Check that every assertion in legacy-migration has an equivalent in full-e2e-migration:

| legacy-migration | full-e2e-migration equivalent |
|---|---|
| `e2e-step03-seeded` | `step03-seeded` |
| `e2e-step04-legacy-read` | `step04-legacy-read` |
| `e2e-step06-new-store` | `step06-new-store` |
| `e2e-step07-legacy-cleaned` | `step07-legacy-cleaned` |
| `e2e-step08-idempotent` | `step08-idempotent` |
| `e2e-all-passed` | `all-passed` |

Note: legacy-migration uses `e2e-` prefixed testIDs (`by.id('e2e-step03-seeded')`), while full-e2e-migration uses `by.text('step03-seeded: true')`. Both test the same underlying component output. Confirm they hit the same dev screen by checking both `beforeAll` blocks tap the same button: `'Full E2E Test (dev)'` / `dev-full-e2e-test`.

- [ ] **Step 2: Delete the file**

```bash
rm e2e/legacy-migration.test.js
```

- [ ] **Step 3: Commit**

```bash
git add e2e/legacy-migration.test.js
git commit -m "refactor(e2e): remove legacy-migration suite (subset of full-e2e-migration)"
```

---

### Task 7: Merge `migration-onboarding` into `fast-vault-migration`

`migration-onboarding.test.js` has one unique test ("clean install shows auth screen in dev mode"). The rest duplicates `fast-vault-migration.test.js`. Move the unique test, delete the file.

**Files:**
- Modify: `e2e/fast-vault-migration.test.js`
- Delete: `e2e/migration-onboarding.test.js`

- [ ] **Step 1: Add the clean-install test to fast-vault-migration**

Add a new leading `describe` block at the top of `fast-vault-migration.test.js`, before the existing `beforeAll`. This test needs its own setup (clean install, no seeding):

In `e2e/fast-vault-migration.test.js`, add after the imports and before the main `describe`:

```js
describe('Fast Vault Migration — Clean Install Guard', () => {
  beforeAll(async () => {
    eraseSimulator(device.id)

    await device.launchApp({ delete: true, newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    await device.enableSynchronization()
  })

  it('shows auth screen on clean install in dev mode (prod routes to Migration)', async () => {
    await waitFor(element(by.text('Create New Wallet')))
      .toBeVisible()
      .withTimeout(90000)
  })
})
```

This goes as a **separate top-level `describe`** before the existing `describe('Fast Vault Migration — Per-Wallet', ...)`.

- [ ] **Step 2: Remove vault integrity tests that duplicate migration-onboarding**

The existing `fast-vault-migration.test.js` already has vault verification tests (lines 107-141) that are identical to migration-onboarding's verification tests. No changes needed — they're already there.

Confirm: migration-onboarding's unique tests are:
1. "shows auth screen in dev mode" → moved in Step 1
2. "shows MigrationHome with Start Migration CTA" → already in fast-vault-migration as "should play RiveIntro and reach MigrationHome"
3. "taps CTA to reach wallet list" → already in fast-vault-migration as "should navigate to wallet list"
4. "migrates wallet 1/2" → identical (both use `migrateOneWalletFromCard`)
5. Vault verification → identical
6. "vaultsUpgraded persists" → covered by fast-vault-migration's "should not show migration flow on relaunch"

All covered. Safe to delete.

- [ ] **Step 3: Delete migration-onboarding**

```bash
rm e2e/migration-onboarding.test.js
```

- [ ] **Step 4: Commit**

```bash
git add e2e/fast-vault-migration.test.js e2e/migration-onboarding.test.js
git commit -m "refactor(e2e): merge migration-onboarding into fast-vault-migration

Move the unique clean-install guard test into fast-vault-migration.
Delete migration-onboarding.test.js (all other tests were duplicates)."
```

---

### Task 8: Remove dead code from agentmail helper

`migrateOneWallet` (lines 119-159) is never called — only `migrateOneWalletFromCard` is used. Remove it.

**Files:**
- Modify: `e2e/helpers/agentmail.js`

- [ ] **Step 1: Verify migrateOneWallet is unused**

```bash
grep -rn 'migrateOneWallet[^F]' e2e/
```

Expected: Only the function definition and the `module.exports` line. No test file imports it.

- [ ] **Step 2: Remove the function**

Delete the `migrateOneWallet` function (lines 119-159 in `e2e/helpers/agentmail.js`) and remove it from `module.exports`.

The exports should become:

```js
module.exports = {
  AGENTMAIL_API_KEY,
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
  migrateOneWalletFromCard,
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/agentmail.js
git commit -m "refactor(e2e): remove unused migrateOneWallet helper"
```

---

### Task 9: Replace hardcoded sleeps with waitFor — test files

Replace every `setTimeout` in test files with the appropriate Detox `waitFor` call. The agentmail.js polling sleeps stay (they're waiting on external email delivery, not UI).

**Files:**
- Modify: `e2e/fast-vault-creation.test.js`
- Modify: `e2e/fast-vault-migration.test.js`
- Modify: `e2e/fast-vault-partial-migration.test.js`
- Modify: `e2e/import-vault.test.js`

Note: `migration-onboarding.test.js` was deleted in Task 7, so its sleeps are already gone.

- [ ] **Step 1: Fix fast-vault-creation.test.js**

**Line 60** — sleep after reaching MigrationHome, before navigating to VaultName:
```js
// BEFORE
await new Promise((r) => setTimeout(r, 3000))

// AFTER — the next action is tapping 'Create a Fast Vault', which we already waitFor
// Just remove the sleep. The preceding waitFor on 'Create a Fast Vault' already ensures the screen is ready.
```
Delete line 60.

**Line 201** — sleep inside keygen retry loop:
```js
// This sleep is inside a polling loop that checks for keygen completion.
// This is a legitimate polling interval (like agentmail). KEEP IT.
// But reduce from 10s to 5s — keygen errors appear quickly.
await new Promise((r) => setTimeout(r, 5000))
```

**Line 249** — sleep after tapping success-back:
```js
// BEFORE
await element(by.id('success-back')).tap()
await new Promise((r) => setTimeout(r, 3000))

// AFTER — wait for the next screen's element instead
await element(by.id('success-back')).tap()
await waitFor(element(by.text('Your wallets')))
  .toBeVisible()
  .withTimeout(10000)
```

**Line 261** — sleep after relaunch in Persistence beforeAll:
```js
// BEFORE
await device.disableSynchronization()
await new Promise((r) => setTimeout(r, 3000))

// AFTER — the next test checks for 'migration-cta' or 'My Fast Vault'.
// Wait for the wallet list to appear (the expected post-migration state).
await device.disableSynchronization()
await waitFor(element(by.text('My Fast Vault')))
  .toBeVisible()
  .withTimeout(30000)
```

Then remove the `waitFor` on `'My Fast Vault'` from the test itself (it's now in beforeAll). The persistence test `'should show created vault in wallet list'` can use a simple `expect` instead:

```js
it('should show created vault in wallet list', async () => {
  await expect(element(by.text('My Fast Vault'))).toBeVisible()
})
```

- [ ] **Step 2: Fix fast-vault-migration.test.js**

**Line 65** — sleep before tapping 'Start Migration':
```js
// BEFORE
await new Promise((r) => setTimeout(r, 3000))
await element(by.text('Start Migration')).tap()

// AFTER — wait for the button to be tappable
await waitFor(element(by.text('Start Migration')))
  .toBeVisible()
  .withTimeout(10000)
await element(by.text('Start Migration')).tap()
```

**Line 145** — sleep after tapping success-back:
```js
// BEFORE
await element(by.id('success-back')).tap()
await new Promise((r) => setTimeout(r, 2000))

// AFTER
await element(by.id('success-back')).tap()
await waitFor(element(by.text('Your wallets')))
  .toBeVisible()
  .withTimeout(10000)
```

**Line 204** — sleep after relaunch in persistence test:
```js
// BEFORE
await device.disableSynchronization()
await new Promise((r) => setTimeout(r, 3000))

// AFTER
await device.disableSynchronization()
await waitFor(element(by.text('Your wallets')).or(element(by.id('migration-cta'))))
  .toBeVisible()
  .withTimeout(30000)
```

Wait — Detox `.or()` is not a standard API. Instead, just wait for a reasonable element that must exist regardless:

```js
await device.disableSynchronization()
// App should land on WalletList (migration complete) — wait for it
await waitFor(element(by.text('Your wallets')))
  .toBeVisible()
  .withTimeout(30000)
```

- [ ] **Step 3: Fix fast-vault-partial-migration.test.js**

**Line 59** — sleep before tapping migration-cta:
```js
// BEFORE
await new Promise((r) => setTimeout(r, 2000))
await element(by.id('migration-cta')).tap()

// AFTER — migration-cta is already waited for on line 57-58, just tap it
await element(by.id('migration-cta')).tap()
```
Delete line 59.

**Line 157** — sleep after tapping success-back:
```js
// BEFORE
await element(by.id('success-back')).tap()
await new Promise((r) => setTimeout(r, 2000))

// AFTER — verify we navigated away from migration
await element(by.id('success-back')).tap()
await waitFor(element(by.text('Create New Wallet')))
  .toBeVisible()
  .withTimeout(10000)
```

- [ ] **Step 4: Fix import-vault.test.js**

**Line 98** — sleep in `navigateToMigrationHome()` helper:
```js
// BEFORE
// Let MigrationHome settle (wallet discovery, layout)
await new Promise((r) => setTimeout(r, 2000))

// AFTER — the callers all immediately call navigateToImportScreen() which waits
// for 'import-vault-button'. Remove the sleep.
```
Delete lines 97-98.

**Line 224** — sleep before waiting for success-back:
```js
// BEFORE
await new Promise((r) => setTimeout(r, 1000))
await waitFor(element(by.id('success-back')))

// AFTER — the waitFor already handles the wait. Remove the sleep.
await waitFor(element(by.id('success-back')))
```
Delete line 224 (and the comment on 223).

**Line 229** — sleep after tapping success-back:
```js
// BEFORE
await element(by.id('success-back')).tap()
await new Promise((r) => setTimeout(r, 2000))

// AFTER
await element(by.id('success-back')).tap()
await waitFor(element(by.text('Your wallets')).or(element(by.text('Create New Wallet'))))
  .toBeVisible()
  .withTimeout(10000)
```

Again, `.or()` isn't standard Detox. Use a simpler approach — the import test should land on the wallet list:

```js
await element(by.id('success-back')).tap()
// After import, app should navigate to main screen
await waitFor(element(by.text('Test Import Vault')))
  .toBeVisible()
  .withTimeout(10000)
```

Wait — the vault name 'Test Import Vault' is what we just imported, so it should appear in the wallet list. This is more specific and verifies the navigation actually completed.

**Line 241** — sleep after relaunch in Persistence beforeAll:
```js
// BEFORE
await device.disableSynchronization()
await new Promise((r) => setTimeout(r, 3000))

// AFTER — wait for some UI to be present
await device.disableSynchronization()
await waitFor(element(by.text('Test Import Vault')).or(element(by.id('migration-cta'))))
  .toBeVisible()
  .withTimeout(30000)
```

Simpler version without `.or()`:

```js
await device.disableSynchronization()
// The next test checks migration-cta doesn't appear and vault name does.
// Wait for any top-level screen to load.
await waitFor(element(by.text('Your wallets')))
  .toBeVisible()
  .withTimeout(30000)
```

Hmm, but 'Your wallets' might not be the text shown if we're on the main screen. Let me check what the wallet list actually shows. The test at line 264 waits for 'Test Import Vault' — so the wallet list screen must be visible. Use that:

```js
await device.disableSynchronization()
await waitFor(element(by.text('Test Import Vault')))
  .toBeVisible()
  .withTimeout(30000)
```

Then the test `'should show imported vault in wallet list'` becomes a simple `expect`:

```js
it('should show imported vault in wallet list', async () => {
  await expect(element(by.text('Test Import Vault'))).toBeVisible()
})
```

- [ ] **Step 5: Fix agentmail.js line 157**

This sleep is inside the dead `migrateOneWallet` function — already deleted in Task 8. No action needed.

- [ ] **Step 6: Commit**

```bash
git add e2e/fast-vault-creation.test.js e2e/fast-vault-migration.test.js e2e/fast-vault-partial-migration.test.js e2e/import-vault.test.js
git commit -m "refactor(e2e): replace hardcoded sleeps with waitFor

Remove setTimeout calls from test files and replace with proper Detox
waitFor patterns that wait for specific UI elements. Polling sleeps in
the keygen retry loop are kept but reduced from 10s to 5s."
```

---

### Task 10: Restore bail: 1

**Files:**
- Modify: `e2e/jest.config.js`

- [ ] **Step 1: Change bail from 0 to 1**

In `e2e/jest.config.js`, change:

```js
bail: 0,
```

to:

```js
bail: 1,
```

- [ ] **Step 2: Commit**

```bash
git add e2e/jest.config.js
git commit -m "fix(e2e): restore bail: 1 for fast failure feedback in CI"
```

---

### Task 11: Fix AuthMenu button visibility via scrollTo (not layout hacks)

On the e2e branch, the AuthMenu padding changes from `43c8918` and `7ec6a0d` exist. Instead of relying on them, update tests to use `scrollTo('bottom')` to reach dev buttons, then revert the padding hacks.

**Files:**
- Modify: `e2e/fast-vault-partial-migration.test.js`
- Modify: `src/screens/auth/AuthMenu.tsx`

- [ ] **Step 1: Update fast-vault-partial-migration to scroll to dev button**

In `e2e/fast-vault-partial-migration.test.js`, before the line that taps `dev-seed-corrupt`, add a scroll:

```js
await waitFor(element(by.text('Create New Wallet')))
  .toBeVisible()
  .withTimeout(180000)

// Dev buttons may be below the fold — scroll to bottom
await element(by.id('auth-scroll')).scrollTo('bottom')

await element(by.id('dev-seed-corrupt')).tap()
```

- [ ] **Step 2: Revert AuthMenu padding to pre-Detox state**

In `src/screens/auth/AuthMenu.tsx`, change the contentContainerStyle back:

```js
// BEFORE (Detox hack)
contentContainerStyle={[
  styles.content,
  {
    paddingTop: insets.top + 60,
    paddingBottom: Math.max(40, insets.bottom + 16),
  },
]}

// AFTER (original values)
contentContainerStyle={[
  styles.content,
  {
    paddingTop: insets.top + 120,
  },
]}
```

The `testID="auth-scroll"` on the ScrollView stays — it's non-invasive and tests need it.

- [ ] **Step 3: Check if any other test files tap dev buttons that might need scrolling**

```bash
grep -n 'dev-seed-corrupt\|dev-create-fast-vault\|dev-crypto-test\|dev-full-e2e-test\|Seed Legacy Data' e2e/*.test.js
```

For each match, check if the button is likely below the fold with the restored padding. Buttons rendered early in the list (`Create New Wallet`, `Seed Legacy Data`, `Create Fast Vault`) should be visible without scrolling. Only buttons at the bottom (`Seed Corrupt Data`, `Full E2E Test`, `Crypto Tests`) may need `scrollTo('bottom')`.

Add `scrollTo('bottom')` wherever needed.

- [ ] **Step 4: Commit**

```bash
git add e2e/fast-vault-partial-migration.test.js src/screens/auth/AuthMenu.tsx
git commit -m "fix(e2e): use scrollTo instead of production padding hacks for dev buttons

Revert AuthMenu paddingTop/paddingBottom changes that were made solely
to make dev buttons visible to Detox. Use scrollTo('bottom') in tests
that need to reach buttons at the bottom of the AuthMenu."
```

---

### Task 12: Audit eraseSimulator usage (last — requires test runs)

After all other changes, audit which suites truly need a full simulator erase vs just `device.launchApp({ delete: true })`.

**Files:**
- Modify: `e2e/crypto-parity.test.js`
- Modify: `e2e/full-e2e-migration.test.js`
- Modify: `e2e/fast-vault-creation.test.js`
- Potentially: `e2e/fast-vault-migration.test.js`, `e2e/fast-vault-partial-migration.test.js`, `e2e/import-vault.test.js`

- [ ] **Step 1: Categorize suites by keychain dependency**

| Suite | Seeds legacy keychain data? | Needs clean keychain? | Verdict |
|---|---|---|---|
| `crypto-parity` | No | No | Use `{ delete: true }` only |
| `full-e2e-migration` | Yes (via dev button) | Yes (tests migration from scratch) | KEEP eraseSimulator |
| `fast-vault-creation` | No | Maybe (checks no legacy data exists) | Try `{ delete: true }` |
| `fast-vault-migration` | Yes (seeds legacy wallets) | Yes | KEEP eraseSimulator |
| `fast-vault-partial-migration` | Yes (seeds corrupt data) | Yes (keychain must be clean) | KEEP eraseSimulator |
| `import-vault` | No (uses file fixture) | Maybe | Try `{ delete: true }` |

- [ ] **Step 2: Remove eraseSimulator from crypto-parity**

In `e2e/crypto-parity.test.js`, remove the `eraseSimulator` call and its import:

```js
// BEFORE
const { eraseSimulator } = require('./helpers/simulator')

describe('Crypto Parity', () => {
  beforeAll(async () => {
    eraseSimulator(device.id)

    await device.launchApp({ delete: true, newInstance: true })

// AFTER
describe('Crypto Parity', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true })
```

- [ ] **Step 3: Remove eraseSimulator from fast-vault-creation**

Same pattern — remove import and call. This suite creates a new vault on a clean install. `{ delete: true }` should be sufficient since it doesn't depend on keychain state from a previous suite.

- [ ] **Step 4: Remove eraseSimulator from import-vault (setupWithFixture)**

In `e2e/import-vault.test.js`, the `setupWithFixture` function and the Navigation `beforeAll` both call `eraseSimulator`. Remove both calls. The `setupWithFixture` function becomes:

```js
async function setupWithFixture(fixturePath, fixtureName) {
  const udid = device.id

  await device.launchApp({
    delete: true,
    newInstance: true,
  })
  await device.terminateApp()

  stageFixture(udid, fixturePath, fixtureName)

  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()
}
```

And the Navigation `beforeAll`:

```js
beforeAll(async () => {
  await device.launchApp({
    delete: true,
    newInstance: true,
  })
  await device.disableSynchronization()
})
```

- [ ] **Step 5: Run full test suite to validate**

```bash
npx detox test --configuration ios.sim.debug
```

If any suite fails due to stale keychain state, add `eraseSimulator` back for that specific suite and re-run. Document which suites truly need it.

- [ ] **Step 6: Commit**

```bash
git add e2e/crypto-parity.test.js e2e/fast-vault-creation.test.js e2e/import-vault.test.js
git commit -m "refactor(e2e): remove unnecessary eraseSimulator calls

Only suites that seed legacy keychain data need a full simulator erase.
crypto-parity, fast-vault-creation, and import-vault use delete:true
instead, which is faster and sufficient for test isolation."
```

---

## Task Dependency Graph

```
Task 1 (create e2e branch)
  → Task 2 (generate rebase todo)
    → Task 3 (execute rebase edits)
      → Task 4 (verify UI branch)

Task 5 (switch to e2e branch)
  → Task 6 (delete legacy-migration)  ─┐
  → Task 7 (merge migration-onboarding) ├→ Task 9 (replace sleeps)
  → Task 8 (remove dead code)          ─┘    → Task 10 (restore bail)
                                                → Task 11 (AuthMenu scrollTo)
                                                  → Task 12 (eraseSimulator audit — LAST)
```

Tasks 6, 7, 8 are independent and can be done in parallel.
Tasks 9-12 must be sequential (each builds on the previous).
Phase 1 (Tasks 1-4) must complete before Phase 2 (Tasks 5-12).
