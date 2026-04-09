/**
 * Migration Onboarding E2E Tests
 *
 * Tests the REAL upgrade path: seed legacy keystore data (simulating old
 * Station app), kill app, relaunch (migrateLegacyKeystore runs on startup),
 * walk through migration UI, verify vault protobuf data integrity, then
 * confirm persistence across relaunches.
 *
 * This is critical — if migration produces incorrect vaults, users lose funds.
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

      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('routes to MigrationHome (brand new users create a fast vault)', async () => {
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000);
    });
  });

  describe('2. Real upgrade path — seed, relaunch, migrate, verify', () => {
    beforeAll(async () => {
      // PHASE 1: Seed legacy keystore data (simulates old Station app)
      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
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
      // clearKeystoreWhenFirstRun() → migrateLegacyKeystore() → legacyDataFound=true
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    // --- Migration UI flow ---

    it('shows MigrationHome with Start Migration CTA', async () => {
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('taps CTA to reach WalletsFound', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('taps Migrate on first wallet and completes migration', async () => {
      await waitFor(element(by.id('wallet-card-0-migrate')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('wallet-card-0-migrate')).tap();

      // Migration runs automatically for legacy wallets (no email/password for bulk)
      // Wait for success screen
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows success screen with OG message', async () => {
      await expect(element(by.text('You are aboard, Station OG!'))).toBeVisible();
    });

    // --- Vault data integrity verification (dev-mode inline on success screen) ---

    it('vault1: exists with correct private key', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000);
      await expect(element(by.id('verify-vault1-exists'))).toHaveText('vault1-exists: true');
      await expect(element(by.id('verify-vault1-keyshare'))).toHaveText('vault1-keyshare: true');
    });

    it('vault1: correct public key derived from private key', async () => {
      await expect(element(by.id('verify-vault1-pubkey'))).toHaveText('vault1-pubkey: true');
      await expect(element(by.id('verify-vault1-derive-check'))).toHaveText('vault1-derive-check: true');
    });

    it('vault1: correct chain config and lib type', async () => {
      await expect(element(by.id('verify-vault1-chain'))).toHaveText('vault1-chain: true');
      await expect(element(by.id('verify-vault1-libtype'))).toHaveText('vault1-libtype: true');
    });

    it('vault2: exists with correct key material', async () => {
      await expect(element(by.id('verify-vault2-exists'))).toHaveText('vault2-exists: true');
      await expect(element(by.id('verify-vault2-pubkey'))).toHaveText('vault2-pubkey: true');
      await expect(element(by.id('verify-vault2-keyshare'))).toHaveText('vault2-keyshare: true');
    });

    it('ledger vault: exists with no key material', async () => {
      await expect(element(by.id('verify-ledger-exists'))).toHaveText('ledger-exists: true');
      await expect(element(by.id('verify-ledger-no-keyshares'))).toHaveText('ledger-no-keyshares: true');
      await expect(element(by.id('verify-ledger-no-pubkey'))).toHaveText('ledger-no-pubkey: true');
    });

    it('all vault integrity checks pass', async () => {
      await expect(element(by.id('verify-all-passed'))).toHaveText('all-passed: true');
    });

    // --- Complete migration ---

    it('taps Continue to complete migration', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 1000));
    });
  });

  describe('3. Persistence — migration not shown again', () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('vaultsUpgraded persists — migration flow is skipped', async () => {
      await expect(element(by.id('migration-cta'))).not.toExist();
    });
  });
});
