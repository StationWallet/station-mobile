/**
 * Reset app state between Detox suites without a simctl erase.
 * Relies on the DevStateReset screen, which clears SecureStore,
 * preferences flags, and the legacy native keystore.
 */
async function devReset() {
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()

  await waitFor(element(by.id('dev-reset-state')))
    .toBeVisible()
    .withTimeout(60000)
  await element(by.id('dev-reset-state')).tap()

  await waitFor(element(by.id('dev-reset-done')))
    .toExist()
    .withTimeout(15000)

  await device.terminateApp()
}

module.exports = { devReset }
