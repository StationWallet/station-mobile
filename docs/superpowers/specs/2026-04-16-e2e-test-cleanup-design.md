# E2E Test Cleanup Design

**Date:** 2026-04-16
**Branch:** `ui/align-import-flow-with-vultiagent` (source) -> new e2e branch

## Problem

The e2e test suite accumulated 18 fix commits that are entangled with the UI branch. The tests work but suffer from: duplicate suites testing the same flows, hardcoded sleeps masking race conditions, inflated timeouts, `bail: 0` hiding instability, and production UI changes made solely to satisfy Detox. The branch history is noisy and hard to review.

## Goals

1. Split the branch: clean UI branch for review, separate e2e branch for test work
2. Eliminate duplicate test suites
3. Replace hardcoded sleeps with proper Detox `waitFor` patterns
4. Restore `bail: 1` and fix underlying flakes
5. Revert Detox-motivated AuthMenu production layout changes
6. Audit `eraseSimulator` usage (last — requires full test run)

## Non-Goals

- Rewriting test architecture (e.g., page-object model)
- Adding new test coverage
- Changing test behavior or flows — only infrastructure cleanup

---

## Phase 1: Branch Split

### Step 1: Create e2e branch off current HEAD

Before touching the UI branch, create `e2e/test-cleanup` off `HEAD`. This preserves the full state including all e2e work.

### Step 2: Interactive rebase on UI branch

Rebase the UI branch to remove/edit Detox-specific commits.

**DROP** (pure e2e, no src/ changes):
- `8aa2585` flatten test structure
- `1aa4a75` resolve test failures
- `5f5329b` resolve test isolation
- `7f28c38` scroll to Seed Corrupt Data button
- `579e739` use scrollTo bottom
- `5334d16` remove simctl erase from partial migration
- `afe56e3` restructure partial migration test
- `8c780ff` remove detoxURLBlacklistRegex (fast-vault-creation)
- `783d50b` remove detoxURLBlacklistRegex (import-vault)
- `e07b247` increase post-erase wait timeout
- `d20d127` disable bail
- `e63f691` lint + eslint overrides for e2e/config

**EDIT** (keep src/ hunks, drop e2e/ hunks):
- `fb7895c` — keep: refreshWallets, lazy-load expo-sharing, metro config, jest-haste-map ignore; drop: e2e/ changes
- `5a259fe` — keep: WalletList refactor, refreshWallets reuse; drop: e2e/helpers/simulator.js
- `32f4ebc` / `2d68d9e` — keep: `__DEV__` routing guard; drop: test matcher updates

**KEEP as-is:**
- All UI/design commits
- `fbc599f` lazy-load KeygenProgress
- `6c39e10` replace text back buttons with glass arrow icon
- `e043cea` merge commit from PR #38

### Step 3: Revert Detox-motivated AuthMenu changes

After rebase, create a new commit on the UI branch reverting:
- `43c8918` AuthMenu paddingTop reduction
- `7ec6a0d` bottom safe area in AuthMenu scroll content

These production layout changes were made solely to make dev buttons visible to Detox. The `testID="auth-scroll"` attribute on the ScrollView can stay (non-invasive).

---

## Phase 2: E2E Test Cleanup (on e2e branch)

### Step 4: Merge duplicate suites

**Merge `migration-onboarding.test.js` into `fast-vault-migration.test.js`:**
- migration-onboarding has one unique test: "clean install shows auth screen in dev mode"
- Move that test into fast-vault-migration as a leading describe block
- Delete migration-onboarding.test.js

**Merge `legacy-migration.test.js` into `full-e2e-migration.test.js`:**
- legacy-migration tests steps 3-8, a strict subset of full-e2e-migration's 16 steps
- Delete legacy-migration.test.js (zero unique coverage)

Result: 6 test files down from 8.

### Step 5: Replace hardcoded sleeps with waitFor

For each `setTimeout` in test files, replace with the appropriate Detox pattern:
- "Let layout settle" → `waitFor(nextElement).toBeVisible().withTimeout()`
- "Post-navigation" → `waitFor` on destination screen element
- "Post-tap" → `waitFor` on expected result element

**Exception:** `agentmail.js` polling sleeps (waiting for external email delivery) are legitimate and stay as-is.

### Step 6: Restore bail: 1

Change `e2e/jest.config.js` from `bail: 0` back to `bail: 1`. Flakes that motivated `bail: 0` should be resolved by sleep replacements.

### Step 7: Fix AuthMenu button visibility in tests

Instead of production padding changes, tests that need bottom-of-screen dev buttons should use:
```js
await element(by.id('auth-scroll')).scrollTo('bottom')
```

### Step 8: Audit eraseSimulator usage (last)

After all other fixes land, audit each suite:
- **Likely still needs erase:** fast-vault-migration, fast-vault-partial-migration, import-vault (keychain-sensitive)
- **Likely can use `{ delete: true }` only:** crypto-parity, full-e2e-migration, fast-vault-creation (no legacy keychain data)

Validate by running the full suite. This step may require iteration.

---

## Risks

- **Rebase conflicts** on entangled commits — manual resolution needed
- **Merge commit `e043cea`** may cause rebase trouble — may need to drop and replay
- **Suite consolidation** could mask regressions — run full suite after merging
- **Sleep removal** needs real test runs to validate — plan includes a "run and fix" step
- **e2e branch must be created before UI rebase** — once history is rewritten, e2e state is lost

## Final State

- **UI branch:** Clean commit history, no e2e churn, no Detox-motivated layout hacks
- **E2e branch:** 6 consolidated test files, no hardcoded sleeps, `bail: 1`, proper `waitFor` patterns, minimal `eraseSimulator` usage
- **E2e branch targets:** the UI branch (depends on testIDs and navigation from UI work)
