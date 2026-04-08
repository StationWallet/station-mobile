/**
 * Fast Vault Migration E2E Tests
 *
 * Tests the complete fast vault migration flow: seed legacy keystore,
 * relaunch to trigger migration UI, walk through WalletDiscovery →
 * VaultEmail → VaultPassword → KeygenProgress → MigrationSuccess,
 * then verify persistence across relaunches.
 *
 * Pattern matches migration-onboarding.test.js — simulator erase for
 * clean keychain, seed via dev button, then real upgrade path.
 */
describe('Fast Vault Migration', () => {

  describe('1. Seed legacy data and trigger migration UI', () => {
    beforeAll(async () => {
      // Erase simulator to clear keychain — iOS keychain items survive
      // app deletion, causing the app to find old wallets and skip AuthMenu.
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // PHASE 1: Seed legacy keystore data (simulates old Station app)
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

      // PHASE 2: Kill and relaunch — real upgrade moment
      // migrateLegacyKeystore() runs on startup → legacyDataFound=true → shows migration flow
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    // --- WalletDiscovery screen ---

    it('should discover wallets and show upgrade button', async () => {
      await waitFor(element(by.text('Wallets Found')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.id('upgrade-button'))).toExist();
    });

    // --- VaultEmail screen ---

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

    // --- VaultPassword screen ---

    it('should accept matching passwords and proceed to keygen', async () => {
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();
      // KeygenProgress screen — shows phase text while ceremony runs
      await waitFor(element(by.text('Fast Vault Setup')))
        .toBeVisible()
        .withTimeout(10000);
    });

    // --- KeygenProgress screen ---

    it('should show connecting phase during keygen', async () => {
      // 'Connecting...' appears while progress < 35%; visible briefly at start
      await waitFor(element(by.text('Connecting...')))
        .toBeVisible()
        .withTimeout(10000);
    });

    // --- MigrationSuccess screen ---

    it('should complete migration and show success screen', async () => {
      // Wait for DKLS key-import ceremony to complete (up to 3 minutes)
      await waitFor(
        element(by.text('Wallets Upgraded!')).or(element(by.text('Migration Complete')))
      )
        .toBeVisible()
        .withTimeout(180000);
    });

    it('should show migrated wallet result on success screen', async () => {
      await expect(element(by.id('success-wallet-0'))).toBeVisible();
    });

    it('should dismiss migration flow on continue', async () => {
      await element(by.id('continue-button')).tap();
      // Brief pause for navigation to settle
      await new Promise(r => setTimeout(r, 1000));
    });
  });

  describe('2. Persistence — migration not shown again after completion', () => {
    beforeAll(async () => {
      // Relaunch without erasing — vaultsUpgraded flag must survive
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('vaultsUpgraded flag persists — migration flow is not shown again', async () => {
      // WalletDiscovery should not appear after vaultsUpgraded is set
      await expect(element(by.id('wallet-card-0'))).not.toExist();
    });
  });
});
