# Expo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Station Wallet mobile app on Expo 55 with working balance, receive, history, and wallet creation — no WebView dependency on dead Terra infrastructure.

**Architecture:** Three-phase migration: (1) harden the pure-JS polyfills that replaced `@terra-money/terra.js` and build a real fetch-based LCD client, (2) verify crypto parity with the original terra.js using Detox on an iOS simulator, (3) replace the dead WebView with native React Native screens and restore the deleted auth flow for wallet creation/recovery.

**Tech Stack:** React Native 0.83 / Expo 55 / Hermes, React Navigation 6, Recoil, react-query v3, @noble/hashes + elliptic + @scure/bip32 for crypto, Detox for E2E testing.

**Spec:** `docs/superpowers/specs/2026-04-01-expo-migration-unified-design.md`

---

## File Structure

### Phase 1 — Polyfill Hardening + LCD Client

| File | Action | Responsibility |
|------|--------|----------------|
| `polyfills/crypto.js` | Rename from `mocks/crypto-shim.js` + modify | CSPRNG, hash functions. Throws on failure instead of silent zeros. |
| `polyfills/terra.js` | Rename from `mocks/terra-js-safe.js` + modify | MnemonicKey, RawKey, AccAddress, Msgs, Wallet, LCDClient. Wires to terra-lcd. |
| `polyfills/terra-lcd.js` | Create | Fetch-based Cosmos REST client. All LCD module implementations. |
| `polyfills/ledger-transport-ble.js` | Rename from `mocks/` | Unchanged stub. |
| `polyfills/ledger-terra-js.js` | Rename from `mocks/` | Unchanged stub. |
| `metro.config.js` | Modify | Update resolver paths from `mocks/` to `polyfills/`. |
| `shim.js` | Modify | Add explanatory comment on `process.browser = false`. |
| `package.json` | Modify | Promote crypto deps, add @scure/bip32, remove expo-crypto. |
| `__tests__/polyfills/crypto.test.js` | Create | Node.js tests for crypto safety fixes. |
| `__tests__/polyfills/terra-keys.test.js` | Create | Node.js tests for key derivation parity. |
| `__tests__/polyfills/terra-msgs.test.js` | Create | Node.js tests for Msg serialization. |

### Phase 2 — Crypto Parity Verification

| File | Action | Responsibility |
|------|--------|----------------|
| `.detoxrc.js` | Create | Detox root configuration. |
| `e2e/jest.config.js` | Create | Jest config for Detox runner. |
| `e2e/crypto-parity.test.js` | Create | Golden value assertions against Hermes runtime. |
| `src/components/CryptoTestScreen.tsx` | Create | Dev-only screen rendering crypto results as testID elements. |
| `src/navigatoin/index.tsx` | Modify | Render CryptoTestScreen in `__DEV__` mode. |
| `app.json` | Modify | Add `@config-plugins/detox` plugin. |
| `package.json` | Modify | Add detox devDeps + e2e scripts. |

### Phase 3 — Native UI + Auth Screens

| File | Action | Responsibility |
|------|--------|----------------|
| `src/navigation/` | Rename from `src/navigatoin/` | Fix directory typo. |
| `src/navigation/index.tsx` | Modify | Route to MainNavigator or AuthNavigator based on wallet state. |
| `src/navigation/MainNavigator.tsx` | Create | Stack: WalletHome, Receive, History. |
| `src/navigation/AuthNavigator.tsx` | Modify | Simplify to AuthMenu + NewWallet + RecoverWallet only. |
| `src/navigation/NewWalletStack.tsx` | Modify (imports only) | Already correct, just path update from rename. |
| `src/navigation/RecoverWalletStack.tsx` | Modify (imports only) | Already correct, just path update from rename. |
| `src/screens/auth/AuthMenu.tsx` | Restore from git | Entry menu: Create / Recover wallet. |
| `src/screens/auth/NewWallet/Step1.tsx` | Restore from git | Wallet name input. |
| `src/screens/auth/NewWallet/Step2.tsx` | Restore from git | Password setup. |
| `src/screens/auth/NewWallet/Step3.tsx` | Restore from git | Generate + display seed phrase. |
| `src/screens/auth/NewWallet/WalletCreated.tsx` | Restore from git | Success + persist wallet. |
| `src/screens/auth/RecoverWallet/Step1.tsx` | Restore from git | Recovery method selection. |
| `src/screens/auth/RecoverWallet/Step2Seed.tsx` | Restore from git | Seed phrase entry. |
| `src/screens/auth/RecoverWallet/Step2QR.tsx` | Restore from git | QR recovery stub (disabled). |
| `src/screens/auth/RecoverWallet/Step3Seed.tsx` | Restore from git | Placeholder (was POC stub). |
| `src/screens/auth/RecoverWallet/Step4Seed.tsx` | Restore from git | Name + password + create wallet. |
| `src/screens/auth/RecoverWallet/WalletRecovered.tsx` | Restore from git | Success screen. |
| `src/screens/WalletHome.tsx` | Create | Balance display, action buttons. |
| `src/screens/Receive.tsx` | Create | QR code + address + copy. |
| `src/screens/History.tsx` | Create | Transaction list with pagination. |
| `src/hooks/useLCD.ts` | Modify | Merge isClassic from `src/lib/api/useLCD.ts`. |
| `src/App/index.tsx` | Modify | Remove WebView, add wallet routing, clean up Recoil. |
| `package.json` | Modify | Add react-native-qrcode-svg, react-native-svg. |

---

## Phase 1: Polyfill Hardening + LCD Client

### Task 1: Rename `mocks/` → `polyfills/` and Update Metro

**Files:**
- Rename: `mocks/` → `polyfills/` (all 4 files)
- Modify: `metro.config.js`

- [ ] **Step 1: Rename directory and files**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
git mv mocks polyfills
git mv polyfills/terra-js-safe.js polyfills/terra.js
git mv polyfills/crypto-shim.js polyfills/crypto.js
```

- [ ] **Step 2: Update metro.config.js resolver paths**

In `metro.config.js`, update all `mocks/` references to `polyfills/`:

```js
// In extraNodeModules:
crypto: path.resolve(__dirname, 'polyfills/crypto.js'),

// In resolveRequest interceptor:
// '@terra-money/terra.js' →
return { filePath: path.resolve(__dirname, 'polyfills/terra.js'), type: 'sourceFile' };

// '@ledgerhq/*' →
return { filePath: path.resolve(__dirname, 'polyfills/ledger-transport-ble.js'), type: 'sourceFile' };

// '@terra-money/ledger-terra-js' →
return { filePath: path.resolve(__dirname, 'polyfills/ledger-terra-js.js'), type: 'sourceFile' };
```

- [ ] **Step 3: Verify app starts**

```bash
npx expo start --clear
```

Expected: Metro bundler starts without resolution errors. Press `i` to launch iOS simulator — app should load (still shows WebView error, but no Metro crash).

- [ ] **Step 4: Commit**

```bash
git add polyfills/ metro.config.js
git commit -m "refactor: rename mocks/ to polyfills/ and update metro resolver"
```

---

### Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Promote transitive crypto deps to direct + add @scure/bip32**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
npm install @noble/hashes elliptic bech32 bip39 @scure/bip32
```

- [ ] **Step 2: Remove expo-crypto**

```bash
npm uninstall expo-crypto
```

- [ ] **Step 3: Verify no resolution errors**

```bash
npx expo start --clear
```

Expected: Starts without errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: promote crypto libs to direct deps, add @scure/bip32, remove expo-crypto"
```

---

### Task 3: Crypto Safety Fixes

**Files:**
- Modify: `polyfills/crypto.js`
- Create: `__tests__/polyfills/crypto.test.js`

- [ ] **Step 1: Write failing tests for crypto safety**

Create `__tests__/polyfills/crypto.test.js`:

```js
const crypto = require('../../polyfills/crypto');

describe('randomBytes', () => {
  test('returns Buffer of requested size', () => {
    const result = crypto.randomBytes(32);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  test('returns non-zero bytes', () => {
    const result = crypto.randomBytes(32);
    const allZeros = result.every(b => b === 0);
    expect(allZeros).toBe(false);
  });

  test('two calls produce different output', () => {
    const a = crypto.randomBytes(32);
    const b = crypto.randomBytes(32);
    expect(a.equals(b)).toBe(false);
  });
});

describe('createHash', () => {
  test('sha256 produces correct hash', () => {
    const result = crypto.createHash('sha256').update('hello world').digest('hex');
    expect(result).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  test('sha512 produces correct hash', () => {
    const result = crypto.createHash('sha512').update('hello world').digest('hex');
    expect(result).toBe('309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f');
  });

  test('ripemd160 produces correct hash', () => {
    const result = crypto.createHash('ripemd160').update('hello world').digest('hex');
    expect(result).toBe('98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f');
  });

  test('unsupported algorithm throws', () => {
    expect(() => crypto.createHash('md5')).toThrow('Unsupported hash algorithm: md5');
  });
});

describe('createHmac', () => {
  test('sha256 HMAC produces correct output', () => {
    const result = crypto.createHmac('sha256', 'secret-key').update('hello world').digest('hex');
    expect(result).toBe('095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67');
  });

  test('unsupported algorithm throws', () => {
    expect(() => crypto.createHmac('md5', 'key')).toThrow('Unsupported HMAC algorithm: md5');
  });
});
```

- [ ] **Step 2: Run tests — expect 2 failures**

```bash
npx jest __tests__/polyfills/crypto.test.js
```

Expected: `createHash('md5')` and `createHmac('md5', 'key')` tests fail — current code returns silent zeros instead of throwing.

- [ ] **Step 3: Fix createHash to throw on unsupported algorithms**

In `polyfills/crypto.js`, replace the `else` branch in `createHash`:

```js
  } else {
    throw new Error('Unsupported hash algorithm: ' + algorithm);
  }
```

- [ ] **Step 4: Fix createHmac to throw on unsupported algorithms**

In `polyfills/crypto.js`, replace the `else` branch in `createHmac`:

```js
  } else {
    throw new Error('Unsupported HMAC algorithm: ' + algorithm);
  }
```

- [ ] **Step 5: Fix randomBytes to throw when CSPRNG unavailable**

In `polyfills/crypto.js`, replace `randomBytes`:

```js
function randomBytes(size) {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new Error('No secure random number generator available');
  }
  var arr = new Uint8Array(size);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr);
}
```

Also fix `getRandomValues` at the bottom:

```js
  getRandomValues: function(arr) {
    if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
      throw new Error('No secure random number generator available');
    }
    return globalThis.crypto.getRandomValues(arr);
  },
```

- [ ] **Step 6: Run tests — all pass**

```bash
npx jest __tests__/polyfills/crypto.test.js
```

Expected: All 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add polyfills/crypto.js __tests__/polyfills/crypto.test.js
git commit -m "fix: crypto polyfill throws on missing CSPRNG and unsupported algorithms"
```

---

### Task 4: Replace BIP32 + Fix AccAddress Validate

**Files:**
- Modify: `polyfills/terra.js`
- Create: `__tests__/polyfills/terra-keys.test.js`

- [ ] **Step 1: Write key derivation parity tests**

Create `__tests__/polyfills/terra-keys.test.js`:

```js
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
    // Valid bech32 but wrong prefix
    expect(AccAddress.validate('cosmos1amdttz2937a3dytmxmkany53pp6ma6dyzr7hkl')).toBe(false);
  });

  test('rejects address with wrong data length', () => {
    // Encode a 10-byte payload instead of 20-byte — should fail
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
```

- [ ] **Step 2: Run tests — expect AccAddress wrong-length test to fail**

```bash
npx jest __tests__/polyfills/terra-keys.test.js
```

Expected: All tests pass EXCEPT "rejects address with wrong data length" — current `AccAddress.validate` only checks `decoded.words.length > 0`.

- [ ] **Step 3: Fix AccAddress.validate to check data length**

In `polyfills/terra.js`, replace `AccAddress.validate`:

```js
const AccAddress = {
  validate: function(addr) {
    try {
      if (typeof addr !== 'string') return false;
      const decoded = bech32.decode(addr);
      if (decoded.prefix !== 'terra') return false;
      const data = bech32.fromWords(decoded.words);
      return data.length === 20;
    } catch (e) {
      return false;
    }
  },
  fromValAddress: function(addr) {
    try {
      const decoded = bech32.decode(addr);
      return bech32.encode('terra', decoded.words);
    } catch (e) {
      return addr;
    }
  },
};
```

- [ ] **Step 4: Replace hand-rolled BIP32 with @scure/bip32**

In `polyfills/terra.js`:

1. Add require at the top (after existing requires):

```js
const { HDKey } = require('@scure/bip32');
```

2. Delete lines containing `HIGHEST_BIT`, `hmacSHA512`, `deriveChild`, and `fromSeed` functions (the entire BIP32 block, approximately lines 20–94).

3. Replace the `MnemonicKey` constructor body. Find:

```js
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const masterKey = fromSeed(seed);
    const hdPath = `m/44'/${coinType}'/${account}'/0/${index}`;
    const derived = masterKey.derivePath(hdPath);

    if (!derived.privateKey) {
      throw new Error('Failed to derive key pair');
    }

    super(derived.privateKey);
```

Replace with:

```js
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive(`m/44'/${coinType}'/${account}'/0/${index}`);

    if (!derived.privateKey) {
      throw new Error('Failed to derive key pair');
    }

    super(Buffer.from(derived.privateKey));
```

- [ ] **Step 5: Run tests — all pass**

```bash
npx jest __tests__/polyfills/terra-keys.test.js
```

Expected: All 18 tests pass. Key derivation produces identical results with @scure/bip32.

- [ ] **Step 6: Commit**

```bash
git add polyfills/terra.js __tests__/polyfills/terra-keys.test.js
git commit -m "fix: replace hand-rolled BIP32 with @scure/bip32, fix AccAddress.validate length check"
```

---

### Task 5: Fix Msg Serialization

**Files:**
- Modify: `polyfills/terra.js`
- Create: `__tests__/polyfills/terra-msgs.test.js`

- [ ] **Step 1: Write Msg serialization tests**

Create `__tests__/polyfills/terra-msgs.test.js`:

```js
const {
  MsgSend, MsgDelegate, MsgUndelegate, MsgBeginRedelegate,
  MsgWithdrawDelegatorReward, MsgExecuteContract, MsgSwap,
  MsgDeposit, Coin, Coins,
} = require('../../polyfills/terra');

describe('MsgSend', () => {
  const msg = new MsgSend(
    'terra1sender',
    'terra1recipient',
    new Coins([new Coin('uluna', '1000000')])
  );

  test('toProto returns correct @type and fields', () => {
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.bank.v1beta1.MsgSend');
    expect(proto.from_address).toBe('terra1sender');
    expect(proto.to_address).toBe('terra1recipient');
    expect(proto.amount).toEqual([{ denom: 'uluna', amount: '1000000' }]);
  });

  test('toAmino returns correct type and value', () => {
    const amino = msg.toAmino();
    expect(amino.type).toBe('cosmos-sdk/MsgSend');
    expect(amino.value.from_address).toBe('terra1sender');
    expect(amino.value.to_address).toBe('terra1recipient');
  });

  test('toData delegates to toProto', () => {
    expect(msg.toData()).toEqual(msg.toProto());
  });
});

describe('MsgDelegate', () => {
  const msg = new MsgDelegate(
    'terra1delegator',
    'terravaloper1validator',
    new Coin('uluna', '500000')
  );

  test('toProto returns correct @type', () => {
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.staking.v1beta1.MsgDelegate');
    expect(proto.delegator_address).toBe('terra1delegator');
    expect(proto.validator_address).toBe('terravaloper1validator');
    expect(proto.amount).toEqual({ denom: 'uluna', amount: '500000' });
  });

  test('toAmino returns correct type', () => {
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgDelegate');
  });
});

describe('MsgUndelegate', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgUndelegate('terra1d', 'terravaloper1v', new Coin('uluna', '100'));
    expect(msg.toProto()['@type']).toBe('/cosmos.staking.v1beta1.MsgUndelegate');
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgUndelegate');
  });
});

describe('MsgBeginRedelegate', () => {
  test('toProto has correct @type and fields', () => {
    const msg = new MsgBeginRedelegate('terra1d', 'terravaloper1src', 'terravaloper1dst', new Coin('uluna', '100'));
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmos.staking.v1beta1.MsgBeginRedelegate');
    expect(proto.validator_src_address).toBe('terravaloper1src');
    expect(proto.validator_dst_address).toBe('terravaloper1dst');
  });
});

describe('MsgWithdrawDelegatorReward', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgWithdrawDelegatorReward('terra1d', 'terravaloper1v');
    expect(msg.toProto()['@type']).toBe('/cosmos.distribution.v1beta1.MsgWithdrawDelegationReward');
    expect(msg.toAmino().type).toBe('cosmos-sdk/MsgWithdrawDelegationReward');
  });
});

describe('MsgExecuteContract', () => {
  test('toProto has correct @type and execute_msg', () => {
    const msg = new MsgExecuteContract('terra1s', 'terra1contract', { swap: {} });
    const proto = msg.toProto();
    expect(proto['@type']).toBe('/cosmwasm.wasm.v1.MsgExecuteContract');
    expect(proto.sender).toBe('terra1s');
    expect(proto.contract).toBe('terra1contract');
    expect(proto.msg).toEqual({ swap: {} });
  });

  test('toAmino has correct type', () => {
    const msg = new MsgExecuteContract('terra1s', 'terra1c', { swap: {} });
    expect(msg.toAmino().type).toBe('wasm/MsgExecuteContract');
  });
});

describe('MsgSwap', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgSwap('terra1t', new Coin('uusd', '1000'), 'uluna');
    expect(msg.toProto()['@type']).toBe('/terra.market.v1beta1.MsgSwap');
  });
});

describe('MsgDeposit', () => {
  test('toProto has correct @type', () => {
    const msg = new MsgDeposit(1, 'terra1d', new Coins([new Coin('uluna', '100')]));
    expect(msg.toProto()['@type']).toBe('/cosmos.gov.v1beta1.MsgDeposit');
  });
});
```

- [ ] **Step 2: Run tests — all Msg tests fail**

```bash
npx jest __tests__/polyfills/terra-msgs.test.js
```

Expected: All tests fail — current `toProto()` returns `{}`.

- [ ] **Step 3: Implement Msg serialization**

In `polyfills/terra.js`, replace the `Msg` base class and all subclasses:

```js
// --- Msg base ---
class Msg {
  static fromData(data) { return data; }
  static fromAmino(data) { return data; }
  static fromProto(data) { return data; }
  toData() { return this.toProto(); }
  // toAmino() and toProto() overridden by subclasses
}

// Helper: serialize a coin-like value
function serializeCoin(c) {
  if (c && typeof c.toProto === 'function') return c.toProto();
  if (c && typeof c.toData === 'function') return c.toData();
  return c;
}

function serializeCoins(c) {
  if (c && typeof c.toProto === 'function') return c.toProto();
  if (Array.isArray(c)) return c.map(serializeCoin);
  return c;
}

class MsgSend extends Msg {
  constructor(from_address, to_address, amount) {
    super();
    this.from_address = from_address;
    this.to_address = to_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.bank.v1beta1.MsgSend',
      from_address: this.from_address,
      to_address: this.to_address,
      amount: serializeCoins(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgSend',
      value: {
        from_address: this.from_address,
        to_address: this.to_address,
        amount: serializeCoins(this.amount),
      },
    };
  }
}

class MsgExecuteContract extends Msg {
  constructor(sender, contract, execute_msg, coins) {
    super();
    this.sender = sender;
    this.contract = contract;
    this.execute_msg = execute_msg;
    this.coins = coins || new Coins([]);
  }
  toProto() {
    return {
      '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
      sender: this.sender,
      contract: this.contract,
      msg: this.execute_msg,
      funds: serializeCoins(this.coins),
    };
  }
  toAmino() {
    return {
      type: 'wasm/MsgExecuteContract',
      value: {
        sender: this.sender,
        contract: this.contract,
        execute_msg: this.execute_msg,
        coins: serializeCoins(this.coins),
      },
    };
  }
}

class MsgSwap extends Msg {
  constructor(trader, offer_coin, ask_denom) {
    super();
    this.trader = trader;
    this.offer_coin = offer_coin;
    this.ask_denom = ask_denom;
  }
  toProto() {
    return {
      '@type': '/terra.market.v1beta1.MsgSwap',
      trader: this.trader,
      offer_coin: serializeCoin(this.offer_coin),
      ask_denom: this.ask_denom,
    };
  }
  toAmino() {
    return {
      type: 'market/MsgSwap',
      value: {
        trader: this.trader,
        offer_coin: serializeCoin(this.offer_coin),
        ask_denom: this.ask_denom,
      },
    };
  }
}

class MsgDeposit extends Msg {
  constructor(proposal_id, depositor, amount) {
    super();
    this.proposal_id = proposal_id;
    this.depositor = depositor;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.gov.v1beta1.MsgDeposit',
      proposal_id: this.proposal_id,
      depositor: this.depositor,
      amount: serializeCoins(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgDeposit',
      value: {
        proposal_id: this.proposal_id,
        depositor: this.depositor,
        amount: serializeCoins(this.amount),
      },
    };
  }
}

class MsgWithdrawDelegatorReward extends Msg {
  constructor(delegator_address, validator_address) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
  }
  toProto() {
    return {
      '@type': '/cosmos.distribution.v1beta1.MsgWithdrawDelegationReward',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgWithdrawDelegationReward',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
      },
    };
  }
}

class MsgDelegate extends Msg {
  constructor(delegator_address, validator_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgDelegate',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgDelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}

class MsgBeginRedelegate extends Msg {
  constructor(delegator_address, validator_src_address, validator_dst_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_src_address = validator_src_address;
    this.validator_dst_address = validator_dst_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgBeginRedelegate',
      delegator_address: this.delegator_address,
      validator_src_address: this.validator_src_address,
      validator_dst_address: this.validator_dst_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgBeginRedelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_src_address: this.validator_src_address,
        validator_dst_address: this.validator_dst_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}

class MsgUndelegate extends Msg {
  constructor(delegator_address, validator_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgUndelegate',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgUndelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx jest __tests__/polyfills/terra-msgs.test.js
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add polyfills/terra.js __tests__/polyfills/terra-msgs.test.js
git commit -m "fix: Msg types return structured proto/amino data with correct @type URLs"
```

---

### Task 6: Create LCD Client — Core Modules

**Files:**
- Create: `polyfills/terra-lcd.js`

This task creates the fetch-based LCD client with the modules needed for wallet functionality: auth, bank, and tx.

- [ ] **Step 1: Create `polyfills/terra-lcd.js` with auth, bank, tx modules**

```js
// Fetch-based LCD client for Cosmos REST endpoints.
// Replaces terra.js LCDClient stubs with real HTTP requests.
//
// Rate limiting: not implemented. ~20+ queries may fire on startup.
// No rate limiting observed on PublicNode or Polkachu, but not guaranteed.

const { Coin, Coins, Fee, Tx, TxInfo } = require('./terra');

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LCD request failed: ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LCD request failed: ${res.status} ${res.statusText} — ${url}\n${text}`);
  }
  return res.json();
}

function parseCoins(coinArray) {
  if (!coinArray || !Array.isArray(coinArray)) return new Coins([]);
  return new Coins(coinArray.map(c => new Coin(c.denom, c.amount)));
}

function createLCD(baseURL) {
  // Strip trailing slash
  const base = baseURL.replace(/\/$/, '');

  const auth = {
    accountInfo: async function(address) {
      const data = await fetchJSON(`${base}/cosmos/auth/v1beta1/accounts/${address}`);
      const acct = data.account || {};
      // Handle vesting accounts which nest the base_account
      const baseAcct = acct.base_account || acct;
      return {
        address: baseAcct.address || address,
        account_number: parseInt(baseAcct.account_number || '0', 10),
        sequence: parseInt(baseAcct.sequence || '0', 10),
        getAccountNumber: function() { return this.account_number; },
        getSequenceNumber: function() { return this.sequence; },
      };
    },
  };

  const bank = {
    balance: async function(address) {
      const data = await fetchJSON(`${base}/cosmos/bank/v1beta1/balances/${address}`);
      const coins = parseCoins(data.balances);
      const pagination = data.pagination || {};
      return [coins, pagination];
    },
    total: async function() {
      const data = await fetchJSON(`${base}/cosmos/bank/v1beta1/supply`);
      return parseCoins(data.supply);
    },
  };

  const tx = {
    create: async function(signers, options) {
      // Simulation-based tx creation for gas estimation
      return new Tx();
    },
    estimateFee: async function(signers, options) {
      // Simulation-based fee estimation
      const msgs = (options.msgs || []).map(m =>
        typeof m.toProto === 'function' ? m.toProto() : m
      );
      const body = {
        tx_bytes: '',
        mode: 'BROADCAST_MODE_UNSPECIFIED',
      };
      try {
        const data = await postJSON(`${base}/cosmos/tx/v1beta1/simulate`, {
          tx: {
            body: { messages: msgs, memo: options.memo || '' },
            auth_info: {
              signer_infos: [],
              fee: { amount: [], gas_limit: '0' },
            },
            signatures: [''],
          },
        });
        const gasUsed = parseInt(data.gas_info?.gas_used || '200000', 10);
        const gasLimit = Math.ceil(gasUsed * (options.gasAdjustment || 1.4));
        return new Fee(gasLimit, [new Coin('uluna', String(Math.ceil(gasLimit * 0.015)))]);
      } catch (e) {
        return new Fee(200000, [new Coin('uluna', '3000')]);
      }
    },
    broadcastSync: async function(txBytes) {
      const data = await postJSON(`${base}/cosmos/tx/v1beta1/txs`, {
        tx_bytes: txBytes,
        mode: 'BROADCAST_MODE_SYNC',
      });
      const resp = data.tx_response || {};
      return { txhash: resp.txhash || '', raw_log: resp.raw_log || '' };
    },
    broadcast: async function(txBytes) {
      const data = await postJSON(`${base}/cosmos/tx/v1beta1/txs`, {
        tx_bytes: txBytes,
        mode: 'BROADCAST_MODE_BLOCK',
      });
      const resp = data.tx_response || {};
      return { txhash: resp.txhash || '', raw_log: resp.raw_log || '' };
    },
    txInfo: async function(hash) {
      const data = await fetchJSON(`${base}/cosmos/tx/v1beta1/txs/${hash}`);
      return new TxInfo(data.tx_response || data);
    },
    txsByEvents: async function(events, params) {
      const query = new URLSearchParams();
      if (Array.isArray(events)) {
        events.forEach(e => query.append('events', e));
      } else if (typeof events === 'string') {
        query.append('events', events);
      }
      if (params) {
        if (params.order_by) query.set('order_by', params.order_by);
        if (params['pagination.limit']) query.set('pagination.limit', params['pagination.limit']);
        if (params['pagination.offset']) query.set('pagination.offset', params['pagination.offset']);
        if (params['pagination.key']) query.set('pagination.key', params['pagination.key']);
      }
      const data = await fetchJSON(`${base}/cosmos/tx/v1beta1/txs?${query.toString()}`);
      return {
        txs: data.txs || [],
        tx_responses: (data.tx_responses || []).map(r => new TxInfo(r)),
        pagination: data.pagination || {},
      };
    },
  };

  return { auth, bank, tx };
}

module.exports = createLCD;
```

- [ ] **Step 2: Verify file loads without syntax errors**

```bash
node -e "const createLCD = require('./polyfills/terra-lcd'); console.log(typeof createLCD);"
```

Expected: `function`

- [ ] **Step 3: Smoke test against real endpoint**

```bash
node -e "
const createLCD = require('./polyfills/terra-lcd');
const lcd = createLCD('https://terra-rest.publicnode.com');
lcd.auth.accountInfo('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv')
  .then(info => console.log('account_number:', info.account_number, 'sequence:', info.sequence))
  .catch(err => console.error('ERROR:', err.message));
"
```

Expected: Prints `account_number: <number> sequence: <number>` (may be 0 if account is unfunded, but no error).

```bash
node -e "
const createLCD = require('./polyfills/terra-lcd');
const lcd = createLCD('https://terra-rest.publicnode.com');
lcd.bank.balance('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv')
  .then(([coins, pg]) => console.log('balances:', JSON.stringify(coins.toData())))
  .catch(err => console.error('ERROR:', err.message));
"
```

Expected: Prints balance array (possibly empty if unfunded).

- [ ] **Step 4: Commit**

```bash
git add polyfills/terra-lcd.js
git commit -m "feat: fetch-based LCD client with auth, bank, and tx modules"
```

---

### Task 7: LCD Client — Remaining Modules

**Files:**
- Modify: `polyfills/terra-lcd.js`

Add staking, distribution, oracle, ibc, and market modules to the LCD client.

- [ ] **Step 1: Add staking, distribution, oracle, ibc, market modules**

In `polyfills/terra-lcd.js`, add these module objects inside `createLCD()` before the `return` statement:

```js
  const staking = {
    validators: async function(status) {
      const query = status ? `?status=${status}` : '';
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/validators${query}`);
      return [data.validators || [], data.pagination || {}];
    },
    validator: async function(addr) {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/validators/${addr}`);
      return data.validator || {};
    },
    delegations: async function(delegator) {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/delegations/${delegator}`);
      const delegations = (data.delegation_responses || []).map(d => ({
        delegation: d.delegation,
        balance: d.balance ? new Coin(d.balance.denom, d.balance.amount) : new Coin('uluna', '0'),
      }));
      return [delegations, data.pagination || {}];
    },
    delegation: async function(delegator, validator) {
      try {
        const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/validators/${validator}/delegations/${delegator}`);
        const d = data.delegation_response || {};
        return {
          delegation: d.delegation,
          balance: d.balance ? new Coin(d.balance.denom, d.balance.amount) : new Coin('uluna', '0'),
        };
      } catch (e) {
        return null;
      }
    },
    unbondingDelegations: async function(delegator) {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/delegators/${delegator}/unbonding_delegations`);
      return [data.unbonding_responses || [], data.pagination || {}];
    },
    pool: async function() {
      const data = await fetchJSON(`${base}/cosmos/staking/v1beta1/pool`);
      return data.pool || {};
    },
  };

  const distribution = {
    rewards: async function(delegator) {
      const data = await fetchJSON(`${base}/cosmos/distribution/v1beta1/delegators/${delegator}/rewards`);
      const total = parseCoins(data.total);
      const rewards = {};
      (data.rewards || []).forEach(r => {
        rewards[r.validator_address] = parseCoins(r.reward);
      });
      return { total, rewards };
    },
    communityPool: async function() {
      const data = await fetchJSON(`${base}/cosmos/distribution/v1beta1/community_pool`);
      return parseCoins(data.pool);
    },
    validatorCommission: async function(validator) {
      const data = await fetchJSON(`${base}/cosmos/distribution/v1beta1/validators/${validator}/commission`);
      return data.commission || {};
    },
    withdrawAddress: async function(delegator) {
      const data = await fetchJSON(`${base}/cosmos/distribution/v1beta1/delegators/${delegator}/withdraw_address`);
      return data.withdraw_address || '';
    },
  };

  const oracle = {
    activeDenoms: async function() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/denoms/actives`);
        return data.actives || [];
      } catch (e) {
        return [];
      }
    },
    exchangeRates: async function() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/denoms/exchange_rates`);
        return parseCoins(data.exchange_rates);
      } catch (e) {
        return new Coins([]);
      }
    },
    parameters: async function() {
      try {
        const data = await fetchJSON(`${base}/terra/oracle/v1beta1/params`);
        return data.params || {};
      } catch (e) {
        return {};
      }
    },
  };

  const market = {
    swapRate: async function(offerCoin, askDenom) {
      try {
        const data = await fetchJSON(
          `${base}/terra/market/v1beta1/swap?offer_coin=${offerCoin.amount}${offerCoin.denom}&ask_denom=${askDenom}`
        );
        return data.return_coin ? new Coin(data.return_coin.denom, data.return_coin.amount) : new Coin(askDenom, '0');
      } catch (e) {
        return new Coin(askDenom, '0');
      }
    },
  };

  const ibc = {
    denomTrace: async function(hash) {
      const data = await fetchJSON(`${base}/ibc/apps/transfer/v1beta1/denom_traces/${hash}`);
      return { denom_trace: data.denom_trace || { path: '', base_denom: '' } };
    },
  };
```

Update the return statement to include all modules:

```js
  return { auth, bank, tx, staking, distribution, oracle, market, ibc };
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "
const createLCD = require('./polyfills/terra-lcd');
const lcd = createLCD('https://terra-rest.publicnode.com');
console.log('modules:', Object.keys(lcd).join(', '));
"
```

Expected: `modules: auth, bank, tx, staking, distribution, oracle, market, ibc`

- [ ] **Step 3: Commit**

```bash
git add polyfills/terra-lcd.js
git commit -m "feat: add staking, distribution, oracle, market, ibc modules to LCD client"
```

---

### Task 8: Wire LCDClient + Wallet + Cleanup

**Files:**
- Modify: `polyfills/terra.js`
- Modify: `shim.js`

- [ ] **Step 1: Wire LCDClient to terra-lcd.js**

In `polyfills/terra.js`, add require at the top:

```js
const createLCD = require('./terra-lcd');
```

Replace the `LCDClient` class:

```js
class LCDClient {
  constructor(config) {
    this.config = config;
    this.chainID = config?.chainID || 'phoenix-1';
    this.URL = config?.URL || '';
    var lcd = createLCD(this.URL);
    this._auth = lcd.auth;
    this._bank = lcd.bank;
    this._staking = lcd.staking;
    this._distribution = lcd.distribution;
    this._oracle = lcd.oracle;
    this._market = lcd.market;
    this._tx = lcd.tx;
    this._ibc = lcd.ibc;
  }
  wallet(key) {
    return new Wallet(this, key);
  }
  get auth() { return this._auth; }
  get bank() { return this._bank; }
  get staking() { return this._staking; }
  get distribution() { return this._distribution; }
  get oracle() { return this._oracle; }
  get market() { return this._market; }
  get tx() { return this._tx; }
  get ibc() { return this._ibc; }
}
```

- [ ] **Step 2: Wire Wallet to LCD auth**

In `polyfills/terra.js`, replace the `Wallet` class:

```js
class Wallet {
  constructor(lcd, key) {
    this.lcd = lcd;
    this.key = key;
  }
  async accountNumberAndSequence() {
    var info = await this.lcd.auth.accountInfo(this.key.accAddress);
    return {
      account_number: info.account_number,
      sequence: info.sequence,
    };
  }
  async sequence() {
    var result = await this.accountNumberAndSequence();
    return result.sequence;
  }
  async createAndSignTx() {
    throw new Error('createAndSignTx requires full terra.js — use WebView signing flow');
  }
}
```

- [ ] **Step 3: Add explanatory comment to shim.js**

In `shim.js`, add comment before `process.browser = false`:

```js
// Must be false — node-forge, pbkdf2, and other deps check this to select
// Node.js-compatible code paths (nextTick, native crypto, binary encoding).
// Setting to true or removing breaks crypto operations.
process.browser = false
```

- [ ] **Step 4: Smoke test end-to-end**

```bash
node -e "
const { LCDClient } = require('./polyfills/terra');
const lcd = new LCDClient({ chainID: 'phoenix-1', URL: 'https://terra-rest.publicnode.com' });
lcd.bank.balance('terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v')
  .then(([coins]) => console.log('balance:', JSON.stringify(coins.toData())))
  .catch(err => console.error('ERROR:', err.message));
"
```

Expected: Prints balance data or empty array. No error.

- [ ] **Step 5: Commit**

```bash
git add polyfills/terra.js shim.js
git commit -m "feat: wire LCDClient and Wallet to real LCD endpoints, add shim.js comment"
```

---

## Phase 2: Crypto Parity Verification

### Task 9: Detox Infrastructure

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Create: `.detoxrc.js`
- Create: `e2e/jest.config.js`

- [ ] **Step 1: Install Detox dependencies**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
npm install --save-dev detox @config-plugins/detox
```

- [ ] **Step 2: Add Detox config plugin to app.json**

In `app.json`, add `"@config-plugins/detox"` to the plugins array:

```json
"plugins": [
  "expo-secure-store",
  "expo-camera",
  "expo-local-authentication",
  "@config-plugins/detox"
]
```

- [ ] **Step 3: Add e2e scripts to package.json**

In `package.json`, add to scripts:

```json
"e2e:build": "detox build --configuration ios.sim.debug",
"e2e:test": "detox test --configuration ios.sim.debug"
```

- [ ] **Step 4: Create `.detoxrc.js`**

```js
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/TerraStation.app',
      build: 'xcodebuild -workspace ios/TerraStation.xcworkspace -scheme TerraStation -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
```

- [ ] **Step 5: Create `e2e/jest.config.js`**

```js
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json .detoxrc.js e2e/jest.config.js
git commit -m "chore: add Detox E2E testing infrastructure"
```

---

### Task 10: CryptoTestScreen + Parity Tests

**Files:**
- Create: `src/components/CryptoTestScreen.tsx`
- Modify: `src/navigatoin/index.tsx`
- Create: `e2e/crypto-parity.test.js`

- [ ] **Step 1: Create CryptoTestScreen**

Create `src/components/CryptoTestScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import {
  MnemonicKey,
  RawKey,
  AccAddress,
  ValAddress,
} from '@terra-money/terra.js'

const MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const MNEMONIC_2 =
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
const PRIVKEY_1 =
  '05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10'

// Polyfilled crypto module
const crypto = require('crypto')

type Result = Record<string, string>

function runTests(): Result {
  const r: Result = {}

  try {
    // MnemonicKey — mnemonic 1
    const mk330 = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 330 })
    r['mk330-address'] = mk330.accAddress
    r['mk330-privkey'] = mk330.privateKey.toString('hex')
    r['mk330-pubkey'] = mk330.publicKey?.key || ''

    const mk118 = new MnemonicKey({ mnemonic: MNEMONIC_1, coinType: 118 })
    r['mk118-address'] = mk118.accAddress
    r['mk118-privkey'] = mk118.privateKey.toString('hex')
    r['mk118-pubkey'] = mk118.publicKey?.key || ''

    // MnemonicKey — mnemonic 2
    const mk2_330 = new MnemonicKey({ mnemonic: MNEMONIC_2, coinType: 330 })
    r['mk2-330-address'] = mk2_330.accAddress
    r['mk2-330-privkey'] = mk2_330.privateKey.toString('hex')

    const mk2_118 = new MnemonicKey({ mnemonic: MNEMONIC_2, coinType: 118 })
    r['mk2-118-address'] = mk2_118.accAddress

    const mk2_custom = new MnemonicKey({
      mnemonic: MNEMONIC_2,
      coinType: 330,
      account: 1,
      index: 2,
    })
    r['mk2-custom-address'] = mk2_custom.accAddress
    r['mk2-custom-privkey'] = mk2_custom.privateKey.toString('hex')

    // RawKey
    const rk = new RawKey(Buffer.from(PRIVKEY_1, 'hex'))
    r['rawkey-address'] = rk.accAddress
    r['rawkey-pubkey'] = rk.publicKey?.key || ''

    const sig = rk.ecdsaSign(Buffer.from('test message to sign'))
    r['sign-payload'] = Buffer.from(sig.signature).toString('hex')
    r['ecdsa-recid'] = String(sig.recid)

    // Address validation
    r['validate-valid'] = String(AccAddress.validate('terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv'))
    r['validate-invalid'] = String(AccAddress.validate('notanaddress'))
    r['validate-wrong-prefix'] = String(
      AccAddress.validate('cosmos1amdttz2937a3dytmxmkany53pp6ma6dyzr7hkl')
    )
    r['valaddress-valid'] = String(ValAddress.validate(mk330.valAddress))
    r['fromval'] = AccAddress.fromValAddress(mk330.valAddress)

    // Mnemonic generation
    const genMk = new MnemonicKey()
    r['gen-wordcount'] = String(genMk.mnemonic.split(' ').length)
    r['gen-has-address'] = String(genMk.accAddress.startsWith('terra'))
    r['gen-privkey-length'] = String(genMk.privateKey.length)

    // Hashing
    r['hash-sha256'] = crypto
      .createHash('sha256')
      .update('hello world')
      .digest('hex')
    r['hash-sha512'] = crypto
      .createHash('sha512')
      .update('hello world')
      .digest('hex')
    r['hash-ripemd160'] = crypto
      .createHash('ripemd160')
      .update('hello world')
      .digest('hex')
    r['hmac-sha256'] = crypto
      .createHmac('sha256', 'secret-key')
      .update('hello world')
      .digest('hex')

    let hashThrew = false
    try {
      crypto.createHash('md5')
    } catch {
      hashThrew = true
    }
    r['hash-unsupported-throws'] = String(hashThrew)

    // randomBytes
    const rb = crypto.randomBytes(32)
    r['random-not-zero'] = String(!rb.every((b: number) => b === 0))
    r['random-length'] = String(rb.length)
    const rb2 = crypto.randomBytes(32)
    r['random-unique'] = String(!rb.equals(rb2))
  } catch (e: any) {
    r['_error'] = e.message || String(e)
  }

  return r
}

export default function CryptoTestScreen() {
  const [results, setResults] = useState<Result>({})

  useEffect(() => {
    setResults(runTests())
  }, [])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <Text style={{ color: '#0f0', fontSize: 18, marginBottom: 12 }}>
        Crypto Parity Results
      </Text>
      {Object.entries(results).map(([id, value]) => (
        <View key={id} style={{ marginBottom: 4 }}>
          <Text testID={id} style={{ color: '#fff', fontSize: 12 }}>
            {value}
          </Text>
          <Text style={{ color: '#888', fontSize: 10 }}>{id}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
```

- [ ] **Step 2: Wire CryptoTestScreen into navigator for dev mode**

In `src/navigatoin/index.tsx`, add the import and render it in `__DEV__` mode inside the `NavigationContainer`:

```tsx
import CryptoTestScreen from '../components/CryptoTestScreen'

// Inside the NavigationContainer, replace <></> with:
{__DEV__ ? <CryptoTestScreen /> : <></>}
```

- [ ] **Step 3: Create Detox parity test file**

Create `e2e/crypto-parity.test.js`:

```js
describe('Crypto Parity', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  // MnemonicKey — mnemonic 1
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

  // MnemonicKey — mnemonic 2
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

  // RawKey + signing
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

  // Address validation
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

  // Mnemonic generation
  it('generates 24-word mnemonic', async () => {
    await expect(element(by.id('gen-wordcount'))).toHaveText('24');
  });
  it('generated key has terra address', async () => {
    await expect(element(by.id('gen-has-address'))).toHaveText('true');
  });
  it('private key is 32 bytes', async () => {
    await expect(element(by.id('gen-privkey-length'))).toHaveText('32');
  });

  // Hashing
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

  // randomBytes
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
```

- [ ] **Step 4: Build and run Detox tests**

```bash
npx expo prebuild --no-install --platform ios
cd ios && pod install && cd ..
npm run e2e:build
npm run e2e:test
```

Expected: All 33 assertions pass. If any fail, fix the relevant polyfill and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/components/CryptoTestScreen.tsx src/navigatoin/index.tsx e2e/crypto-parity.test.js
git commit -m "test: add Detox crypto parity tests with CryptoTestScreen"
```

---

## Phase 3: Native UI + Auth Screens

### Task 11: Rename `navigatoin` → `navigation`

**Files:**
- Rename: `src/navigatoin/` → `src/navigation/`
- Modify: `src/App/index.tsx` (import path)

- [ ] **Step 1: Rename directory**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
git mv src/navigatoin src/navigation
```

- [ ] **Step 2: Update import in App/index.tsx**

In `src/App/index.tsx`, change:

```ts
import AppNavigator from '../navigatoin'
```

to:

```ts
import AppNavigator from '../navigation'
```

- [ ] **Step 3: Search for any other imports referencing `navigatoin`**

```bash
grep -r "navigatoin" src/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining references.

- [ ] **Step 4: Verify app starts**

```bash
npx expo start --clear
```

Expected: No import resolution errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: fix navigatoin directory typo to navigation"
```

---

### Task 12: Consolidate useLCD + Install QR Dependencies

**Files:**
- Modify: `src/hooks/useLCD.ts`
- Delete: `src/lib/api/useLCD.ts` (after consolidation)
- Modify: `package.json`

- [ ] **Step 1: Install QR code dependencies**

```bash
npm install react-native-qrcode-svg react-native-svg
```

- [ ] **Step 2: Merge isClassic into primary useLCD hook**

Replace `src/hooks/useLCD.ts`:

```ts
import { LCDClient } from '@terra-money/terra.js'
import { useMemo } from 'react'
import { useConfig, useIsClassic } from 'lib'
import useGasPrices from './useGasPrices'

const useLCD = (): LCDClient => {
  const { chain } = useConfig()
  const { gasPrices } = useGasPrices()
  const isClassic = useIsClassic()
  const { chainID, lcd: URL } = chain.current

  const lcd = useMemo(
    () =>
      new LCDClient({
        chainID,
        URL,
        gasPrices,
        isClassic,
      }),
    [chainID, URL, gasPrices, isClassic]
  )
  return lcd
}

export default useLCD
```

- [ ] **Step 3: Update imports that used the lib/api version**

```bash
grep -r "lib/api/useLCD" src/ --include="*.ts" --include="*.tsx" -l
```

For each file found, change `import useLCD from 'lib/api/useLCD'` to `import useLCD from 'hooks/useLCD'`.

- [ ] **Step 4: Delete the redundant hook**

```bash
rm src/lib/api/useLCD.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: consolidate useLCD hooks, install QR deps"
```

---

### Task 13: WalletHome Screen

**Files:**
- Create: `src/screens/WalletHome.tsx`

- [ ] **Step 1: Create WalletHome screen**

Create `src/screens/WalletHome.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { NavigationProp, useNavigation } from '@react-navigation/native'

import useLCD from 'hooks/useLCD'
import { getWallets } from 'utils/wallet'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'
import Loading from 'components/Loading'

type MainStackParams = {
  WalletHome: undefined
  Receive: { address: string }
  History: { address: string }
}

export default function WalletHome() {
  const { t } = useTranslation()
  const lcd = useLCD()
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const [wallet, setWallet] = useState<{ name: string; address: string } | null>(null)

  useEffect(() => {
    getWallets().then((wallets) => {
      if (wallets.length > 0) {
        setWallet({ name: wallets[0].name, address: wallets[0].address })
      }
    })
  }, [])

  const {
    data: balance,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery(
    ['balance', wallet?.address],
    async () => {
      if (!wallet) return '0'
      const [coins] = await lcd.bank.balance(wallet.address)
      const luna = coins.get('uluna')
      return luna ? UTIL.demicrofy(luna.amount) : '0'
    },
    { enabled: !!wallet }
  )

  const copyAddress = useCallback(async () => {
    if (wallet) {
      await Clipboard.setStringAsync(wallet.address)
    }
  }, [wallet])

  if (!wallet) return <Loading />

  const truncated = UTIL.truncate(wallet.address, [10, 6])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
      }
    >
      <Text style={styles.walletName}>{wallet.name}</Text>
      <TouchableOpacity onPress={copyAddress}>
        <Text style={styles.address}>{truncated}</Text>
      </TouchableOpacity>

      <View style={styles.balanceCard}>
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <Text style={styles.balanceLabel}>LUNA</Text>
            <Text style={styles.balanceAmount}>{balance || '0'}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title={t('Wallet:Receive')}
          onPress={() => navigation.navigate('Receive', { address: wallet.address })}
          style={styles.actionButton}
        />
        <Button
          title={t('Wallet:History')}
          onPress={() => navigation.navigate('History', { address: wallet.address })}
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  walletName: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginTop: 24 },
  address: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  balanceCard: {
    backgroundColor: '#061B3A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: { color: '#8295AE', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#F0F4FC', fontSize: 32, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 16, width: '100%' },
  actionButton: { flex: 1 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/WalletHome.tsx
git commit -m "feat: add WalletHome screen with balance display"
```

---

### Task 14: Receive Screen

**Files:**
- Create: `src/screens/Receive.tsx`

- [ ] **Step 1: Create Receive screen**

Create `src/screens/Receive.tsx`:

```tsx
import React, { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import Text from 'components/Text'
import Button from 'components/Button'

type RouteParams = { Receive: { address: string } }

export default function Receive() {
  const { t } = useTranslation()
  const { params } = useRoute<RouteProp<RouteParams, 'Receive'>>()
  const { address } = params

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(address)
  }, [address])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Wallet:Receive')}</Text>

      <View style={styles.qrContainer}>
        <QRCode value={address} size={200} backgroundColor="#061B3A" color="#F0F4FC" />
      </View>

      <Text style={styles.address} selectable>
        {address}
      </Text>

      <Button title={t('Common:Copy')} onPress={copyAddress} style={styles.copyButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02122B',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginBottom: 32 },
  qrContainer: {
    backgroundColor: '#061B3A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  address: {
    color: '#8295AE',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  copyButton: { width: '100%' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/Receive.tsx
git commit -m "feat: add Receive screen with QR code"
```

---

### Task 15: History Screen

**Files:**
- Create: `src/screens/History.tsx`

- [ ] **Step 1: Create History screen**

Create `src/screens/History.tsx`:

```tsx
import React, { useCallback, useState } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native'
import { useQuery } from 'react-query'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import useLCD from 'hooks/useLCD'
import { useConfig } from 'lib'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Loading from 'components/Loading'

type RouteParams = { History: { address: string } }

const PAGE_SIZE = 20

export default function History() {
  const { t } = useTranslation()
  const { params } = useRoute<RouteProp<RouteParams, 'History'>>()
  const { address } = params
  const lcd = useLCD()
  const { chain } = useConfig()
  const [offset, setOffset] = useState(0)

  const { data, isLoading, refetch, isRefetching } = useQuery(
    ['tx-history', address, offset],
    async () => {
      const result = await lcd.tx.txsByEvents(
        `message.sender='${address}'`,
        {
          order_by: 'ORDER_BY_DESC',
          'pagination.limit': String(PAGE_SIZE),
          'pagination.offset': String(offset),
        }
      )
      return result
    },
    { keepPreviousData: true }
  )

  const openExplorer = useCallback(
    (hash: string) => {
      const chainID = chain.current.chainID
      const url = `https://chainsco.pe/terra2/tx/${hash}`
      Linking.openURL(url)
    },
    [chain]
  )

  const getMsgType = (tx: any): string => {
    try {
      const msgs = tx.body?.messages || tx.tx?.body?.messages || []
      if (msgs.length === 0) return 'Unknown'
      const type = msgs[0]['@type'] || ''
      return type.split('.').pop()?.replace('Msg', '') || 'Unknown'
    } catch {
      return 'Unknown'
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const hash = item.txhash || ''
    const success = !item.code || item.code === 0
    const timestamp = item.timestamp || ''
    const msgType = getMsgType(item)

    return (
      <TouchableOpacity style={styles.row} onPress={() => openExplorer(hash)}>
        <View style={styles.rowLeft}>
          <Text style={styles.msgType}>{msgType}</Text>
          <Text style={styles.date}>{timestamp}</Text>
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.badge, success ? styles.badgeSuccess : styles.badgeFail]}>
            <Text style={styles.badgeText}>{success ? 'OK' : 'FAIL'}</Text>
          </View>
          <Text style={styles.hash}>{UTIL.truncate(hash, [6, 4])}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const txResponses = data?.tx_responses || []
  const hasMore = txResponses.length === PAGE_SIZE

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Wallet:History')}</Text>
      {isLoading ? (
        <Loading />
      ) : txResponses.length === 0 ? (
        <Text style={styles.empty}>{t('Wallet:NoTransactions')}</Text>
      ) : (
        <FlatList
          data={txResponses}
          keyExtractor={(item: any) => item.txhash}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => setOffset((o) => o + PAGE_SIZE)}
              >
                <Text style={styles.loadMoreText}>{t('Common:LoadMore')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', padding: 16 },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginBottom: 16 },
  empty: { color: '#8295AE', fontSize: 16, textAlign: 'center', marginTop: 48 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  msgType: { color: '#F0F4FC', fontSize: 14, fontWeight: '600' },
  date: { color: '#8295AE', fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  badgeSuccess: { backgroundColor: '#18D2C3' },
  badgeFail: { backgroundColor: '#FF5C5C' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  hash: { color: '#8295AE', fontSize: 12 },
  loadMore: { alignItems: 'center', padding: 16 },
  loadMoreText: { color: '#0B4EFF', fontSize: 14 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/History.tsx
git commit -m "feat: add History screen with transaction list"
```

---

### Task 16: Restore Auth Screens from Git History

**Files:**
- Restore: 11 files under `src/screens/auth/`
- Modify: `src/navigation/AuthNavigator.tsx`

- [ ] **Step 1: Restore auth screen files from commit fd39a64**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
git checkout fd39a64 -- \
  src/screens/auth/AuthMenu.tsx \
  src/screens/auth/NewWallet/Step1.tsx \
  src/screens/auth/NewWallet/Step2.tsx \
  src/screens/auth/NewWallet/Step3.tsx \
  src/screens/auth/NewWallet/WalletCreated.tsx \
  src/screens/auth/RecoverWallet/Step1.tsx \
  src/screens/auth/RecoverWallet/Step2QR.tsx \
  src/screens/auth/RecoverWallet/Step2Seed.tsx \
  src/screens/auth/RecoverWallet/Step3Seed.tsx \
  src/screens/auth/RecoverWallet/Step4Seed.tsx \
  src/screens/auth/RecoverWallet/WalletRecovered.tsx
```

- [ ] **Step 2: Verify restored files compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Look for errors in the restored files. Common issues to fix:
- Import paths that reference deleted modules
- References to components that no longer exist
- `TerraWallet` import — should work since `src/nativeModules/terraWallet.ts` still exists as a pure JS module

- [ ] **Step 3: Fix any compilation errors in restored screens**

Address each TypeScript error found in Step 2. The restored screens use native RN components (View, Text, TextInput, TouchableOpacity) directly, so component dependencies should be minimal. Likely fixes:
- Update any path imports that changed
- Remove references to `ConnectLedger` screens (out of scope)

- [ ] **Step 4: Simplify AuthNavigator**

In `src/navigation/AuthNavigator.tsx`, remove routes for `SelectWallet`, `ConnectLedger`, and `WalletConnectDisconnected` (out of scope). Keep only:

```tsx
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'

const Stack = createStackNavigator()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthMenu" component={AuthMenu} />
      <Stack.Screen name="NewWallet" component={NewWalletStack} />
      <Stack.Screen name="RecoverWallet" component={RecoverWalletStack} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 5: Verify auth flow compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "screens/auth\|AuthNavigator\|WalletStack"
```

Expected: No errors from auth-related files.

- [ ] **Step 6: Commit**

```bash
git add src/screens/auth/ src/navigation/AuthNavigator.tsx
git commit -m "feat: restore auth screens from git history and simplify AuthNavigator"
```

---

### Task 17: Wire App Routing + WebView Removal

**Files:**
- Create: `src/navigation/MainNavigator.tsx`
- Modify: `src/navigation/index.tsx`
- Modify: `src/App/index.tsx`

- [ ] **Step 1: Create MainNavigator**

Create `src/navigation/MainNavigator.tsx`:

```tsx
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletHome from '../screens/WalletHome'
import Receive from '../screens/Receive'
import History from '../screens/History'

export type MainStackParams = {
  WalletHome: undefined
  Receive: { address: string }
  History: { address: string }
}

const Stack = createStackNavigator<MainStackParams>()

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletHome" component={WalletHome} />
      <Stack.Screen name="Receive" component={Receive} />
      <Stack.Screen name="History" component={History} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Rewrite navigation index to route based on wallet state**

Replace `src/navigation/index.tsx` with:

```tsx
import React, { useEffect, useState } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { useRecoilValue } from 'recoil'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import { getWallets } from 'utils/wallet'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'

// Dev-only crypto test screen
const CryptoTestScreen = __DEV__
  ? require('../components/CryptoTestScreen').default
  : null

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  useEffect(() => {
    getWallets().then((wallets) => {
      setHasWallet(wallets.length > 0)
    })
  }, [])

  // Check for crypto test deep link in dev
  const [showCryptoTest, setShowCryptoTest] = useState(false)

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || '#02122B',
    },
  }

  const linking = {
    prefixes: ['terrastation://'],
    config: {
      screens: {
        ...(CryptoTestScreen ? { CryptoTest: 'crypto-test' } : {}),
      },
    },
  }

  if (hasWallet === null) return null // Still loading

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      {__DEV__ && showCryptoTest && CryptoTestScreen ? (
        <CryptoTestScreen />
      ) : hasWallet ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  )
}
```

- [ ] **Step 3: Update App/index.tsx — remove WebView, wire new routing**

In `src/App/index.tsx`, make these changes:

1. Remove imports:
```ts
// Remove these:
import { RN_APIS, WebViewContainer } from './WebViewContainer'
import UnderMaintenance from './UnderMaintenance'
import AppStore from 'stores/AppStore'
```

2. Remove Recoil atom usage inside the `App` component:
```ts
// Remove these lines:
const webviewComponentLoaded = useRecoilValue(AppStore.webviewComponentLoaded)
const webviewInstance = useRecoilValue(AppStore.webviewInstance)
```

3. Remove the `isVisibleModal` state, `onRead` callback, and `onlyIfScan` function (QR scanning was WebView-specific).

4. Replace the render tree. Remove the `<>` block containing `WebViewContainer`, `UnderMaintenance`, `DebugBanner`, and the QR `Modal`. Replace with just `AppNavigator`:

```tsx
) : (
  <AppNavigator />
)}
```

5. Simplify the `SafeAreaView` background color — remove references to `webviewComponentLoaded`:

```tsx
backgroundColor: showOnBoarding ? '#fff' : themes?.[currentTheme]?.backgroundColor || '#02122B',
```

- [ ] **Step 4: Verify app compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 5: Test the app end-to-end**

```bash
npx expo start --clear
```

Press `i` to launch iOS simulator.

Expected behavior:
- **First run (no wallet):** OnBoarding → AuthMenu with "Create" and "Recover" buttons
- **After creating wallet:** WalletHome with balance, Receive and History buttons
- **Pull-to-refresh:** Balance refetches from LCD
- **Receive screen:** Shows QR code and full address
- **History screen:** Shows transaction list (may be empty for new wallet)

- [ ] **Step 6: Commit**

```bash
git add src/navigation/ src/App/index.tsx
git commit -m "feat: replace WebView with native wallet screens and auth flow routing"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npx jest __tests__/polyfills/` — all Node.js crypto tests pass
- [ ] `npm run e2e:test` — all 33 Detox parity tests pass (if simulator available)
- [ ] App launches to OnBoarding on fresh install
- [ ] "Create New Wallet" flow produces a wallet with a `terra1...` address
- [ ] WalletHome shows LUNA balance (may be 0 for new wallet)
- [ ] Receive screen shows QR code and copyable address
- [ ] History screen loads (shows empty state or transactions)
- [ ] "Recover Wallet" with `abandon abandon ... about` mnemonic produces address `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv`
- [ ] Bundle ID in `app.json` is still `money.terra.station` (CRITICAL)
