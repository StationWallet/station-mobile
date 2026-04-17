/**
 * Nightly smoke: one full migration with real vultiserver + AgentMail.
 * Not gated on PRs. Runs via `.github/workflows/e2e-smoke.yml`.
 */
const { execSync } = require('child_process')
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail')

describe('Smoke — real-backend migration', () => {
  let knownMessageIds = new Set()

  beforeAll(async () => {
    execSync(
      `xcrun simctl shutdown ${device.id} 2>/dev/null; xcrun simctl erase ${device.id}`,
      { timeout: 180000 },
    )
    execSync(`xcrun simctl boot ${device.id}`, { timeout: 120000 })

    await device.launchApp({ delete: true, newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-legacy')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.id('dev-seed-legacy')).tap()
    await waitFor(element(by.id('seed-done')))
      .toExist()
      .withTimeout(30000)

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('walks RiveIntro → MigrationHome → wallet list', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.id('enter-vultiverse-cta')).tap()

    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.text('Start Migration')).tap()

    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('migrates TestWallet1 via real vultiserver + AgentMail', async () => {
    await migrateOneWalletFromCard(0, 'TestWallet1', knownMessageIds, false)
  }, 240000)

  it('passes vault integrity verification', async () => {
    await waitFor(element(by.id('verify-all-passed')))
      .toExist()
      .withTimeout(15000)
    await expect(element(by.id('verify-all-passed')))
      .toHaveText('all-passed: true')
  })

  it('reaches wallet list on relaunch and shows migrated vault', async () => {
    await element(by.id('success-back')).tap()
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
    await waitFor(element(by.text('TestWallet1')))
      .toBeVisible()
      .withTimeout(60000)
  })
})
