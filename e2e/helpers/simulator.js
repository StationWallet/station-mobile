const { execSync } = require('child_process')

/**
 * Erase and reboot the iOS simulator to get a clean keychain state.
 * iOS keychain items survive app deletion, so simctl erase is needed
 * to fully isolate test suites from each other.
 */
function eraseSimulator(deviceId) {
  execSync(
    `xcrun simctl shutdown ${deviceId} 2>/dev/null; xcrun simctl erase ${deviceId}`,
    { timeout: 120000 }
  )
  execSync(`xcrun simctl boot ${deviceId}`, { timeout: 120000 })
}

module.exports = { eraseSimulator }
