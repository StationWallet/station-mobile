describe('Legacy Keystore Migration', () => {
  beforeAll(async () => {
    // Erase simulator to clear keychain — iOS keychain items survive app deletion
    const { execSync } = require('child_process');
    const udid = device.id;
    execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
      timeout: 120000,
    });
    execSync(`xcrun simctl boot ${udid}`, { timeout: 120000 });

    await device.launchApp({ delete: true, newInstance: true });
    await device.disableSynchronization();

    // Tap the dev-only "Full E2E Test" button on AuthMenu
    await waitFor(element(by.id('dev-full-e2e-test')))
      .toBeVisible()
      .withTimeout(90000);
    await element(by.id('dev-full-e2e-test')).tap();

    // Wait for test results to render
    await waitFor(element(by.id('e2e-all-passed')))
      .toExist()
      .withTimeout(30000);
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  it('seeds legacy data successfully', async () => {
    await expect(element(by.id('e2e-step03-seeded'))).toHaveText('step03-seeded: true');
  });

  it('reads legacy data via native module', async () => {
    await expect(element(by.id('e2e-step04-legacy-read'))).toHaveText(
      'step04-legacy-read: true'
    );
  });

  it('migrates data to new expo-secure-store location', async () => {
    await expect(element(by.id('e2e-step06-new-store'))).toHaveText(
      'step06-new-store: true'
    );
  });

  it('cleans up legacy data after migration', async () => {
    await expect(element(by.id('e2e-step07-legacy-cleaned'))).toHaveText(
      'step07-legacy-cleaned: true'
    );
  });

  it('migration is idempotent', async () => {
    await expect(element(by.id('e2e-step08-idempotent'))).toHaveText(
      'step08-idempotent: true'
    );
  });

  it('all migration checks pass', async () => {
    await expect(element(by.id('e2e-all-passed'))).toHaveText(
      'all-passed: true'
    );
  });
});
