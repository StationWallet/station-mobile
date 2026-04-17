const detoxGlobalSetup = require('detox/runners/jest/globalSetup')
const { execSync } = require('child_process')

module.exports = async function globalSetup() {
  // Exactly one simctl erase per run.
  try {
    const list = execSync(
      'xcrun simctl list devices -j "iPhone 16" 2>/dev/null',
      { encoding: 'utf8' },
    )
    const parsed = JSON.parse(list)
    const devices = Object.values(parsed.devices).flat()
    const match = devices.find(
      (d) =>
        d.name === 'iPhone 16' && d.availability !== 'unavailable',
    )
    if (match) {
      execSync(
        `xcrun simctl shutdown ${match.udid} 2>/dev/null; xcrun simctl erase ${match.udid}`,
        { timeout: 180000 },
      )
    }
  } catch (e) {
    console.warn(
      '[globalSetup] simctl erase failed (non-fatal):',
      e.message,
    )
  }

  await detoxGlobalSetup()
}
