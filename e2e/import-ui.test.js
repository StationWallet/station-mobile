const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { devReset } = require('./helpers/dev-reset')

const FIXTURE_PASSWORD = 'testpassword123'
const WRONG_PASSWORD = 'wrongpassword999'
const BUNDLE_ID = 'money.terra.station'

const fixtureVult = path.resolve(__dirname, 'fixtures', 'test-vault.vult')
const fixtureBak = path.resolve(__dirname, 'fixtures', 'test-vault.bak')

function stageFixture(udid, srcPath, destName) {
  const appContainer = execSync(
    `xcrun simctl get_app_container ${udid} ${BUNDLE_ID} data`,
    { encoding: 'utf8' },
  ).trim()
  const documentsDir = path.join(appContainer, 'Documents')
  execSync(`mkdir -p "${documentsDir}"`)
  fs.copyFileSync(srcPath, path.join(documentsDir, destName))
}

async function setupWithFixture(fixturePath, fixtureName) {
  await devReset()

  // Launch briefly so the app container/bundle is installed.
  await device.launchApp({ newInstance: true })
  await device.terminateApp()

  stageFixture(device.id, fixturePath, fixtureName)

  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxURLBlacklistRegex: '.*' },
  })
  await device.disableSynchronization()
}

async function navigateToImportScreen() {
  await waitFor(element(by.id('dev-create-fast-vault')))
    .toBeVisible()
    .withTimeout(60000)
  await element(by.id('dev-create-fast-vault')).tap()

  try {
    await waitFor(element(by.id('enter-vultiverse-cta')))
      .toBeVisible()
      .withTimeout(10000)
    await element(by.id('enter-vultiverse-cta')).tap()
  } catch {}

  await waitFor(element(by.id('import-vault-button')))
    .toBeVisible()
    .withTimeout(30000)
  await element(by.id('import-vault-button')).tap()

  await waitFor(element(by.text('Import your vault share')))
    .toBeVisible()
    .withTimeout(10000)
}

async function pickFileAndWaitForPassword() {
  await element(by.id('import-file-picker')).tap()
  await waitFor(element(by.id('decrypt-password-input')))
    .toBeVisible()
    .withTimeout(10000)
}

describe('Import Vault UI', () => {
  describe('.vult with correct password', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureVult, 'detox-import.vult')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('decrypts and imports', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(FIXTURE_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000)
    })

    it('reaches main app and persists on relaunch', async () => {
      await waitFor(element(by.id('success-back')))
        .toBeVisible()
        .withTimeout(5000)
      await element(by.id('success-back')).tap()

      await device.launchApp({ newInstance: true })
      await device.disableSynchronization()
      await waitFor(element(by.text('Test Import Vault')))
        .toBeVisible()
        .withTimeout(30000)
    })
  })

  describe('wrong password', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureVult, 'detox-import.vult')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('shows error and keeps sheet open', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(WRONG_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('Incorrect password, try again')))
        .toBeVisible()
        .withTimeout(5000)
      await expect(element(by.id('decrypt-password-input'))).toBeVisible()
    })
  })

  describe('.bak extension', () => {
    beforeAll(async () => {
      await setupWithFixture(fixtureBak, 'detox-import.bak')
    })
    afterAll(async () => { try { await device.enableSynchronization() } catch {} })

    it('imports .bak successfully', async () => {
      await navigateToImportScreen()
      await pickFileAndWaitForPassword()
      await element(by.id('decrypt-password-input')).typeText(FIXTURE_PASSWORD)
      await element(by.id('decrypt-continue')).tap()
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000)
    })
  })
})
