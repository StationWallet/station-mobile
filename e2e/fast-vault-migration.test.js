/**
 * Fast Vault Migration E2E Tests
 *
 * 1. Clean-install guard: verifies dev mode routes to Auth (not Migration)
 * 2. Per-wallet migration: seed legacy data → RiveIntro → MigrationHome →
 *    wallet list → migrate each wallet individually (email → password →
 *    keygen → verify) → MigrationSuccess → vault integrity → persistence.
 *
 * Test data: 2 standard wallets (TestWallet1, TestWallet2) + 1 Ledger wallet.
 * Ledger wallets don't need DKLS migration and should appear as already
 * migrated (no migrate button) on the wallet list screen.
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail')
const { eraseSimulator } = require('./helpers/simulator')

// --- Clean install guard ---
// Verifies that dev mode routes clean installs to Auth (not Migration),
// so dev-only seed buttons are accessible for subsequent tests.

describe('Fast Vault Migration — Clean Install Guard', () => {
  beforeAll(async () => {
    eraseSimulator(device.id)

    await device.launchApp({ delete: true, newInstance: true })
    await device.disableSynchronization()
  })

  afterAll(async () => {
    await device.enableSynchronization()
  })

  it('shows auth screen on clean install in dev mode', async () => {
    await waitFor(element(by.text('Create New Wallet')))
      .toBeVisible()
      .withTimeout(90000)
  })
})

// --- Per-wallet migration flow ---

describe('Fast Vault Migration — Per-Wallet', () => {
  let knownMessageIds = new Set()

  beforeAll(async () => {
    eraseSimulator(device.id)

    // Seed legacy keystore data
    await device.launchApp({ delete: true, newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.text('Seed Legacy Data (dev)')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.text('Seed Legacy Data (dev)')).tap()
    await waitFor(element(by.id('seed-done')))
      .toExist()
      .withTimeout(30000)

    // Relaunch to trigger migration flow
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    // Snapshot agentmail before any wallets
    knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL)
  })

  afterAll(async () => {
    await device.enableSynchronization()
  })

  // --- Setup and intro ---

  it('should play RiveIntro and reach MigrationHome', async () => {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(90000)
    await element(by.id('enter-vultiverse-cta')).tap()

    await waitFor(element(by.text('Start Migration')))
      .toBeVisible()
      .withTimeout(90000)
  })

  it('should navigate to wallet list', async () => {
    await new Promise((r) => setTimeout(r, 3000))
    await element(by.text('Start Migration')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('should show wallet cards', async () => {
    await waitFor(element(by.id('wallet-card-0')))
      .toBeVisible()
      .withTimeout(30000)
  })

  it('should show ledger wallet on the list', async () => {
    // Ledger wallet should appear in the list (no migrate needed for ledger)
    await waitFor(element(by.text('TestLedgerWallet')))
      .toBeVisible()
      .withTimeout(10000)
  })

  // --- Per-wallet migration ---

  it('should migrate wallet 1', async () => {
    await migrateOneWalletFromCard(
      0,
      'TestWallet1',
      knownMessageIds,
      true
    )
  })

  it('should migrate wallet 2', async () => {
    await migrateOneWalletFromCard(
      1,
      'TestWallet2',
      knownMessageIds,
      false
    )
  })

  // --- Vault integrity verification ---

  it('should show migration success with vault verification', async () => {
    await waitFor(element(by.id('verify-all-passed')))
      .toExist()
      .withTimeout(15000)
    await expect(element(by.id('verify-imported-exists'))).toHaveText(
      'imported-exists: true'
    )
    await expect(element(by.id('verify-imported-name'))).toHaveText(
      'imported-name: true'
    )
  })

  it('migrated vault has valid key material', async () => {
    await expect(
      element(by.id('verify-imported-has-pubkey'))
    ).toHaveText('imported-has-pubkey: true')
    await expect(
      element(by.id('verify-imported-has-keyshare'))
    ).toHaveText('imported-has-keyshare: true')
  })

  it('migrated vault has correct lib type and signers', async () => {
    await expect(
      element(by.id('verify-imported-libtype'))
    ).toHaveText('imported-libtype: true')
    await expect(
      element(by.id('verify-imported-has-signers'))
    ).toHaveText('imported-has-signers: true')
  })

  it('all vault verification checks pass', async () => {
    await expect(element(by.id('verify-all-passed'))).toHaveText(
      'all-passed: true'
    )
  })

  it('should dismiss migration and show main app', async () => {
    await element(by.id('success-back')).tap()
    await new Promise((r) => setTimeout(r, 2000))
  })

  // --- Export DKLS vault ---

  it('should show Export Vault Share on relaunch', async () => {
    // Relaunch — app goes to Main → WalletList
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()

    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(90000)

    await waitFor(element(by.text('TestWallet1')))
      .toBeVisible()
      .withTimeout(10000)

    await waitFor(element(by.id('wallet-card-0-export')))
      .toBeVisible()
      .withTimeout(5000)
    await element(by.id('wallet-card-0-export')).tap()

    await waitFor(element(by.text('Export as Vault Share')))
      .toBeVisible()
      .withTimeout(10000)
  })

  it('should show export password form when tapping Export as Vault Share', async () => {
    await element(by.text('Export as Vault Share')).tap()

    await waitFor(
      element(by.text('Set a password to encrypt the vault file:'))
    )
      .toBeVisible()
      .withTimeout(5000)
  })

  it('should not show raw private key reveal for DKLS vault', async () => {
    let revealVisible = false
    try {
      await waitFor(element(by.text('Reveal Private Key')))
        .toBeVisible()
        .withTimeout(2000)
      revealVisible = true
    } catch {}

    if (revealVisible) {
      throw new Error(
        'Raw key reveal should be hidden for DKLS vaults'
      )
    }
  })

  // --- Persistence ---

  it('should not show migration flow on relaunch', async () => {
    await device.launchApp({ newInstance: true })
    await device.disableSynchronization()
    await new Promise((r) => setTimeout(r, 3000))

    let migrationShown = false
    try {
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(5000)
      migrationShown = true
    } catch {}

    if (migrationShown) {
      throw new Error(
        'Migration flow should not appear after successful migration'
      )
    }
  })
})
