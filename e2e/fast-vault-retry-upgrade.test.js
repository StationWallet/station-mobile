/**
 * Retry Upgrade from Main UI — E2E Test
 *
 * Tests the "Upgrade to Fast Vault" action from the wallet list/home screen.
 * Starts with a pre-migrated KEYIMPORT vault (legacy), then completes the
 * DKLS ceremony from the main app UI.
 *
 * Flow:
 *   1. Seed pre-migrated KEYIMPORT vault (DevSeedPreMigrated)
 *   2. Launch app → Main route (vaultsUpgraded is true)
 *   3. Navigate to wallet → see "Legacy" badge
 *   4. Tap "Upgrade to Fast Vault"
 *   5. Complete VaultEmail → VaultPassword → KeygenProgress → VerifyEmail
 *   6. Return to main app
 *   7. Verify wallet is now a fast vault (no Legacy badge)
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const { execSync } = require('child_process');
const {
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
} = require('./helpers/agentmail');

describe('Retry Upgrade from Main UI', () => {
  let knownMessageIds = new Set();

  describe('Setup — seed pre-migrated KEYIMPORT vault', () => {
    beforeAll(async () => {
      // Erase the simulator to clear keychain (delete:true doesn't clear iOS keychain)
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Phase 1: Fresh launch to seed pre-migrated data
      // NOTE: Do NOT pass detoxURLBlacklistRegex here — it causes launchApp to hang
      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();

      // After erase, app starts fresh → Auth route → AuthMenu
      await waitFor(element(by.text('Seed Pre-Migrated (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Seed Pre-Migrated (dev)')).tap();

      await waitFor(element(by.id('seed-premigrated-done')))
        .toExist()
        .withTimeout(30000);

      // Phase 2: Relaunch — should go to Main route (vaultsUpgraded=true)
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 5000));

      // Snapshot agentmail
      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should show main app (not migration flow)', async () => {
      // Should NOT show MigrationHome
      let migrationShown = false;
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000);
        migrationShown = true;
      } catch {}

      if (migrationShown) {
        throw new Error('Migration flow should not appear — vaultsUpgraded is true');
      }
    });

    it('should show wallet with Legacy badge', async () => {
      // WalletHome should be visible with the wallet
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Legacy badge should be visible
      await waitFor(element(by.text('Legacy')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show Upgrade to Fast Vault button', async () => {
      await waitFor(element(by.id('upgrade-to-fast-vault')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('DKLS upgrade from wallet screen', () => {
    it('should tap Upgrade and show VaultEmail', async () => {
      // Snapshot messages before starting
      const preUpgradeIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      for (const id of preUpgradeIds) knownMessageIds.add(id);

      await element(by.id('upgrade-to-fast-vault')).tap();

      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should fill email and advance to password', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).clearText();
      await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
      await element(by.id('vault-email-next')).tap();

      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should fill password, run DKLS ceremony, and show email verification', async () => {
      // Snapshot agentmail before keygen
      const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      for (const id of preKeygenIds) knownMessageIds.add(id);

      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-continue')).tap();

      // DKLS ceremony runs → VerifyEmail appears (may skip KeygenProgress if fast)
      await waitFor(element(by.text('Verify your email')))
        .toExist()
        .withTimeout(150000);
    });

    it('should verify email with OTP', async () => {
      const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
      await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
      await element(by.id('verify-code-input')).tap();
      await element(by.id('verify-code-input')).replaceText(otp);

      // Wait for verification + navigation
      await new Promise(r => setTimeout(r, 5000));
    });

    it('should show MigrationSuccess', async () => {
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000);

      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 3000));
    });
  });

  describe('Verify upgrade persisted', () => {
    beforeAll(async () => {
      // Relaunch to verify persistence
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    it('should show wallet without Legacy badge', async () => {
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Legacy badge should NOT be visible
      let legacyVisible = false;
      try {
        await waitFor(element(by.text('Legacy')))
          .toBeVisible()
          .withTimeout(3000);
        legacyVisible = true;
      } catch {}

      if (legacyVisible) {
        throw new Error('Legacy badge should not appear after successful DKLS upgrade');
      }
    });

    it('should show Export Vault Share (not Export Private Key)', async () => {
      await waitFor(element(by.id('export-key-button')))
        .toBeVisible()
        .withTimeout(5000);
      await waitFor(element(by.text('Export Vault Share')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
