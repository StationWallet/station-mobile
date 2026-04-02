describe('Legacy Keystore Migration', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();

    // Tap the dev-only "Migration Test" button on AuthMenu
    await waitFor(element(by.id('dev-migration-test')))
      .toBeVisible()
      .withTimeout(30000);
    await element(by.id('dev-migration-test')).tap();

    // Wait for test results to render
    await waitFor(element(by.id('migration-all-passed')))
      .toExist()
      .withTimeout(30000);
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  it('seeds legacy data successfully', async () => {
    await expect(element(by.id('migration-seeded'))).toHaveText('seeded: true');
  });

  it('reads legacy data via native module', async () => {
    await expect(element(by.id('migration-legacy-readable'))).toHaveText(
      'legacy-readable: true'
    );
  });

  it('migrates data to new expo-secure-store location', async () => {
    await expect(element(by.id('migration-new-readable'))).toHaveText(
      'new-readable: true'
    );
  });

  it('cleans up legacy data after migration', async () => {
    await expect(element(by.id('migration-legacy-cleaned'))).toHaveText(
      'legacy-cleaned: true'
    );
  });

  it('migration is idempotent', async () => {
    await expect(element(by.id('migration-idempotent'))).toHaveText(
      'idempotent: true'
    );
  });

  it('preserves wallet name', async () => {
    await expect(element(by.id('migration-wallet-name'))).toHaveText(
      'wallet-name: TestLegacyWallet'
    );
  });

  it('preserves wallet address', async () => {
    await expect(element(by.id('migration-wallet-address'))).toHaveText(
      'wallet-address: terra1test000legacy000migration000addr'
    );
  });

  it('all migration checks pass', async () => {
    await expect(element(by.id('migration-all-passed'))).toHaveText(
      'all-passed: true'
    );
  });
});
