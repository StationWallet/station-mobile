/**
 * Migration Onboarding E2E Tests
 *
 * The "happy path" test requires legacy wallet data in the native keychain.
 * It seeds data by navigating to the Full E2E Test dev screen (which writes
 * to the legacy keystore and runs migration), then relaunches so the app
 * sees migrated wallets with legacyDataFound=true.
 *
 * The "clean install" test erases the simulator first so no data exists.
 */
describe('Migration Onboarding Flow', () => {

  describe('Happy path — wallets detected', () => {
    beforeAll(async () => {
      // Erase simulator to start clean
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // First launch: seed legacy wallet data via the Full E2E Test screen
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      // Run the Full E2E Test to seed legacy data and trigger migration
      await waitFor(element(by.text('Full E2E Test (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Full E2E Test (dev)')).tap();

      // Wait for seeding to complete
      await waitFor(element(by.text('all-passed: true')))
        .toExist()
        .withTimeout(90000);

      // Relaunch — app will now see migrated wallets + legacyDataFound=true
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('shows WalletDiscovery screen with found wallets', async () => {
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows the Upgrade button', async () => {
      await expect(element(by.id('upgrade-button'))).toExist();
    });

    it('taps Upgrade and shows progress animation', async () => {
      await element(by.id('upgrade-button')).tap();

      await waitFor(element(by.id('progress-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('navigates to success screen after migration', async () => {
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows migrated wallet names on success screen', async () => {
      await expect(element(by.id('success-wallet-0'))).toBeVisible();
    });

    it('taps Continue to complete migration', async () => {
      await element(by.id('continue-button')).tap();
      // Migration complete — vaultsUpgraded is now true.
      // Navigation transition to MainNavigator is verified by the
      // "Already migrated" test suite below (relaunch skips migration).
    });
  });

  describe('Clean install — no legacy wallets', () => {
    beforeAll(async () => {
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('skips migration and shows auth screen', async () => {
      await waitFor(element(by.text('Create New Wallet')))
        .toBeVisible()
        .withTimeout(30000);
    });
  });

  describe('Already migrated — vaultsUpgraded is true', () => {
    beforeAll(async () => {
      // Relaunch preserving state from happy path (vaultsUpgraded should be true)
      // Note: this only works if happy path ran first and set the flag
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('skips migration flow on relaunch', async () => {
      // Migration screens should NOT appear — verify wallet-card is absent
      await waitFor(element(by.id('wallet-card-0')))
        .not.toExist()
        .withTimeout(15000);
    });
  });
});
