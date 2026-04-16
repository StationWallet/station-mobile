const fs = require('fs');
const path = require('path');

function readDotEnv() {
  const root = path.resolve(__dirname, '..', '..');
  // Prefer .env.test (has AGENTMAIL creds + test-specific vars), fall back to .env
  for (const name of ['.env.test', '.env']) {
    try {
      const content = fs.readFileSync(path.join(root, name), 'utf8');
      const vars = {};
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
      }
      return vars;
    } catch { /* try next */ }
  }
  return {};
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
        console.log(`[AgentMail] Waiting for OTP (attempt ${attempt + 1}/${maxAttempts})`);
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

  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('vault-email-input')).tap();
  await element(by.id('vault-email-input')).clearText();
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
  await element(by.id('vault-email-next')).tap();

  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000);

  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
  for (const id of preKeygenIds) knownMessageIds.add(id);

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-continue')).tap();

  // Wait for VerifyEmail screen — match on the input testID (text changed in UI redesign)
  await waitFor(element(by.id('verify-code-input')))
    .toExist()
    .withTimeout(150000);

  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
  // The hidden TextInput (1x1, near-zero opacity) isn't tappable, so skip .tap()
  await element(by.id('verify-code-input')).replaceText(otp);

  await new Promise(r => setTimeout(r, 5000));
  console.log(`--- ${walletLabel} complete ---\n`);
}

/**
 * Walk one wallet through the per-wallet migration flow.
 * Assumes the wallet list screen is visible with the wallet card.
 *
 * @param {number} walletIndex - 0-based index of the wallet card
 * @param {string} walletLabel - For logging
 * @param {Set} knownMessageIds - AgentMail message tracking
 * @param {boolean} hasMoreWallets - Whether to tap "Migrate another wallet" after
 */
async function migrateOneWalletFromCard(walletIndex, walletLabel, knownMessageIds, hasMoreWallets) {
  console.log(`\n--- Migrating ${walletLabel} from card ${walletIndex} ---`);

  // Tap the "Migrate to a vault" button on the wallet card
  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap();

  // Email screen
  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('vault-email-input')).tap();
  await element(by.id('vault-email-input')).clearText();
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
  await element(by.id('vault-email-next')).tap();

  // Password screen
  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000);

  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
  for (const id of preKeygenIds) knownMessageIds.add(id);

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-continue')).tap();

  // KeygenProgress → VerifyEmail — match on the input testID (text changed in UI redesign)
  await waitFor(element(by.id('verify-code-input')))
    .toExist()
    .withTimeout(150000);

  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
  // The hidden TextInput (1x1, near-zero opacity) isn't tappable, so skip .tap()
  await element(by.id('verify-code-input')).replaceText(otp);

  // Wait for verification + navigation to MigrationSuccess
  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(15000);

  if (hasMoreWallets) {
    // Tap "Migrate another wallet" → back to wallet list
    await element(by.id('migrate-another-wallet')).tap();
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000);
  }

  console.log(`--- ${walletLabel} complete ---\n`);
}

module.exports = {
  AGENTMAIL_API_KEY,
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
  migrateOneWallet,
  migrateOneWalletFromCard,
};
