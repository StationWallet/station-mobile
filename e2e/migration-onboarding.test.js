describe('Migration Onboarding Flow', () => {

  describe('Happy path — wallets detected', () => {
    beforeAll(async () => {
      // Erase simulator to clear keychain
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

    it('shows WalletDiscovery screen with found wallets', async () => {
      // Wait for wallet discovery cards to appear
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows the Upgrade button', async () => {
      await expect(element(by.id('upgrade-button'))).toBeVisible();
    });

    it('taps Upgrade and shows progress animation', async () => {
      await element(by.id('upgrade-button')).tap();

      // Wait for first progress card
      await waitFor(element(by.id('progress-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('navigates to success screen after migration', async () => {
      // Wait for success screen
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows migrated wallet names on success screen', async () => {
      await expect(element(by.id('success-wallet-0'))).toBeVisible();
    });

    it('taps Continue and lands on main app', async () => {
      await element(by.id('continue-button')).tap();

      // Should land on wallet home or picker
      await waitFor(element(by.id('wallet-home')).or(element(by.id('wallet-picker'))))
        .toBeVisible()
        .withTimeout(15000);
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

    it('skips migration and shows onboarding or auth screen', async () => {
      // Should see either onboarding "Get started" or auth menu
      const onboarding = element(by.text('Get started'));
      const authMenu = element(by.text('Create New Wallet'));

      await waitFor(onboarding.or(authMenu))
        .toBeVisible()
        .withTimeout(30000);
    });
  });

  describe('Already migrated — vaultsUpgraded is true', () => {
    beforeAll(async () => {
      // This test assumes a previous migration was completed
      // Launch without clearing to preserve the upgraded state from first test suite
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('skips migration and goes straight to main app', async () => {
      await waitFor(element(by.id('wallet-home')).or(element(by.id('wallet-picker'))))
        .toBeVisible()
        .withTimeout(30000);
    });
  });
});
