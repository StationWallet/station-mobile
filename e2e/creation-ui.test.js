/**
 * Fast Vault Creation UI Test — New User (stubbed backend)
 */
const { devReset } = require('./helpers/dev-reset')

const VAULT_PASSWORD = 'testpass123'

describe('Fast Vault Creation UI — New User', () => {
  beforeAll(async () => {
    await devReset()
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxURLBlacklistRegex: '.*' },
    })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    try { await device.enableSynchronization() } catch {}
  })

  describe('Navigation to the creation flow', () => {
    it('reaches MigrationHome via dev button', async () => {
      await waitFor(element(by.id('dev-create-fast-vault')))
        .toBeVisible()
        .withTimeout(60000)
      await element(by.id('dev-create-fast-vault')).tap()

      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(30000)
      await element(by.id('enter-vultiverse-cta')).tap()

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000)
    })

    it('advances through VaultSetup to VaultName', async () => {
      await element(by.id('migration-cta')).tap()
      await waitFor(element(by.id('vault-setup-get-started')))
        .toBeVisible()
        .withTimeout(15000)
      await element(by.id('vault-setup-get-started')).tap()
      await waitFor(element(by.text('Name your vault')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })

  describe('Form validation', () => {
    it('advances from VaultName to VaultEmail with a valid name', async () => {
      await element(by.id('vault-name-input')).typeText('My Fast Vault')
      await element(by.id('vault-name-next')).tap()
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('shows an error for invalid email after blur', async () => {
      await element(by.id('vault-email-input')).tap()
      await element(by.id('vault-email-input')).typeText('not-an-email')
      await element(by.id('vault-email-input')).tapReturnKey()
      await waitFor(element(by.text('Please enter a valid email address.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('advances to VaultPassword with a valid email', async () => {
      await element(by.id('vault-email-input')).tap()
      await element(by.id('vault-email-input')).clearText()
      await element(by.id('vault-email-input')).typeText('test@example.com')
      await element(by.id('vault-email-next')).tap()
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('shows error for short password on blur', async () => {
      await element(by.id('vault-password-input')).typeText('ab')
      await element(by.id('vault-password-confirm')).tap()
      await waitFor(element(by.text('Password must be at least 6 characters.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('shows error for mismatched passwords', async () => {
      await element(by.id('vault-password-input')).tap()
      await element(by.id('vault-password-input')).clearText()
      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD)
      await element(by.id('vault-password-confirm')).tap()
      await element(by.id('vault-password-confirm')).clearText()
      await element(by.id('vault-password-confirm')).typeText('different123')
      await element(by.id('vault-password-confirm')).tapReturnKey()
      await waitFor(element(by.text('Passwords do not match.')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('advances with matching passwords (stubbed keygen)', async () => {
      await element(by.id('vault-password-confirm')).tap()
      await element(by.id('vault-password-confirm')).clearText()
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD)
      await element(by.id('vault-password-continue')).tap()

      await waitFor(element(by.text('Verify your email')))
        .toBeVisible()
        .withTimeout(15000)
    })
  })

  describe('Keygen and verify (stubbed)', () => {
    it('accepts any OTP with stubbed server', async () => {
      await element(by.id('verify-code-input')).tap()
      await element(by.id('verify-code-input')).replaceText('0000')

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(30000)
    })

    it('passes vault integrity verification', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000)
      await expect(element(by.id('verify-all-passed'))).toHaveText(
        'all-passed: true',
      )
    })

    it('reaches main app', async () => {
      await element(by.id('success-back')).tap()
    })
  })

  describe('Persistence', () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      })
      await device.disableSynchronization()
    })

    it('does not show migration flow on relaunch', async () => {
      let migrationShown = false
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000)
        migrationShown = true
      } catch {}
      if (migrationShown) {
        throw new Error('Migration flow should not appear after vault creation')
      }
    })

    it('shows created vault in wallet list', async () => {
      await waitFor(element(by.text('My Fast Vault')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
