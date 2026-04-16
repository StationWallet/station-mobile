/**
 * Partial Fast Vault Migration E2E Test — Skip/Retry Flow
 *
 * Tests the error handling UI when a wallet's DKLS keygen ceremony fails.
 * Uses DevSeedCorruptData to seed a wallet with a corrupted encrypted key
 * that causes deterministic decrypt failure — no network dependency needed.
 *
 * Flow:
 *   1. Seed corrupt wallet data (1 corrupt standard wallet + 1 ledger)
 *   2. Relaunch → RiveIntro → MigrationHome (migration-cta visible)
 *   3. Tap migration-cta → wallet list
 *   4. Tap wallet-card-0-migrate on the corrupt wallet
 *   5. Email → Password → KeygenProgress fails immediately (corrupt key)
 *   6. Error UI appears with Skip and Retry buttons
 *   7. Tap Retry → fails again → error UI reappears
 *   8. Tap Skip → navigates to MigrationSuccess (skipped wallet = failure)
 *   9. MigrationSuccess shows result
 *
 * Does NOT require vultiserver or network access.
 */
const { eraseSimulator } = require('./helpers/simulator')

describe('Partial Fast Vault Migration — Skip/Retry', () => {
  describe('Setup — seed corrupt wallet data', () => {
    beforeAll(async () => {
      // Full erase needed — iOS keychain items survive app deletion
      eraseSimulator(device.id)

      await device.launchApp({ delete: true, newInstance: true })
      await device.disableSynchronization()

      // Wait for Auth screen — after erase the post-boot app launch can be slow
      // (InteractionManager handles + native module init), allow up to 3 minutes
      await waitFor(element(by.text('Create New Wallet')))
        .toBeVisible()
        .withTimeout(180000)

      await element(by.id('dev-seed-corrupt')).tap()

      await waitFor(element(by.id('seed-corrupt-done')))
        .toExist()
        .withTimeout(30000)

      // Relaunch to trigger migration flow
      await device.launchApp({ newInstance: true })
      await device.disableSynchronization()

      // Navigate through RiveIntro → MigrationHome → WalletsFound.
      // After a simulator erase the first relaunch can take >90s to stabilize,
      // so we use the full testTimeout (300s) here in beforeAll.
      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(180000)
      await element(by.id('enter-vultiverse-cta')).tap()

      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(90000)
      await element(by.id('migration-cta')).tap()

      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(30000)
    })

    afterAll(async () => {
      await device.enableSynchronization()
    })

    it('shows corrupt wallet card with migrate button', async () => {
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000)
      await waitFor(element(by.id('wallet-card-0-migrate')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('taps migrate on corrupt wallet', async () => {
      await element(by.id('wallet-card-0-migrate')).tap()
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('fills email and advances to password', async () => {
      await element(by.id('vault-email-input')).typeText(
        'test@example.com'
      )
      await element(by.id('vault-email-next')).tap()
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('fills password and advances to KeygenProgress', async () => {
      await element(by.id('vault-password-input')).typeText(
        'testpass123'
      )
      await element(by.id('vault-password-confirm')).typeText(
        'testpass123'
      )
      await element(by.id('vault-password-continue')).tap()

      // Should reach KeygenProgress and fail quickly (corrupt key → error UI)
      await waitFor(element(by.id('keygen-error-text')))
        .toExist()
        .withTimeout(30000)
    })
  })

  describe('Skip/Retry flow', () => {
    it('shows Skip and Retry buttons after keygen failure', async () => {
      // Corrupt key causes immediate decrypt failure → error UI
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(30000)
      await waitFor(element(by.id('keygen-retry')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('taps Retry — still fails — error UI reappears', async () => {
      await element(by.id('keygen-retry')).tap()

      // The corrupt key will fail again immediately
      await waitFor(element(by.id('keygen-skip')))
        .toBeVisible()
        .withTimeout(30000)
      await waitFor(element(by.id('keygen-retry')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('taps Skip — advances to MigrationSuccess', async () => {
      await element(by.id('keygen-skip')).tap()

      // After skipping the only standard wallet (ledger is auto-handled),
      // should navigate directly to MigrationSuccess
      await waitFor(element(by.id('success-back')))
        .toBeVisible()
        .withTimeout(15000)
    })
  })

  describe('MigrationSuccess shows result', () => {
    it('shows migration result screen', async () => {
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000)
    })

    it('can dismiss migration and continue to app', async () => {
      await element(by.id('success-back')).tap()
      await waitFor(element(by.text('Create New Wallet')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
