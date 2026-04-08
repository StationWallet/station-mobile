/**
 * Partial Fast Vault Migration E2E Test
 *
 * Tests the skip/retry flow on the KeygenProgress screen when a wallet's
 * keygen ceremony fails (e.g. vultiserver unreachable or times out).
 *
 * Flow:
 *   1. Seed legacy data (same as migration-onboarding.test.js)
 *   2. Relaunch app → migration UI appears
 *   3. Tap Upgrade → VaultEmail → VaultPassword → KeygenProgress
 *   4. If keygen fails, Skip/Retry buttons appear (testID: keygen-skip, keygen-retry)
 *   5. Tap Skip → advances to next wallet / MigrationSuccess
 *   6. MigrationSuccess shows "Migration Complete" (partial) with a warning row
 *
 * NOTE: The skip/retry sub-suite (describe block 2) requires vultiserver to be
 * unreachable so that keygen fails and the error UI appears. This is
 * non-deterministic in CI, so it is marked with xdescribe and intended to be
 * run as a manual / local-integration test.
 *
 * To run manually:
 *   1. Ensure vultiserver is not reachable (e.g. no network / wrong host)
 *   2. Change xdescribe → describe in block 2 below
 *   3. npx detox test -c ios.sim.debug e2e/fast-vault-partial-migration.test.js
 */

describe('Partial Fast Vault Migration', () => {
  // ─── Block 1: Seeding + navigation to KeygenProgress ──────────────────────
  // This block seeds legacy data and walks through the migration UI to confirm
  // that the KeygenProgress screen loads. It does NOT depend on keygen failing.

  describe('1. Setup — seed legacy data and navigate to keygen', () => {
    beforeAll(async () => {
      // Erase simulator so keychain items from previous runs don't leak.
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // PHASE 1: Fresh launch — tap the dev button to seed legacy keystore data.
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Seed Legacy Data (dev)')).tap();

      await waitFor(element(by.id('seed-done')))
        .toExist()
        .withTimeout(30000);
      await expect(element(by.id('seed-status'))).toHaveText('seeded');

      // PHASE 2: Kill and relaunch — simulates real upgrade moment.
      // migrateLegacyKeystore() runs on startup → legacyDataFound=true → WalletDiscovery.
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('shows WalletDiscovery with legacy wallets', async () => {
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows the Upgrade button', async () => {
      await expect(element(by.id('upgrade-button'))).toExist();
    });

    it('taps Upgrade and shows VaultEmail for the first standard wallet', async () => {
      await element(by.id('upgrade-button')).tap();
      await waitFor(element(by.id('vault-email-input')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('fills email and advances to VaultPassword', async () => {
      await element(by.id('vault-email-input')).typeText('test@example.com');
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.id('vault-password-input')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('fills password and advances to KeygenProgress', async () => {
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();
      // KeygenProgress renders the progress bar — no specific testID on the screen
      // root, so wait for the error section OR for the success result.
      // We only assert that we've left VaultPassword (email input gone).
      await waitFor(element(by.id('vault-password-input')))
        .not.toBeVisible()
        .withTimeout(10000);
    });
  });

  // ─── Block 2: Skip/retry flow — requires vultiserver to be unreachable ─────
  // Marked xdescribe so it does not run automatically in CI.
  // Change to `describe` for local manual testing with network blocked.

  xdescribe('2. [MANUAL] Skip wallet when keygen fails', () => {
    // NOTE: This block intentionally does NOT have a beforeAll that relaunches
    // the app — it continues from the state left by Block 1. When running this
    // block in isolation, re-seed and navigate manually or combine with block 1.

    it('shows Skip and Retry buttons after keygen failure', async () => {
      // KeygenProgress shows error UI (keygen-skip + keygen-retry) when the
      // ceremony fails. Timeout is generous because the failure may take up to
      // the importKeyToFastVault network timeout.
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(130000);
      await expect(element(by.id('keygen-retry'))).toBeVisible();
    });

    it('taps Retry and shows progress resuming', async () => {
      // Retry triggers runCeremony() again — the skip/retry row disappears.
      await element(by.id('keygen-retry')).tap();
      await waitFor(element(by.id('keygen-skip')))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it('waits for second failure and skips the wallet', async () => {
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(130000);
      await element(by.id('keygen-skip')).tap();
    });

    it('skipping advances to VaultEmail for next wallet or MigrationSuccess', async () => {
      // After skip, KeygenProgress calls advanceToNextWallet({ success: false }).
      // If there are more wallets, VaultEmail appears; if not, MigrationSuccess.
      // Wait for either to appear.
      let advanced = false;
      try {
        await waitFor(element(by.id('vault-email-input')))
          .toBeVisible()
          .withTimeout(10000);
        advanced = true;
      } catch {
        // Only wallet — expect MigrationSuccess instead
        await waitFor(element(by.id('continue-button')))
          .toBeVisible()
          .withTimeout(10000);
        advanced = true;
      }
      await expect(advanced).toBe(true);
    });
  });

  // ─── Block 3: Mixed results on MigrationSuccess ────────────────────────────
  // Validates MigrationSuccess rendering when at least one wallet was skipped.
  // Also marked xdescribe because it follows from block 2's skipped state.

  xdescribe('3. [MANUAL] MigrationSuccess shows mixed results after skip', () => {
    it('shows "Migration Complete" title (partial success)', async () => {
      // titleText is "Wallets Upgraded!" (all), "Migration Complete" (partial),
      // or "Migration Failed" (none). After skipping one wallet, expect partial.
      await waitFor(element(by.text('Migration Complete')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('shows at least one wallet row with a warning icon', async () => {
      // The skipped wallet renders with testID success-wallet-N.
      // We can check that the "Legacy — upgrade in wallet list" label is present.
      await expect(element(by.text('Legacy — upgrade in wallet list'))).toExist();
    });

    it('shows the Continue button', async () => {
      await expect(element(by.id('continue-button'))).toBeVisible();
    });

    it('success-wallet-0 row exists', async () => {
      await expect(element(by.id('success-wallet-0'))).toBeVisible();
    });
  });
});
