/**
 * Fast Vault Migration E2E Tests — Per-Wallet Flow
 *
 * Full end-to-end: seed legacy data → RiveIntro → MigrationHome →
 * WalletsFound → migrate each wallet individually (email → password →
 * keygen → verify) → MigrationSuccess → vault integrity → persistence.
 *
 * Test data: 2 standard wallets (TestWallet1, TestWallet2) + 1 Ledger wallet.
 * Ledger wallets don't need DKLS migration and should appear as already
 * migrated (no migrate button) on the WalletsFound screen.
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const { execSync } = require('child_process');
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail');

describe('Fast Vault Migration — Per-Wallet', () => {
  let knownMessageIds = new Set();

  describe('Setup and intro', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Seed legacy keystore data
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

      // Relaunch to trigger migration flow
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      // Snapshot agentmail before any wallets
      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      console.log(`[AgentMail] Starting with ${knownMessageIds.size} existing messages`);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should play RiveIntro and reach MigrationHome', async () => {
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should navigate to WalletsFound', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show wallet cards', async () => {
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show ledger wallet without migrate button', async () => {
      // The ledger wallet card should exist but should not have a migrate action
      // because ledger wallets don't need DKLS migration
      let ledgerMigrateVisible = false;
      try {
        await waitFor(element(by.id('wallet-card-2-migrate')))
          .toBeVisible()
          .withTimeout(3000);
        ledgerMigrateVisible = true;
      } catch (_) {}

      if (ledgerMigrateVisible) {
        throw new Error('Ledger wallet should not have a migrate button');
      }
    });
  });

  describe('Per-wallet migration', () => {
    it('should migrate wallet 1', async () => {
      await migrateOneWalletFromCard(0, 'TestWallet1', knownMessageIds, true);
    });

    it('should migrate wallet 2', async () => {
      await migrateOneWalletFromCard(1, 'TestWallet2', knownMessageIds, false);
    });
  });

  describe('Vault integrity verification', () => {
    it('should show migration success with vault verification', async () => {
      // DevVerifyVault is rendered on MigrationSuccess in dev mode.
      // Wait for all checks to complete.
      await waitFor(element(by.id('verify-vault1-exists')))
        .toExist()
        .withTimeout(15000);

      // Wait for all-passed to render
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(10000);
    });

    it('DKLS keyshares are loadable by native module', async () => {
      // DevVerifyVault loads each DKLS keyshare via ExpoDkls.loadKeyshare()
      // If loadable, the keyshare is structurally valid for signing.
      await waitFor(element(by.id('verify-vault1-keyshare-loadable')))
        .toExist()
        .withTimeout(10000);
      await expect(element(by.id('verify-vault1-keyshare-loadable')))
        .toHaveText('vault1-keyshare-loadable: true');
      await expect(element(by.id('verify-vault1-keyshare-has-keyid')))
        .toHaveText('vault1-keyshare-has-keyid: true');

      await waitFor(element(by.id('verify-vault2-keyshare-loadable')))
        .toExist()
        .withTimeout(5000);
      await expect(element(by.id('verify-vault2-keyshare-loadable')))
        .toHaveText('vault2-keyshare-loadable: true');
    });

    it('DKLS vaults have correct structure', async () => {
      await expect(element(by.id('verify-vault1-vault-type')))
        .toHaveText('vault1-vault-type: DKLS');
      await expect(element(by.id('verify-vault1-signers')))
        .toHaveText('vault1-signers: true');
      await expect(element(by.id('verify-vault1-local-party')))
        .toHaveText('vault1-local-party: true');
    });

    it('all vault verification checks pass', async () => {
      await expect(element(by.id('verify-all-passed')))
        .toHaveText('all-passed: true');
    });

    it('should dismiss migration and show main app', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 2000));
    });
  });

  describe('Export DKLS vault', () => {
    beforeAll(async () => {
      // Relaunch and navigate to WalletHome
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      // Wait for either WalletPicker or WalletHome
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(15000);

      // If we see "Select Wallet" title, we're on WalletPicker — tap the wallet
      try {
        await expect(element(by.text('Select Wallet'))).toBeVisible();
        await element(by.text('TestWallet1')).tap();
        await new Promise(r => setTimeout(r, 2000));
      } catch {
        // Already on WalletHome
      }
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should show Export Vault Share and navigate to export screen', async () => {
      // WalletHome should show the wallet name
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Swipe up to reveal the export button (below the fold)
      await element(by.id('wallet-home-scroll')).swipe('up', 'slow', 0.7);
      await new Promise(r => setTimeout(r, 1000));

      // For DKLS vault, button text should say "Export Vault Share"
      await waitFor(element(by.text('Export Vault Share')))
        .toBeVisible()
        .withTimeout(10000);

      // Tap to navigate to export screen
      await element(by.text('Export Vault Share')).tap();

      // ExportPrivateKey screen: "Export as Vault Share" button visible directly
      await waitFor(element(by.text('Export as Vault Share')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show export password form when tapping Export as Vault Share', async () => {
      await element(by.text('Export as Vault Share')).tap();

      // Export form should appear with password input
      await waitFor(element(by.text('Set a password to encrypt the vault file:')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should not show raw private key reveal for DKLS vault', async () => {
      // The "Reveal Private Key" button should NOT be present for fast vaults
      let revealVisible = false;
      try {
        await waitFor(element(by.text('Reveal Private Key')))
          .toBeVisible()
          .withTimeout(2000);
        revealVisible = true;
      } catch {}

      if (revealVisible) {
        throw new Error('Raw key reveal should be hidden for DKLS vaults');
      }
    });
  });

  describe('Persistence — migration not shown again', () => {
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

    it('should not show migration flow on relaunch', async () => {
      // migration-cta should not appear — migration is complete
      let migrationShown = false;
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000);
        migrationShown = true;
      } catch (_) {}

      if (migrationShown) {
        throw new Error('Migration flow should not appear after successful migration');
      }
    });
  });
});
