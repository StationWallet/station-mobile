/**
 * Fast Vault Creation E2E Test — New User
 *
 * Clean install (no legacy wallets) → RiveIntro → MigrationHome →
 * "Create a Fast Vault" → VaultName → VaultEmail → VaultPassword →
 * KeygenProgress → VerifyEmail → MigrationSuccess.
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

    it('should reach MigrationHome with "Create a Fast Vault"', async () => {
      // RiveIntro auto-plays → MigrationHome appears
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

      // Fresh keygen → VerifyEmail
      await waitFor(element(by.text('Verify your email')))
        .toExist()
        .withTimeout(150000);
    });

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
