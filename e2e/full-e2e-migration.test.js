describe('Full E2E: Migration → Decrypt → Vault Export', () => {
  beforeAll(async () => {
    // Erase simulator to clear keychain — iOS keychain items survive
    // app deletion, causing the app to find old wallets and skip AuthMenu.
    const { execSync } = require('child_process');
    const udid = device.id;
    execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
      timeout: 30000,
    });
    execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

    await device.launchApp({ delete: true, newInstance: true });
    await device.disableSynchronization();

    // Dismiss onboarding screen if present
    try {
      await waitFor(element(by.text('Get started')))
        .toBeVisible()
        .withTimeout(15000);
      await element(by.text('Get started')).tap();
    } catch {
      // Already past onboarding
    }

    // Tap the "Full E2E Test" dev button on AuthMenu (use text match for Fabric compat)
    await waitFor(element(by.text('Full E2E Test (dev)')))
      .toBeVisible()
      .withTimeout(30000);
    await element(by.text('Full E2E Test (dev)')).tap();

    // Wait for test to complete — look for either pass or fail
    // (Detox by.text doesn't support regex reliably, use exact strings)
    let completed = false;
    try {
      await waitFor(element(by.text('all-passed: true')))
        .toExist()
        .withTimeout(90000);
      completed = true;
    } catch {
      // Might have failed — check for false
      try {
        await waitFor(element(by.text('all-passed: false')))
          .toExist()
          .withTimeout(5000);
        completed = true;
      } catch {
        // Check for error text
      }
    }
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  // Helper: assert a result line shows "true"
  const expectStep = (key) =>
    expect(element(by.text(`${key}: true`))).toExist();

  // Phase 1: Migration
  it('step 1: clean slate', async () => {
    await expectStep('step01-clean');
  });

  it('step 2: builds auth data with encrypted keys', async () => {
    await expectStep('step02-build-data');
  });

  it('step 3: seeds legacy keystore', async () => {
    await expectStep('step03-seeded');
  });

  it('step 4: reads back from legacy keystore', async () => {
    await expectStep('step04-legacy-read');
  });

  it('step 5: migrates to expo-secure-store', async () => {
    await expectStep('step05-migrated');
  });

  it('step 6: data in new store matches', async () => {
    await expectStep('step06-new-store');
  });

  it('step 7: legacy data cleaned up', async () => {
    await expectStep('step07-legacy-cleaned');
  });

  it('step 8: migration is idempotent', async () => {
    await expectStep('step08-idempotent');
  });

  // Phase 2: Decrypt + Validate
  it('step 9: parsed data has 3 wallets', async () => {
    await expectStep('step09-wallet-count');
  });

  it('step 10: decrypts wallet 1 private key', async () => {
    await expectStep('step10-decrypt-w1');
  });

  it('step 11: decrypts wallet 2 private key', async () => {
    await expectStep('step11-decrypt-w2');
  });

  it('step 12: ledger wallet structure preserved', async () => {
    await expectStep('step12-ledger');
  });

  it('step 13: derives correct public key', async () => {
    await expectStep('step13-pubkey');
  });

  // Phase 3: Vault Export + Verification
  it('step 14: exports vault share file', async () => {
    await expectStep('step14-export');
  });

  it('step 15: reads .vult file back', async () => {
    await expectStep('step15-file-read');
  });

  it('step 16: parses VaultContainer protobuf', async () => {
    await expectStep('step16-container');
  });

  it('step 17: decrypts vault payload (AES-GCM)', async () => {
    await expectStep('step17-vault-decrypt');
  });

  it('step 18: vault name matches', async () => {
    await expectStep('step18-vault-name');
  });

  it('step 19: vault fields match (pubkey, libType, keyShares)', async () => {
    await expectStep('step19-vault-fields');
  });

  // Phase 4: Size Stress Test
  it('step 20: 10-wallet payload exceeds 2KB (historical limit)', async () => {
    await expectStep('step20-over-2k');
  });

  it('step 21: large payload writes to expo-secure-store', async () => {
    await expectStep('step21-size-write');
  });

  it('step 22: large payload reads back byte-for-byte', async () => {
    await expectStep('step22-size-match');
  });

  // Overall
  it('all steps pass', async () => {
    await expectStep('all-passed');
  });
});
