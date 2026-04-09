/**
 * Import Vault E2E Test
 *
 * Tests the "I already have a Fast Vault" → ImportVault flow.
 * Uses a pre-staged test vault file for Detox automation.
 *
 * In __DEV__ mode, the useImportFlow hook checks for a file named
 * `detox-import.vult` in the app's document directory and auto-selects it
 * when the user taps the file picker. This bypasses the system file dialog
 * that Detox cannot automate.
 *
 * NOTE: The full import flow (file detection → decrypt → persist → success)
 * requires a real .vult fixture file at e2e/fixtures/test-vault.vult.
 * Without it, only the navigation tests run and the import tests are skipped.
 *
 * To generate a fixture:
 *   1. Run the fast-vault-migration test to create a DKLS vault
 *   2. Export the vault via WalletHome → Export Vault Share → Export as Vault Share
 *   3. Copy the .vult file to e2e/fixtures/test-vault.vult
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Import Vault', () => {
  const fixtureFile = path.resolve(__dirname, 'fixtures', 'test-vault.vult');
  const hasFixture = fs.existsSync(fixtureFile);

  describe('Navigation to ImportVault', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should play RiveIntro and reach MigrationHome', async () => {
      // Clean install (no wallets) → RiveIntro auto-plays → MigrationHome
      await waitFor(element(by.id('import-vault-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should navigate to ImportVault screen', async () => {
      await element(by.id('import-vault-button')).tap();

      // FileDropZone shows "Import your vault share" in the empty state
      await waitFor(element(by.text('Import your vault share')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show supported file types hint', async () => {
      await expect(element(by.text('Supported file types: .bak & .vult'))).toBeVisible();
    });

    it('should show the Continue button (disabled without a file)', async () => {
      await expect(element(by.id('import-continue'))).toBeVisible();
    });

    it('should navigate back to MigrationHome', async () => {
      await element(by.id('import-vault-back')).tap();
      await waitFor(element(by.id('import-vault-button')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // Full import flow — only runs when a .vult fixture is available
  if (hasFixture) {
    describe('Import with staged fixture', () => {
      beforeAll(async () => {
        const udid = device.id;
        execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
          timeout: 30000,
        });
        execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

        // Install the app first so we can stage files
        await device.launchApp({
          delete: true,
          newInstance: true,
          launchArgs: { detoxURLBlacklistRegex: '.*' },
        });
        await device.terminateApp();

        // Stage the fixture in the simulator's app document directory.
        // expo-file-system Paths.document maps to the app's Documents folder.
        const bundleId = 'com.nicecode.vultisig';
        const appContainer = execSync(
          `xcrun simctl get_app_container ${udid} ${bundleId} data 2>/dev/null`,
          { encoding: 'utf8' },
        ).trim();
        const documentsDir = path.join(appContainer, 'Documents');
        execSync(`mkdir -p "${documentsDir}"`);
        fs.copyFileSync(fixtureFile, path.join(documentsDir, 'detox-import.vult'));
        console.log(`[Import] Staged fixture at ${documentsDir}/detox-import.vult`);

        // Relaunch with the staged file in place
        await device.launchApp({
          newInstance: true,
          launchArgs: { detoxURLBlacklistRegex: '.*' },
        });
        await device.disableSynchronization();
      });

      afterAll(async () => {
        await device.enableSynchronization();
      });

      it('should reach ImportVault screen', async () => {
        // RiveIntro → MigrationHome
        await waitFor(element(by.id('import-vault-button')))
          .toBeVisible()
          .withTimeout(30000);

        await element(by.id('import-vault-button')).tap();
        await waitFor(element(by.text('Import your vault share')))
          .toBeVisible()
          .withTimeout(10000);
      });

      it('should auto-detect staged vault file when tapping file picker', async () => {
        // Tapping the drop zone triggers pickFile → importDetoxStagedFile
        // which reads detox-import.vult from the documents directory
        await element(by.id('import-file-picker')).tap();

        // The file should be detected and the drop zone should switch to success state.
        // Either the file name badge appears or the Continue button becomes enabled.
        // Wait for the file name to appear in the success badge.
        await waitFor(element(by.text('detox-import.vult')))
          .toBeVisible()
          .withTimeout(10000);
      });

      it('should show Continue button after file selection', async () => {
        await expect(element(by.id('import-continue'))).toBeVisible();
      });

      // NOTE: What happens next depends on whether the fixture is encrypted:
      //
      // Unencrypted fixture:
      //   - Tapping Continue immediately imports and navigates to MigrationSuccess
      //
      // Encrypted fixture:
      //   - DecryptPasswordSheet appears
      //   - Enter password → tap decrypt-continue
      //   - Navigates to MigrationSuccess
      //
      // Since we don't know the fixture's encryption state at write time,
      // both paths are covered below. The encrypted path uses a password
      // that should match the fixture's export password.

      it('should import vault or show password prompt', async () => {
        await element(by.id('import-continue')).tap();
        await new Promise((r) => setTimeout(r, 2000));

        // Check if we landed on MigrationSuccess or got a password prompt
        let needsPassword = false;
        try {
          await waitFor(element(by.id('decrypt-password-input')))
            .toBeVisible()
            .withTimeout(3000);
          needsPassword = true;
        } catch {
          // No password needed — should be on MigrationSuccess
        }

        if (needsPassword) {
          // Enter the fixture's export password
          // TODO: Update this password to match the test fixture's export password
          const FIXTURE_PASSWORD = 'testpassword123';
          await element(by.id('decrypt-password-input')).typeText(FIXTURE_PASSWORD);
          await element(by.id('decrypt-continue')).tap();

          await waitFor(element(by.id('continue-button')))
            .toBeVisible()
            .withTimeout(15000);
        } else {
          await waitFor(element(by.id('continue-button')))
            .toBeVisible()
            .withTimeout(15000);
        }
      });

      it('should complete import and dismiss migration', async () => {
        await element(by.id('continue-button')).tap();
        await new Promise((r) => setTimeout(r, 2000));
      });
    });

    describe('Persistence — imported vault survives relaunch', () => {
      beforeAll(async () => {
        await device.launchApp({
          newInstance: true,
          launchArgs: { detoxURLBlacklistRegex: '.*' },
        });
        await device.disableSynchronization();
        await new Promise((r) => setTimeout(r, 3000));
      });

      afterAll(async () => {
        await device.enableSynchronization();
      });

      it('should not show migration flow on relaunch', async () => {
        // If import succeeded, migration should be complete —
        // the app should NOT show the migration-cta button
        let migrationShown = false;
        try {
          await waitFor(element(by.id('migration-cta')))
            .toBeVisible()
            .withTimeout(5000);
          migrationShown = true;
        } catch {
          // Expected — migration is complete
        }

        if (migrationShown) {
          throw new Error('Migration flow should not appear after successful import');
        }
      });
    });
  } else {
    describe('Import flow (SKIPPED — no fixture)', () => {
      it('SKIP: Import flow requires e2e/fixtures/test-vault.vult', () => {
        console.warn(
          '[Import Vault] Full import test skipped — no .vult fixture found.\n' +
            'To generate one:\n' +
            '  1. Run the fast-vault-migration test to create a DKLS vault\n' +
            '  2. Export the vault: WalletHome → Export Vault Share → Export as Vault Share\n' +
            '  3. Copy the .vult file to e2e/fixtures/test-vault.vult',
        );
      });
    });
  }
});
