/**
 * Fast Vault Migration E2E Tests — Per-Wallet Flow
 *
 * Full end-to-end: seed legacy data → RiveIntro → MigrationHome →
 * wallet list → migrate each wallet individually (email → password →
 * keygen → verify) → MigrationSuccess → vault integrity → persistence.
 *
 * Test data: 2 standard wallets (TestWallet1, TestWallet2) + 1 Ledger wallet.
 * Ledger wallets don't need DKLS migration and should appear as already
 * migrated (no migrate button) on the wallet list screen.
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
        timeout: 120000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 120000 });

      // Seed legacy keystore data
      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(90000);
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
      // Tap through RiveIntro
      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('enter-vultiverse-cta')).tap();

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(90000);
    });

    it('should navigate to wallet list', async () => {
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

    it('should show wallet 1 as migrated after returning to wallet list', async () => {
      // After migrating wallet 0 and tapping "Migrate another wallet",
      // wallet 0's card should show the "✓ Fast Vault" badge, not the migrate button
      let migrateButtonVisible = false;
      try {
        await waitFor(element(by.id('wallet-card-0-migrate')))
          .toBeVisible()
          .withTimeout(3000);
        migrateButtonVisible = true;
      } catch (_) {}

      if (migrateButtonVisible) {
        throw new Error('Wallet 0 should show as migrated (no migrate button) after successful migration');
      }
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
      await element(by.id('success-back')).tap();
      await new Promise(r => setTimeout(r, 2000));
    });
  });

  describe('Export DKLS vault', () => {
    beforeAll(async () => {
      // Relaunch — app lands on WalletList
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();

      // Wait for WalletList to show
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(15000);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should show Export Vault Share and navigate to export screen', async () => {
      // WalletList should show the wallet
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Tap the Export button on the wallet card
      await waitFor(element(by.id('wallet-card-0-export')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('wallet-card-0-export')).tap();

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
