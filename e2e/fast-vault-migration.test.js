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
      // Note: detoxURLBlacklistRegex on initial launch causes hangs — only use on relaunches
      await device.launchApp({
        delete: true,
        newInstance: true,
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
      await device.launchApp({ newInstance: true });
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

      await waitFor(element(by.text('Start Migration')))
        .toBeVisible()
        .withTimeout(90000);
    });

    it('should navigate to wallet list', async () => {
      await new Promise(r => setTimeout(r, 3000));
      await element(by.text('Start Migration')).tap();
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
    // Per-wallet migration shows imported-* verification for the last migrated wallet.

    it('should show migration success with vault verification', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000);
      await expect(element(by.id('verify-imported-exists')))
        .toHaveText('imported-exists: true');
      await expect(element(by.id('verify-imported-name')))
        .toHaveText('imported-name: true');
    });

    it('migrated vault has valid key material', async () => {
      await expect(element(by.id('verify-imported-has-pubkey')))
        .toHaveText('imported-has-pubkey: true');
      await expect(element(by.id('verify-imported-has-keyshare')))
        .toHaveText('imported-has-keyshare: true');
    });

    it('migrated vault has correct lib type and signers', async () => {
      await expect(element(by.id('verify-imported-libtype')))
        .toHaveText('imported-libtype: true');
      await expect(element(by.id('verify-imported-has-signers')))
        .toHaveText('imported-has-signers: true');
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

      // Wait for WalletList to show — app routes to Main after migration
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(90000);
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
      await device.launchApp({ newInstance: true });
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
