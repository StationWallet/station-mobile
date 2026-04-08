/**
 * Fast Vault Migration E2E Tests
 *
 * Full end-to-end: seed legacy data → WalletDiscovery → VaultEmail →
 * VaultPassword → KeygenProgress (DKLS ceremony with vultiserver) →
 * VerifyEmail (OTP from agentmail) → MigrationSuccess → persistence.
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readDotEnv() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) vars[match[1].trim()] = match[2].trim();
    }
    return vars;
  } catch { return {}; }
}

const ENV = readDotEnv();
const AGENTMAIL_API_KEY = ENV.AGENTMAIL_API_KEY;
const AGENTMAIL_EMAIL = ENV.AGENTMAIL_EMAIL || 'vultiagent@agentmail.to';

/**
 * Poll agentmail API for the 4-digit OTP code.
 * Matches vultiagent-app's fetchOtpFromApi pattern.
 */
async function fetchOtpFromAgentmail(inboxEmail, vaultName, maxAttempts = 30, intervalMs = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const listRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } }
      );
      if (!listRes.ok) {
        console.log(`[AgentMail] List failed: ${listRes.status}`);
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      const listData = await listRes.json();
      const messages = listData.messages || [];

      // Look for most recent verification email
      const msg = messages.find(m =>
        (m.preview && m.preview.includes('Verification')) ||
        (m.subject && m.subject.includes('Verification')) ||
        (m.preview && m.preview.includes(vaultName)) ||
        (m.subject && m.subject.includes(vaultName))
      );

      if (!msg) {
        console.log(`[AgentMail] No matching message yet (attempt ${attempt + 1}/${maxAttempts}, ${messages.length} msgs)`);
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }

      const msgRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages/${msg.message_id}`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } }
      );
      if (!msgRes.ok) {
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      const msgData = await msgRes.json();
      const text = msgData.text || msgData.extracted_text || msgData.html || '';
      const match = text.match(/Verification Code:\s*(\d{4,6})|\b(\d{4})\b/);
      if (match) {
        const code = match[1] || match[2];
        console.log(`[AgentMail] Found OTP: ${code}`);
        return code;
      }
      console.log(`[AgentMail] Message found but no code extracted`);
    } catch (err) {
      console.log(`[AgentMail] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Failed to fetch OTP from agentmail after ${maxAttempts} attempts`);
}

describe('Fast Vault Migration', () => {

  describe('1. Full migration flow', () => {
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
      await expect(element(by.id('seed-status'))).toHaveText('seeded');

      // Relaunch to trigger migration flow
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    // --- WalletDiscovery ---

    it('should discover wallets and show upgrade button', async () => {
      await waitFor(element(by.text('Wallets Found')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.id('upgrade-button'))).toExist();
    });

    // --- VaultEmail ---

    it('should navigate to email screen on upgrade', async () => {
      await element(by.id('upgrade-button')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.text('Step 1 of 2'))).toBeVisible();
    });

    it('should validate email and navigate to password screen', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    // --- VaultPassword ---

    it('should accept matching passwords and proceed to keygen', async () => {
      await element(by.id('vault-password-input')).typeText('testpass123');
      await element(by.id('vault-password-confirm')).typeText('testpass123');
      await element(by.id('vault-password-continue')).tap();
      await waitFor(element(by.text('Fast Vault Setup')))
        .toBeVisible()
        .withTimeout(10000);
    });

    // --- KeygenProgress → VerifyEmail ---

    it('should complete DKLS ceremony and show verification screen', async () => {
      // DKLS ceremony with vultiserver — wait up to 150s (matches vultiagent-app)
      await waitFor(element(by.text('Verify your email')))
        .toExist()
        .withTimeout(150000);
      await expect(element(by.id('verify-code-input'))).toExist();
    });

    // --- VerifyEmail with agentmail OTP ---

    it('should verify email with OTP from agentmail', async () => {
      const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, 'TestWallet');
      await element(by.id('verify-code-input')).tap();
      await element(by.id('verify-code-input')).replaceText(otp);
      // Auto-submits — wait for navigation
      await new Promise(r => setTimeout(r, 5000));
    });

    // --- Next wallet or MigrationSuccess ---

    it('should advance after verification', async () => {
      // With 3 test wallets (2 standard + 1 ledger), after first wallet
      // we should see VaultEmail for the second wallet, or MigrationSuccess
      let found = false;
      try {
        await waitFor(element(by.text('Enter your email')))
          .toBeVisible()
          .withTimeout(5000);
        found = true;
        console.log('Advanced to next wallet VaultEmail');
      } catch (_) {}

      if (!found) {
        try {
          await waitFor(element(by.text('Wallets Upgraded!')))
            .toBeVisible()
            .withTimeout(5000);
          found = true;
          console.log('All wallets done — success screen');
        } catch (_) {}
      }

      if (!found) {
        await waitFor(element(by.text('Migration Complete')))
          .toBeVisible()
          .withTimeout(5000);
        console.log('Partial success — migration complete');
      }
    });
  });
});
