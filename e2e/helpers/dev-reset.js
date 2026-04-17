const { execSync } = require('child_process')

/**
 * Reset app state between Detox suites.
 *
 * Fast path: launch the app, tap the DevStateReset button (testID
 * `dev-reset-state`) which clears SecureStore, preferences flags, and
 * the legacy native keystore in-app. Takes ~5s, avoids simulator erase.
 *
 * Fallback: if the button isn't reachable within 15s (e.g. a prior
 * suite left wallets that route the app to Main instead of AuthMenu),
 * shut down and erase the simulator. Slower (~2 min) but guaranteed.
 */
async function devReset() {
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()

  try {
    await waitFor(element(by.id('dev-reset-state')))
      .toBeVisible()
      .withTimeout(15000)
    await element(by.id('dev-reset-state')).tap()
    await waitFor(element(by.id('dev-reset-done')))
      .toExist()
      .withTimeout(15000)
    await device.terminateApp()
    return
  } catch {
    // Fast path unavailable — fall through to erase.
  }

  try { await device.terminateApp() } catch {}
  execSync(
    `xcrun simctl shutdown ${device.id} 2>/dev/null; xcrun simctl erase ${device.id}`,
    { timeout: 180000 },
  )
  execSync(`xcrun simctl boot ${device.id}`, { timeout: 120000 })
}

module.exports = { devReset }
