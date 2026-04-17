/**
 * Partial Fast Vault Migration UI — Skip/Retry (offline, no stubs needed)
 *
 * Corrupt private keys fail during decrypt locally, so this suite
 * doesn't need network or the stub flag.
 */
const { devReset } = require('./helpers/dev-reset')

describe('Partial Fast Vault Migration — Skip/Retry', () => {
  beforeAll(async () => {
    await devReset()

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-corrupt')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('dev-seed-corrupt')).tap()
    await waitFor(element(by.id('seed-corrupt-done')))
      .toExist()
      .withTimeout(20000)

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('reaches wallet list with corrupt wallet migrate button', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('enter-vultiverse-cta')).tap()
    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(30000)
    await element(by.text('Start Migration')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
    await waitFor(element(by.id('wallet-card-0-migrate')))
      .toBeVisible()
      .withTimeout(5000)
  })

  it('fails keygen immediately on corrupt key', async () => {
    await element(by.id('wallet-card-0-migrate')).tap()
    await waitFor(element(by.text('Enter your email')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('vault-email-input')).typeText('test@example.com')
    await element(by.id('vault-email-next')).tap()
    await waitFor(element(by.text('Choose a password')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('vault-password-input')).typeText('testpass123')
    await element(by.id('vault-password-confirm')).typeText('testpass123')
    await element(by.id('vault-password-continue')).tap()

    await waitFor(element(by.id('keygen-skip')))
      .toBeVisible()
      .withTimeout(30000)
    await waitFor(element(by.id('keygen-retry')))
      .toBeVisible()
      .withTimeout(5000)
  })

  it('retry still fails', async () => {
    await element(by.id('keygen-retry')).tap()
    await waitFor(element(by.id('keygen-skip')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('skip advances to MigrationSuccess', async () => {
    await element(by.id('keygen-skip')).tap()
    await waitFor(element(by.id('success-back')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('can dismiss migration', async () => {
    await element(by.id('success-back')).tap()
  })
})
