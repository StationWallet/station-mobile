/**
 * Fast Vault Migration UI Test — Legacy Wallet Holder (stubbed backend)
 */
const { devReset } = require('./helpers/dev-reset')
const { migrateOneWalletFromCardStubbed } = require('./helpers/agentmail')

describe('Fast Vault Migration UI — Per-Wallet', () => {
  beforeAll(async () => {
    await devReset()

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.id('dev-seed-legacy')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('dev-seed-legacy')).tap()
    await waitFor(element(by.id('seed-done')))
      .toExist()
      .withTimeout(20000)

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  it('plays RiveIntro and reaches MigrationHome', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(60000)
    await element(by.id('enter-vultiverse-cta')).tap()

    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('navigates to wallet list', async () => {
    await element(by.text('Start Migration')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(15000)
  })

  it('shows both standard and ledger wallets', async () => {
    await waitFor(element(by.id('wallet-card-0')))
      .toBeVisible()
      .withTimeout(10000)
    await waitFor(element(by.text('TestLedgerWallet')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('migrates wallet 1', async () => {
    await migrateOneWalletFromCardStubbed(0, 'TestWallet1', true)
  })

  it('migrates wallet 2', async () => {
    await migrateOneWalletFromCardStubbed(1, 'TestWallet2', false)
  })

  it('passes vault integrity verification', async () => {
    await waitFor(element(by.id('verify-all-passed')))
      .toExist()
      .withTimeout(15000)
    await expect(element(by.id('verify-imported-exists')))
      .toHaveText('imported-exists: true')
    await expect(element(by.id('verify-imported-has-pubkey')))
      .toHaveText('imported-has-pubkey: true')
    await expect(element(by.id('verify-imported-has-keyshare')))
      .toHaveText('imported-has-keyshare: true')
    await expect(element(by.id('verify-all-passed')))
      .toHaveText('all-passed: true')
  })

  it('dismisses migration and persists across relaunch', async () => {
    await element(by.id('success-back')).tap()

    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(60000)
    await waitFor(element(by.text('TestWallet1')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('shows Export as Vault Share for migrated wallet', async () => {
    await element(by.id('wallet-card-0-export')).tap()
    await waitFor(element(by.text('Export as Vault Share')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('hides raw private-key reveal for DKLS vault', async () => {
    let revealVisible = false
    try {
      await waitFor(element(by.text('Reveal Private Key')))
        .toBeVisible()
        .withTimeout(2000)
      revealVisible = true
    } catch {}
    if (revealVisible) {
      throw new Error('Raw key reveal should be hidden for DKLS vaults')
    }
  })
})
