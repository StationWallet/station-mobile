/**
 * Fast Vault Migration E2E Tests
 *
 * Block 1 (always runs): UI-only tests — seed data, walk through
 * WalletDiscovery → VaultEmail → VaultPassword → KeygenProgress start.
 * These are deterministic and don't need vultiserver.
 *
 * Block 2 (integration — xdescribe): Full ceremony + email verification +
 * success screen. Requires vultiserver at api.vultisig.com to be reachable.
 * Enable by changing xdescribe → describe when running against real server.
 */
describe('Fast Vault Migration', () => {

  describe('1. Migration UI flow (deterministic)', () => {
    beforeAll(async () => {
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Seed legacy keystore data
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

      // Relaunch to trigger migration flow
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should discover wallets and show upgrade button', async () => {
      await waitFor(element(by.text('Wallets Found')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.id('upgrade-button'))).toExist();
    });

    it('should navigate to email screen on upgrade', async () => {
      await element(by.id('upgrade-button')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.text('Step 1 of 2'))).toBeVisible();
    });

    it('should validate email and navigate to password screen', async () => {
      await element(by.id('vault-email-input')).typeText('test@example.com');
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.text('Step 2 of 2'))).toBeVisible();
    });

    it('should accept matching passwords and proceed to keygen', async () => {
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();
      await waitFor(element(by.text('Fast Vault Setup')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show connecting phase during keygen', async () => {
      await waitFor(element(by.text('Connecting...')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show skip/retry when ceremony fails or times out', async () => {
      // Wait for the ceremony to fail (server unreachable or timeout)
      // The error state shows Skip and Retry buttons
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(180000);
      await expect(element(by.id('keygen-retry'))).toBeVisible();
    });

    it('should skip to next wallet or success on skip', async () => {
      await element(by.id('keygen-skip')).tap();
      // Should advance — either to next wallet's VaultEmail or MigrationSuccess
      // Detox element().or() doesn't exist; try both with a short timeout
      let advanced = false;
      try {
        await waitFor(element(by.text('Enter your email')))
          .toBeVisible()
          .withTimeout(5000);
        advanced = true;
      } catch (_) { /* not this screen */ }
      if (!advanced) {
        await waitFor(element(by.text('Migration Complete')))
          .toBeVisible()
          .withTimeout(5000);
      }
    });
  });

  // Integration tests — require vultiserver to be reachable
  // Change xdescribe → describe to run
  xdescribe('2. Full ceremony with server (integration)', () => {
    beforeAll(async () => {
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Seed Legacy Data (dev)')).tap();
      await waitFor(element(by.id('seed-done')))
        .toExist()
        .withTimeout(30000);

      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should complete DKLS ceremony and show verification screen', async () => {
      await element(by.id('upgrade-button')).tap();
      await element(by.id('vault-email-input')).typeText('test@example.com');
      await element(by.id('vault-email-next')).tap();
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();

      // Wait for DKLS ceremony + navigation to VerifyEmail (up to 3 minutes)
      await waitFor(element(by.text('Verify your email')))
        .toBeVisible()
        .withTimeout(180000);
      await expect(element(by.id('verify-code-input'))).toExist();
    });

    it('should accept verification code and show success', async () => {
      // Enter the real code from email here
      await element(by.id('verify-code-input')).typeText('1234');
      await waitFor(
        element(by.text('Wallets Upgraded!')).or(element(by.text('Migration Complete')))
      )
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should persist migration state across relaunch', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 1000));
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
      await expect(element(by.id('wallet-card-0'))).not.toExist();
    });
  });
});
