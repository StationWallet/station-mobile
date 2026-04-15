describe('Crypto Parity', () => {
  beforeAll(async () => {
    // Erase simulator to clear keychain — iOS keychain items survive app deletion
    const { execSync } = require('child_process');
    const udid = device.id;
    execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
      timeout: 120000,
    });
    execSync(`xcrun simctl boot ${udid}`, { timeout: 120000 });

    await device.launchApp({ delete: true, newInstance: true });
    await device.disableSynchronization();

    // Tap the dev-only "Crypto Tests" button on AuthMenu
    await waitFor(element(by.id('dev-crypto-test')))
      .toBeVisible()
      .withTimeout(90000);
    await element(by.id('dev-crypto-test')).tap();

    // Wait for crypto test results to render
    await waitFor(element(by.id('mk330-address')))
      .toExist()
      .withTimeout(15000);
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  it('mk330-address matches golden value', async () => {
    await expect(element(by.id('mk330-address'))).toHaveText('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });
  it('mk330-privkey matches golden value', async () => {
    await expect(element(by.id('mk330-privkey'))).toHaveText('05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10');
  });
  it('mk330-pubkey matches golden value', async () => {
    await expect(element(by.id('mk330-pubkey'))).toHaveText('Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE');
  });
  it('mk118-address matches golden value', async () => {
    await expect(element(by.id('mk118-address'))).toHaveText('terra19rl4cm2hmr8afy4kldpxz3fka4jguq0a6yhaa4');
  });
  it('mk118-privkey matches golden value', async () => {
    await expect(element(by.id('mk118-privkey'))).toHaveText('c4a48e2fce1481cd3294b4490f6678090ea98d3d0e5cd984558ab0968741b104');
  });
  it('mk118-pubkey matches golden value', async () => {
    await expect(element(by.id('mk118-pubkey'))).toHaveText('Ak9OKtmcNNYLm6YoPJQxqEGK+GcyEpYfl6d7Y3f80Fti');
  });
  it('mk2-330-address matches golden value', async () => {
    await expect(element(by.id('mk2-330-address'))).toHaveText('terra1whertfa9u8a8676cryt0prqdnhwkcj5tu9qsq8');
  });
  it('mk2-330-privkey matches golden value', async () => {
    await expect(element(by.id('mk2-330-privkey'))).toHaveText('87dcd8210f184ade53a1a57c5cd06fc65cdaca53bfed239cd7b5dea4c126dfec');
  });
  it('mk2-118-address matches golden value', async () => {
    await expect(element(by.id('mk2-118-address'))).toHaveText('terra1am058pdux3hyulcmfgj4m3hhrlfn8nzmprx8dq');
  });
  it('mk2-custom-address matches golden value', async () => {
    await expect(element(by.id('mk2-custom-address'))).toHaveText('terra169d7v4jaxppvpvtdl4e992m9pcshkhcjmr9tqp');
  });
  it('mk2-custom-privkey matches golden value', async () => {
    await expect(element(by.id('mk2-custom-privkey'))).toHaveText('07f1252907bc12a95f76ec90cbd94707c466adac141338e389c7e4533ced108f');
  });
  it('rawkey-address matches golden value', async () => {
    await expect(element(by.id('rawkey-address'))).toHaveText('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });
  it('rawkey-pubkey matches golden value', async () => {
    await expect(element(by.id('rawkey-pubkey'))).toHaveText('Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE');
  });
  it('sign-payload matches golden value', async () => {
    await expect(element(by.id('sign-payload'))).toHaveText('095786c42a36f31b07f4eccf6845a0348428521d12111ce8c8d821f41c41dcfd2664e6d5794105a902dde9f733b09cce1be96e4da7b6144ee82b73ddfa1d0aca');
  });
  it('ecdsa-recid is 0', async () => {
    await expect(element(by.id('ecdsa-recid'))).toHaveText('0');
  });
  it('validates correct address', async () => {
    await expect(element(by.id('validate-valid'))).toHaveText('true');
  });
  it('rejects invalid address', async () => {
    await expect(element(by.id('validate-invalid'))).toHaveText('false');
  });
  it('rejects wrong prefix', async () => {
    await expect(element(by.id('validate-wrong-prefix'))).toHaveText('false');
  });
  it('validates valoper address', async () => {
    await expect(element(by.id('valaddress-valid'))).toHaveText('true');
  });
  it('converts valoper to acc address', async () => {
    await expect(element(by.id('fromval'))).toHaveText('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });
  it('generates 24-word mnemonic', async () => {
    await expect(element(by.id('gen-wordcount'))).toHaveText('24');
  });
  it('generated key has terra address', async () => {
    await expect(element(by.id('gen-has-address'))).toHaveText('true');
  });
  it('private key is 32 bytes', async () => {
    await expect(element(by.id('gen-privkey-length'))).toHaveText('32');
  });
  it('sha256 hash matches', async () => {
    await expect(element(by.id('hash-sha256'))).toHaveText('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
  it('sha512 hash matches', async () => {
    await expect(element(by.id('hash-sha512'))).toHaveText('309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f');
  });
  it('ripemd160 hash matches', async () => {
    await expect(element(by.id('hash-ripemd160'))).toHaveText('98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f');
  });
  it('hmac-sha256 matches', async () => {
    await expect(element(by.id('hmac-sha256'))).toHaveText('095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67');
  });
  it('unsupported hash throws', async () => {
    await expect(element(by.id('hash-unsupported-throws'))).toHaveText('true');
  });
  it('randomBytes is not all zeros', async () => {
    await expect(element(by.id('random-not-zero'))).toHaveText('true');
  });
  it('randomBytes has correct length', async () => {
    await expect(element(by.id('random-length'))).toHaveText('32');
  });
  it('randomBytes produces unique output', async () => {
    await expect(element(by.id('random-unique'))).toHaveText('true');
  });
});
