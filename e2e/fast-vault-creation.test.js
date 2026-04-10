/**
 * Fast Vault Creation E2E Test — New User
 *
 * Clean install (no legacy wallets) → AuthMenu (dev mode) →
 * "Create Fast Vault (dev)" → RiveIntro → MigrationHome →
 * "Create a Fast Vault" → VaultName → VaultEmail → VaultPassword →
 * KeygenProgress → VerifyEmail → MigrationSuccess.
 *
 * In dev mode, fresh installs route to AuthMenu (so E2E dev seed buttons
 * are accessible). The test taps the dev-only "Create Fast Vault" button
 * to switch to the Migration navigator.
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

describe('Fast Vault Creation — New User', () => {
  let knownMessageIds = new Set();

  describe('Setup — clean install', () => {
    beforeAll(async () => {
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

      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should navigate from AuthMenu to MigrationHome', async () => {
      // In dev mode, fresh installs route to AuthMenu first.
      // Tap the dev button to switch to the Migration/creation flow.
      await waitFor(element(by.id('dev-create-fast-vault')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('dev-create-fast-vault')).tap();

      // Tap through RiveIntro → MigrationHome appears with "Create a Fast Vault"
      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('enter-vultiverse-cta')).tap();

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(90000);
    });

    it('should navigate to VaultName', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.text('Name your vault')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter vault name and advance', async () => {
      await element(by.id('vault-name-input')).typeText('My Fast Vault');
      await element(by.id('vault-name-next')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter email and advance', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter password and start keygen', async () => {
      const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      for (const id of preKeygenIds) knownMessageIds.add(id);

      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-continue')).tap();

      // Wait for keygen to finish and navigate to VerifyEmail.
      // The MPC ceremony typically completes in 30-60s but may take up to 3 min.
      // Poll every 15s to check for error or success.
      const startTime = Date.now();
      const timeoutMs = 180000;
      while (Date.now() - startTime < timeoutMs) {
        // Check if VerifyEmail appeared
        try {
          await expect(element(by.text('Verify your email'))).toExist();
          return; // Success!
        } catch {}

        // Check if error UI appeared (keygen failed)
        try {
          await expect(element(by.text('Failed'))).toExist();
          // Keygen failed — log error message and tap Retry
          try {
            const errAttrs = await element(by.id('keygen-error-text')).getAttributes();
            console.log('[Keygen] Error:', errAttrs.text || errAttrs.label || 'unknown');
          } catch { console.log('[Keygen] Error detected (could not read text)'); }
          await element(by.id('keygen-retry')).tap();
        } catch {}

        await new Promise(r => setTimeout(r, 15000));
      }
      throw new Error('Keygen did not complete within timeout');
    }, 240000);

    it('should verify email with OTP', async () => {
      const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
      await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
      await element(by.id('verify-code-input')).tap();
      await element(by.id('verify-code-input')).replaceText(otp);

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should show success with vault verification', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000);
      await expect(element(by.id('verify-all-passed')))
        .toHaveText('all-passed: true');
    });

    it('should not show "Migrate another wallet"', async () => {
      let migrateAnotherVisible = false;
      try {
        await waitFor(element(by.id('migrate-another-wallet')))
          .toBeVisible()
          .withTimeout(2000);
        migrateAnotherVisible = true;
      } catch {}

      if (migrateAnotherVisible) {
        throw new Error('"Migrate another wallet" should not appear for new user');
      }
    });

    it('should complete and reach main app', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 3000));
    });
  });

  describe('Persistence', () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    it('should not show migration flow on relaunch', async () => {
      let migrationShown = false;
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000);
        migrationShown = true;
      } catch {}

      if (migrationShown) {
        throw new Error('Migration flow should not appear after vault creation');
      }
    });
  });
});
