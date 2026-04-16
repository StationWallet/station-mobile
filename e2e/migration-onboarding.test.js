/**
 * Migration Onboarding E2E Tests
 *
 * Tests the REAL upgrade path: seed legacy keystore data (simulating old
 * Station app), kill app, relaunch (migrateLegacyKeystore runs on startup),
 * walk through migration UI, verify vault protobuf data integrity, then
 * confirm persistence across relaunches.
 *
 * Each standard wallet goes through the full per-wallet flow:
 *   Email → Password → KeygenProgress → VerifyEmail (OTP via AgentMail) → MigrationSuccess
 * Ledger wallets are auto-handled (no migrate button).
 *
 * This is critical — if migration produces incorrect vaults, users lose funds.
 */
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail')
const { eraseSimulator } = require('./helpers/simulator')

describe('Migration Onboarding Flow', () => {
  let knownMessageIds = new Set()

  describe('1. Clean install — no legacy wallets', () => {
    beforeAll(async () => {
      eraseSimulator(device.id)

      await device.launchApp({ delete: true, newInstance: true })
      await device.disableSynchronization()
    })

    afterAll(async () => {
      await device.enableSynchronization()
    })

    it('shows auth screen in dev mode (prod routes to Migration)', async () => {
      await waitFor(element(by.text('Create New Wallet')))
        .toBeVisible()
        .withTimeout(90000)
    })
  })

  describe('2. Real upgrade path — seed, relaunch, migrate, verify', () => {
    beforeAll(async () => {
      // PHASE 1: Seed legacy keystore data (simulates old Station app)
      await device.launchApp({ delete: true, newInstance: true })
      await device.disableSynchronization()

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(90000)
      await element(by.text('Seed Legacy Data (dev)')).tap()

      await waitFor(element(by.id('seed-done')))
        .toExist()
        .withTimeout(30000)
      await expect(element(by.id('seed-status'))).toHaveText('seeded')

      // PHASE 2: Kill and relaunch — real upgrade moment
      // clearKeystoreWhenFirstRun() → migrateLegacyKeystore() → legacyDataFound=true
      await device.launchApp({ newInstance: true })
      await device.disableSynchronization()

      // Snapshot existing AgentMail messages so we only look at new OTPs
      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
    })

    afterAll(async () => {
      await device.enableSynchronization()
    })

    // --- Migration UI flow ---

    it('shows MigrationHome with Start Migration CTA', async () => {
      // Tap through RiveIntro
      await waitFor(element(by.id('enter-vultiverse-cta')))
        .toBeVisible()
        .withTimeout(90000)
      await element(by.id('enter-vultiverse-cta')).tap()

      // Wait for "Start Migration" text (not just the button testID)
      // to ensure discoverLegacyWallets() has resolved
      await waitFor(element(by.text('Start Migration')))
        .toBeVisible()
        .withTimeout(90000)
    })

    it('taps CTA to reach wallet list', async () => {
      // Use text matcher — the custom Button's Animated wrapper can swallow testID taps
      await new Promise((r) => setTimeout(r, 3000))
      await element(by.text('Start Migration')).tap()
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(30000)
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(30000)
    })

    it('migrates wallet 1', async () => {
      await migrateOneWalletFromCard(
        0,
        'TestWallet1',
        knownMessageIds,
        true
      )
    })

    it('migrates wallet 2', async () => {
      await migrateOneWalletFromCard(
        1,
        'TestWallet2',
        knownMessageIds,
        false
      )
    })

    // After wallet 2 completes, MigrationSuccess is visible with
    // DevVerifyVault showing imported-* checks for the last migrated wallet.

    it('shows success screen with OG message', async () => {
      await expect(
        element(by.text('You are aboard, Station OG!'))
      ).toBeVisible()
    })

    // --- Vault data integrity verification ---
    // Per-wallet migration shows imported-* verification for the last migrated wallet.

    it('migrated vault: exists with correct structure', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000)
      await expect(
        element(by.id('verify-imported-exists'))
      ).toHaveText('imported-exists: true')
      await expect(element(by.id('verify-imported-name'))).toHaveText(
        'imported-name: true'
      )
    })

    it('migrated vault: has valid key material', async () => {
      await expect(
        element(by.id('verify-imported-has-pubkey'))
      ).toHaveText('imported-has-pubkey: true')
      await expect(
        element(by.id('verify-imported-has-keyshare'))
      ).toHaveText('imported-has-keyshare: true')
    })

    it('migrated vault: correct lib type and signers', async () => {
      await expect(
        element(by.id('verify-imported-libtype'))
      ).toHaveText('imported-libtype: true')
      await expect(
        element(by.id('verify-imported-has-signers'))
      ).toHaveText('imported-has-signers: true')
    })

    it('all vault integrity checks pass', async () => {
      await expect(element(by.id('verify-all-passed'))).toHaveText(
        'all-passed: true'
      )
    })

    // --- Complete migration ---

    it('taps Continue to complete migration', async () => {
      await element(by.id('success-back')).tap()
      await new Promise((r) => setTimeout(r, 1000))
    })
  })

  describe('3. Persistence — migration not shown again', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true })
      await device.disableSynchronization()
      await new Promise((r) => setTimeout(r, 3000))
    })

    afterAll(async () => {
      await device.enableSynchronization()
    })

    it('vaultsUpgraded persists — migration flow is skipped', async () => {
      await expect(element(by.id('migration-cta'))).not.toExist()
    })
  })
})
