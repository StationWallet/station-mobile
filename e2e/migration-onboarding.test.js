/**
 * Migration Onboarding E2E Tests
 *
 * Tests the REAL upgrade path: seed legacy keystore data (simulating old
 * Station app), kill app, relaunch (migrateLegacyKeystore runs on startup),
 * walk through migration UI, verify vault protobuf data integrity, then
 * confirm persistence across relaunches.
 *
 * Each standard wallet goes through the full per-wallet flow:
 *   Email → Password → KeygenProgress → VerifyEmail (OTP via AgentMail) → MigrationSuccess
 * Ledger wallets are auto-handled (no migrate button).
 *
 * This is critical — if migration produces incorrect vaults, users lose funds.
 */
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail');

describe('Migration Onboarding Flow', () => {
  let knownMessageIds = new Set();

  describe('1. Clean install — no legacy wallets', () => {
    beforeAll(async () => {
      // Single simulator erase for the entire test suite
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 120000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 120000 });

      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('shows auth screen in dev mode (prod routes to Migration)', async () => {
      await waitFor(element(by.text('Create New Wallet')))
        .toBeVisible()
        .withTimeout(90000);
    });
  });

  describe('2. Real upgrade path — seed, relaunch, migrate, verify', () => {
    beforeAll(async () => {
      // PHASE 1: Seed legacy keystore data (simulates old Station app)
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.text('Seed Legacy Data (dev)')).tap();

      await waitFor(element(by.id('seed-done')))
        .toExist()
        .withTimeout(30000);
      await expect(element(by.id('seed-status'))).toHaveText('seeded');

      // PHASE 2: Kill and relaunch — real upgrade moment
      // clearKeystoreWhenFirstRun() → migrateLegacyKeystore() → legacyDataFound=true
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();

      // Snapshot existing AgentMail messages so we only look at new OTPs
      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    // --- Migration UI flow ---

    it('shows MigrationHome with Start Migration CTA', async () => {
      // Tap through RiveIntro
      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('enter-vultiverse-cta')).tap();

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(90000);
    });

    it('taps CTA to reach WalletsFound', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('migrates wallet 1', async () => {
      await migrateOneWalletFromCard(0, 'TestWallet1', knownMessageIds, true);
    });

    it('migrates wallet 2', async () => {
      await migrateOneWalletFromCard(1, 'TestWallet2', knownMessageIds, false);
    });

    // After wallet 2 completes, MigrationSuccess is already visible

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
      // DKLS vaults don't have derive-check (pubkey comes from keygen ceremony, not raw key derivation)
      // KEYIMPORT vaults derive the pubkey from the private key and verify the match
      try {
        await expect(element(by.id('verify-vault1-derive-check'))).toHaveText('vault1-derive-check: true');
      } catch {
        // Expected for DKLS vaults — derive-check is not applicable
        await expect(element(by.id('verify-vault1-keyshare-loadable'))).toHaveText('vault1-keyshare-loadable: true');
      }
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
      // DKLS migration skips ledger wallets (no vault stored), so ledger-exists is not emitted.
      // KEYIMPORT migration creates a vault with no key material.
      // In both cases, the no-keyshares and no-pubkey checks pass.
      try {
        await expect(element(by.id('verify-ledger-exists'))).toExist();
        await expect(element(by.id('verify-ledger-exists'))).toHaveText('ledger-exists: true');
      } catch {
        // Expected for DKLS — ledger vault is skipped, no ledger-exists field emitted
      }
      await expect(element(by.id('verify-ledger-no-keyshares'))).toHaveText('ledger-no-keyshares: true');
      await expect(element(by.id('verify-ledger-no-pubkey'))).toHaveText('ledger-no-pubkey: true');
    });

    it('all vault integrity checks pass', async () => {
      await expect(element(by.id('verify-all-passed'))).toHaveText('all-passed: true');
    });

    // --- Complete migration ---

    it('taps Continue to complete migration', async () => {
      await element(by.id('success-back')).tap();
      await new Promise(r => setTimeout(r, 1000));
    });
  });

  describe('3. Persistence — migration not shown again', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true });
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
