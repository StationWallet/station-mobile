describe('Full E2E: Migration → Decrypt → Size', () => {
  beforeAll(async () => {
    // Erase simulator to clear keychain — iOS keychain items survive
    // app deletion, causing the app to find old wallets and skip AuthMenu.
    const { execSync } = require('child_process');
    const udid = device.id;
    execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
      timeout: 120000,
    });
    execSync(`xcrun simctl boot ${udid}`, { timeout: 120000 });

    await device.launchApp({ delete: true, newInstance: true });
    await device.disableSynchronization();

    // Tap the "Full E2E Test" dev button on AuthMenu
    await waitFor(element(by.text('Full E2E Test (dev)')))
      .toBeVisible()
      .withTimeout(90000);
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

  // Phase 3: Size Stress Test
  it('step 14: 10-wallet payload exceeds 2KB (historical limit)', async () => {
    await expectStep('step14-over-2k');
  });

  it('step 15: large payload writes to expo-secure-store', async () => {
    await expectStep('step15-size-write');
  });

  it('step 16: large payload reads back byte-for-byte', async () => {
    await expectStep('step16-size-match');
  });

  // Overall
  it('all steps pass', async () => {
    await expectStep('all-passed');
  });
});
