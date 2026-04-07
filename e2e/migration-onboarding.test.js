/**
 * Migration Onboarding E2E Tests
 *
 * Order matters: clean install runs first (single simulator erase),
 * then happy path seeds data on the clean state, then already-migrated
 * reuses that state. This minimizes simulator erases (slow ~20s boot).
 */
describe('Migration Onboarding Flow', () => {

  describe('1. Clean install — no legacy wallets', () => {
    beforeAll(async () => {
      // Single simulator erase for the entire test suite
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

  describe('2. Happy path — wallets detected', () => {
    beforeAll(async () => {
      // Seed legacy wallet data via the Full E2E Test screen
      // (simulator is already clean from suite 1)
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      await waitFor(element(by.text('Full E2E Test (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Full E2E Test (dev)')).tap();

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
      // Let the async preference write (vaultsUpgraded=true) flush to keychain
      await new Promise(r => setTimeout(r, 1000));
    });
  });

  // Note: "vaultsUpgraded" persistence across app kills is verified
  // manually. Detox kills the process before the async keychain write
  // from handleContinue can flush, making automated verification unreliable.
});
