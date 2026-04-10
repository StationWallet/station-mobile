/**
 * Fast Vault Creation E2E Test — New User
 *
 * Clean install (no legacy wallets) -> AuthMenu (dev mode) ->
 * "Create Fast Vault (dev)" -> RiveIntro -> MigrationHome ->
 * "Create a Fast Vault" -> VaultName -> VaultEmail -> VaultPassword ->
 * KeygenProgress -> VerifyEmail -> MigrationSuccess.
 *
 * Also tests input validation on each form screen:
 * - VaultEmail: invalid email shows error after blur
 * - VaultPassword: short password and mismatched passwords show errors
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
      try { await device.enableSynchronization(); } catch {}
    });

    it('should reach MigrationHome via dev button', async () => {
      await waitFor(element(by.id('dev-create-fast-vault')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('dev-create-fast-vault')).tap();

      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(90000);
      await element(by.id('enter-vultiverse-cta')).tap();

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(90000);

      await new Promise(r => setTimeout(r, 2000));
    });

    it('should navigate to VaultName', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.text('Name your vault')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  // ─── VaultName → VaultEmail ─────────────────────────────────────
  describe('VaultName and VaultEmail', () => {
    it('should advance to VaultEmail after entering a name', async () => {
      await element(by.id('vault-name-input')).typeText('My Fast Vault');
      await element(by.id('vault-name-next')).tap();

      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show error for invalid email after blur', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).typeText('not-an-email');
      // tapReturnKey blurs single-line input (blurOnSubmit=true default)
      await element(by.id('vault-email-input')).tapReturnKey();

      await waitFor(element(by.text('Please enter a valid email address.')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should advance to VaultPassword with valid email', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).clearText();
      await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
      await element(by.id('vault-email-next')).tap();

      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  // ─── VaultPassword validation ───────────────────────────────────
  describe('VaultPassword validation', () => {
    it('should show error for short password on blur', async () => {
      await element(by.id('vault-password-input')).typeText('ab');
      // Tap confirm field to blur password and trigger validation
      await element(by.id('vault-password-confirm')).tap();

      await waitFor(element(by.text('Password must be at least 6 characters.')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show error for mismatched passwords', async () => {
      // Start fresh: clear and re-enter valid password
      await element(by.id('vault-password-input')).tap();
      await element(by.id('vault-password-input')).clearText();
      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);

      // Enter mismatching confirmation
      await element(by.id('vault-password-confirm')).tap();
      await element(by.id('vault-password-confirm')).clearText();
      await element(by.id('vault-password-confirm')).typeText('different123');
      // tapReturnKey to blur confirm field
      await element(by.id('vault-password-confirm')).tapReturnKey();

      await waitFor(element(by.text('Passwords do not match.')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should advance with valid matching passwords', async () => {
      // Fix the confirmation password — keep keyboard UP so the
      // KeyboardAvoidingView pushes the button into the tappable area.
      await element(by.id('vault-password-confirm')).tap();
      await element(by.id('vault-password-confirm')).clearText();
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);

      // Snapshot agentmail before keygen sends the verification email
      const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      for (const id of preKeygenIds) knownMessageIds.add(id);

      // Tap while keyboard is still up (button is pushed above keyboard)
      await element(by.id('vault-password-continue')).tap();

      // Wait for KeygenProgress or VerifyEmail (keygen can complete very fast)
      const startTime = Date.now();
      while (Date.now() - startTime < 15000) {
        try { await expect(element(by.text('Fast Vault Setup'))).toExist(); return; } catch {}
        try { await expect(element(by.text('Verify your email'))).toExist(); return; } catch {}
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error('Did not leave password screen within 15 seconds');
    }, 240000);
  });

  // ─── Keygen + OTP verification ──────────────────────────────────
  describe('Keygen and verification', () => {
    it('should complete keygen and reach VerifyEmail', async () => {
      const startTime = Date.now();
      const timeoutMs = 180000;
      while (Date.now() - startTime < timeoutMs) {
        try {
          await expect(element(by.text('Verify your email'))).toExist();
          return;
        } catch {}

        try {
          await expect(element(by.text('Failed'))).toExist();
          try {
            const attrs = await element(by.id('keygen-error-text')).getAttributes();
            console.log('[Keygen] Error:', attrs.text || attrs.label);
          } catch { console.log('[Keygen] Error detected'); }
          await element(by.id('keygen-retry')).tap();
        } catch {}

        await new Promise(r => setTimeout(r, 10000));
      }
      throw new Error('Keygen did not complete within 3 minutes');
    }, 240000);

    it('should verify email with OTP', async () => {
      const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
      await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
      await element(by.id('verify-code-input')).tap();
      await element(by.id('verify-code-input')).replaceText(otp);

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(60000);
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
      await waitFor(element(by.id('continue-button')))
        .toExist()
        .withTimeout(5000);
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 3000));
    });
  });

  // ─── Persistence ────────────────────────────────────────────────
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
