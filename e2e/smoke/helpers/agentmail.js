// e2e/smoke/helpers/agentmail.js
const fs = require('fs')
const path = require('path')

function readDotEnv() {
  const root = path.resolve(__dirname, '..', '..', '..')
  for (const name of ['.env.test', '.env']) {
    try {
      const content = fs.readFileSync(path.join(root, name), 'utf8')
      const vars = {}
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) vars[m[1].trim()] = m[2].trim()
      }
      return vars
    } catch {}
  }
  return {}
}

const ENV = readDotEnv()
const AGENTMAIL_API_KEY = ENV.AGENTMAIL_API_KEY
const AGENTMAIL_EMAIL = ENV.AGENTMAIL_EMAIL || 'vultiagent@agentmail.to'
const VAULT_PASSWORD = 'testpass123'

async function getExistingMessageIds(inboxEmail) {
  try {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
      { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
    )
    if (!res.ok) return new Set()
    const data = await res.json()
    return new Set((data.messages || []).map((m) => m.message_id))
  } catch {
    return new Set()
  }
}

async function fetchOtpFromAgentmail(inboxEmail, knownMessageIds, maxAttempts = 30, intervalMs = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const listRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
      )
      if (!listRes.ok) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const listData = await listRes.json()
      const msg = (listData.messages || [])
        .filter((m) => !knownMessageIds.has(m.message_id))
        .find(
          (m) =>
            (m.preview && m.preview.includes('Verification')) ||
            (m.subject && m.subject.includes('Verification')),
        )
      if (!msg) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const msgRes = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxEmail)}/messages/${msg.message_id}`,
        { headers: { Authorization: `Bearer ${AGENTMAIL_API_KEY}` } },
      )
      if (!msgRes.ok) continue
      const msgData = await msgRes.json()
      const text = msgData.text || msgData.extracted_text || msgData.html || ''
      const match = text.match(/Verification Code:\s*(\d{4,6})|\b(\d{4})\b/)
      if (match) {
        const code = match[1] || match[2]
        knownMessageIds.add(msg.message_id)
        return code
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Failed to fetch OTP after ${maxAttempts} attempts`)
}

async function migrateOneWalletFromCard(walletIndex, walletLabel, knownMessageIds, hasMoreWallets) {
  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap()

  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL)
  await element(by.id('vault-email-next')).tap()

  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000)

  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
  for (const id of preKeygenIds) knownMessageIds.add(id)

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD)
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD)
  await element(by.id('vault-password-continue')).tap()

  await waitFor(element(by.text('Verify your email')))
    .toExist()
    .withTimeout(180000)

  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds)
  await element(by.id('verify-code-input')).tap()
  await element(by.id('verify-code-input')).replaceText(otp)

  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(60000)

  if (hasMoreWallets) {
    await element(by.id('migrate-another-wallet')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
  }
}

module.exports = {
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
  migrateOneWalletFromCard,
}
