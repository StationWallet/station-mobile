const {
  MnemonicKey, RawKey, AccAddress, ValAddress,
} = require('../../polyfills/terra');

const MNEMONIC_1 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MNEMONIC_2 = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const PRIVKEY_1 = '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10';

describe('MnemonicKey derivation — mnemonic 1', () => {
  test('coinType=330 derives correct address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 });
    expect(mk.accAddress).toBe('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });

  test('coinType=330 derives correct private key', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 });
    expect(mk.privateKey.toString('hex')).toBe(PRIVKEY_1);
  });

  test('coinType=330 derives correct public key', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 });
    expect(mk.publicKey.key).toBe('Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE');
  });

  test('coinType=118 derives correct address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 118 });
    expect(mk.accAddress).toBe('terra19rl4cm2hmr8afy4kldpxz3fka4jguq0a6yhaa4');
  });

  test('coinType=118 derives correct private key', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 118 });
    expect(mk.privateKey.toString('hex')).toBe('c4a48e2fce1481cd3294b4490f6678090ea98d3d0e5cd984558ab0968741b104');
  });
});

describe('MnemonicKey derivation — mnemonic 2', () => {
  test('coinType=330 derives correct address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_2, coinType: 330 });
    expect(mk.accAddress).toBe('terra1whertfa9u8a8676cryt0prqdnhwkcj5tu9qsq8');
  });

  test('coinType=118 derives correct address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_2, coinType: 118 });
    expect(mk.accAddress).toBe('terra1am058pdux3hyulcmfgj4m3hhrlfn8nzmprx8dq');
  });

  test('custom account=1 index=2 coinType=330 derives correct address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_2, coinType: 330, account: 1, index: 2 });
    expect(mk.accAddress).toBe('terra169d7v4jaxppvpvtdl4e992m9pcshkhcjmr9tqp');
  });
});

describe('RawKey', () => {
  test('derives correct address from private key', () => {
    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'));
    expect(rk.accAddress).toBe('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });

  test('sign produces correct signature', async () => {
    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'));
    const sig = await rk.sign(Buffer.from('test message to sign'));
    expect(sig.toString('hex')).toBe('095786c42a36f31b07f4eccf6845a0348428521d12111ce8c8d821f41c41dcfd2664e6d5794105a902dde9f733b09cce1be96e4da7b6144ee82b73ddfa1d0aca');
  });

  test('ecdsaSign returns recid 0', () => {
    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'));
    const { recid } = rk.ecdsaSign(Buffer.from('test message to sign'));
    expect(recid).toBe(0);
  });
});

describe('MnemonicKey generation', () => {
  test('generates 24-word mnemonic', () => {
    const mk = new MnemonicKey();
    expect(mk.mnemonic.split(' ').length).toBe(24);
  });

  test('generated key has terra address', () => {
    const mk = new MnemonicKey();
    expect(mk.accAddress.startsWith('terra')).toBe(true);
  });

  test('private key is 32 bytes', () => {
    const mk = new MnemonicKey();
    expect(mk.privateKey.length).toBe(32);
  });
});

describe('AccAddress', () => {
  test('validates correct address', () => {
    expect(AccAddress.validate('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv')).toBe(true);
  });

  test('rejects non-string', () => {
    expect(AccAddress.validate(12345)).toBe(false);
  });

  test('rejects invalid string', () => {
    expect(AccAddress.validate('notanaddress')).toBe(false);
  });

  test('rejects wrong prefix', () => {
    expect(AccAddress.validate('cosmos1amdttz2937a3dytmxmkany53pp6ma6dyzr7hkl')).toBe(false);
  });

  test('rejects address with wrong data length', () => {
    const { bech32 } = require('bech32');
    const shortData = Buffer.alloc(10);
    const words = bech32.toWords(shortData);
    const badAddr = bech32.encode('terra', words);
    expect(AccAddress.validate(badAddr)).toBe(false);
  });
});

describe('ValAddress', () => {
  test('validates correct valoper address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 });
    expect(ValAddress.validate(mk.valAddress)).toBe(true);
  });
});

describe('AccAddress.fromValAddress', () => {
  test('converts valoper to acc address', () => {
    const mk = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 });
    expect(AccAddress.fromValAddress(mk.valAddress)).toBe('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv');
  });
});
