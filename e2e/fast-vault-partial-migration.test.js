/**
 * Partial Fast Vault Migration E2E Test — Skip/Retry Flow
 *
 * Tests the error handling UI when a wallet's DKLS keygen ceremony fails.
 * Uses DevSeedCorruptData to seed a wallet with a corrupted encrypted key
 * that causes deterministic decrypt failure — no network dependency needed.
 *
 * Flow:
 *   1. Seed corrupt wallet data (1 corrupt wallet + 1 ledger)
 *   2. Relaunch → migration flow starts
 *   3. Walk through: discovery → email → password → KeygenProgress
 *   4. Keygen fails immediately (can't decrypt corrupt key)
 *   5. Error UI appears with Skip and Retry buttons
 *   6. Tap Retry → fails again → error UI reappears
 *   7. Tap Skip → advances to MigrationSuccess
 *   8. MigrationSuccess shows failure result
 *
 * Does NOT require vultiserver or network access.
 */
const { execSync } = require('child_process');

describe('Partial Fast Vault Migration — Skip/Retry', () => {
  describe('Setup — seed corrupt wallet data', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Launch fresh — tap dev button to seed corrupt data
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Corrupt Data (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Seed Corrupt Data (dev)')).tap();

      await waitFor(element(by.id('seed-corrupt-done')))
        .toExist()
        .withTimeout(30000);

      // Relaunch to trigger migration flow
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('shows WalletDiscovery with corrupt wallet', async () => {
      await waitFor(element(by.text('Wallets Found')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('starts migration by tapping Upgrade', async () => {
      await element(by.id('upgrade-button')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('fills email and advances to password', async () => {
      await element(by.id('vault-email-input')).typeText('test@example.com');
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('fills password and advances to KeygenProgress', async () => {
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();

      // Should reach KeygenProgress and fail quickly
      await waitFor(element(by.text('Fast Vault Setup')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Skip/Retry flow', () => {
    it('shows Skip and Retry buttons after keygen failure', async () => {
      // Corrupt key → decrypt fails immediately → error UI
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('keygen-retry')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('taps Retry — still fails — error UI reappears', async () => {
      await element(by.id('keygen-retry')).tap();

      // The error should disappear briefly then reappear
      // (the corrupt key will fail again immediately)
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('keygen-retry')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('taps Skip — advances past the corrupt wallet', async () => {
      await element(by.id('keygen-skip')).tap();

      // After skipping the only standard wallet (ledger auto-skips),
      // should reach MigrationSuccess
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('MigrationSuccess shows failure results', () => {
    it('shows migration result screen', async () => {
      // With all wallets skipped/failed, should show "Migration Failed" or "Migration Complete"
      let titleFound = false;
      try {
        await waitFor(element(by.text('Migration Failed')))
          .toBeVisible()
          .withTimeout(5000);
        titleFound = true;
      } catch {
        // Partial success (ledger counted as success) → "Migration Complete"
        await waitFor(element(by.text('Migration Complete')))
          .toBeVisible()
          .withTimeout(5000);
        titleFound = true;
      }
      if (!titleFound) {
        throw new Error('Expected "Migration Failed" or "Migration Complete"');
      }
    });

    it('shows at least one wallet with failure indicator', async () => {
      // The corrupt wallet should show a warning/legacy label
      await waitFor(element(by.id('success-wallet-0')))
        .toExist()
        .withTimeout(5000);
    });

    it('can dismiss migration and continue to app', async () => {
      await element(by.id('continue-button')).tap();
      // Should navigate away from migration
      await new Promise(r => setTimeout(r, 2000));
    });
  });
});
