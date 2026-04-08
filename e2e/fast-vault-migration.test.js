/**
 * Fast Vault Migration E2E Tests
 *
 * Full end-to-end: seed legacy data → walk through both standard wallets
 * (email → password → keygen → verify) → MigrationSuccess → persistence.
 *
 * Test data: 2 standard wallets (TestWallet1, TestWallet2) + 1 Ledger wallet.
 * Ledger wallet is auto-skipped (no private key to import).
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
const VAULT_PASSWORD = 'testpass123';

async function getExistingMessageIds(inboxEmail) {
  try {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
      { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } }
    );
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set((data.messages || []).map(m => m.message_id));
  } catch { return new Set(); }
}

async function fetchOtpFromAgentmail(inboxEmail, knownMessageIds, maxAttempts = 30, intervalMs = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const listRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } }
      );
      if (!listRes.ok) {
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      const listData = await listRes.json();
      const messages = (listData.messages || []);
      const newMessages = messages.filter(m => !knownMessageIds.has(m.message_id));

      const msg = newMessages.find(m =>
        (m.preview && m.preview.includes('Verification')) ||
        (m.subject && m.subject.includes('Verification'))
      );

      if (!msg) {
        console.log(`[AgentMail] Waiting for new OTP (attempt ${attempt + 1}/${maxAttempts}, ${newMessages.length} new of ${messages.length} total)`);
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
        // Add to known so we don't pick it up again for wallet 2
        knownMessageIds.add(msg.message_id);
        return code;
      }
    } catch (err) {
      console.log(`[AgentMail] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Failed to fetch OTP after ${maxAttempts} attempts`);
}

/**
 * Walk one wallet through: email → password → keygen → verify email.
 * Assumes the VaultEmail screen is already visible.
 */
async function migrateOneWallet(walletLabel, knownMessageIds) {
  console.log(`\n--- Migrating ${walletLabel} ---`);

  // Email screen
  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('vault-email-input')).tap();
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
  await element(by.id('vault-email-next')).tap();

  // Password screen
  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000);

  // Snapshot agentmail BEFORE keygen starts
  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
  // Merge with known so we skip all prior messages
  for (const id of preKeygenIds) knownMessageIds.add(id);
  console.log(`[AgentMail] ${knownMessageIds.size} known messages before keygen`);

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-continue')).tap();

  // Keygen screen
  await waitFor(element(by.text('Fast Vault Setup')))
    .toBeVisible()
    .withTimeout(10000);

  // Wait for DKLS ceremony → VerifyEmail (up to 150s)
  await waitFor(element(by.text('Verify your email')))
    .toExist()
    .withTimeout(150000);

  // Fetch OTP and enter it
  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
  await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
  await element(by.id('verify-code-input')).tap();
  await element(by.id('verify-code-input')).replaceText(otp);

  // Wait for navigation after auto-submit
  await new Promise(r => setTimeout(r, 5000));
  console.log(`--- ${walletLabel} complete ---\n`);
}

describe('Fast Vault Migration', () => {
  let knownMessageIds = new Set();

  describe('Full migration — 2 wallets + ledger', () => {
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

    it('should discover wallets', async () => {
      await waitFor(element(by.text('Wallets Found')))
        .toBeVisible()
        .withTimeout(30000);
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should start migration', async () => {
      await element(by.id('upgrade-button')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should migrate wallet 1', async () => {
      await migrateOneWallet('TestWallet1', knownMessageIds);
    });

    it('should migrate wallet 2', async () => {
      // After wallet 1, should be on VaultEmail for wallet 2
      await migrateOneWallet('TestWallet2', knownMessageIds);
    });

    it('should show migration success', async () => {
      // After both wallets + ledger auto-skip, should reach success screen
      await waitFor(element(by.text('Wallets Upgraded!')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should dismiss migration and show main app', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 2000));
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

    it('should not show WalletDiscovery on relaunch', async () => {
      // vaultsUpgraded flag should persist — no migration flow
      let migrationShown = false;
      try {
        await waitFor(element(by.text('Wallets Found')))
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
