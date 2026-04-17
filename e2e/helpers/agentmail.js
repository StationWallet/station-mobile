/**
 * Tier 2 migration helper — stubbed OTP.
 *
 * Real-OTP version lives under e2e/smoke/helpers/agentmail.js (Phase I).
 */
async function migrateOneWalletFromCardStubbed(walletIndex, walletLabel, hasMoreWallets) {
  console.log(`\n--- Migrating ${walletLabel} (stubbed) ---`)

  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000)
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap()

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

  await waitFor(element(by.text('Verify your email')))
    .toBeVisible()
    .withTimeout(20000)
  await element(by.id('verify-code-input')).tap()
  await element(by.id('verify-code-input')).replaceText('0000')

  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(30000)

  if (hasMoreWallets) {
    await element(by.id('migrate-another-wallet')).tap()
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000)
  }

  console.log(`--- ${walletLabel} complete ---\n`)
}

module.exports = {
  migrateOneWalletFromCardStubbed,
}
