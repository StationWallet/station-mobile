# Detox Crypto Parity Testing

Verify that the pure-JS crypto mocks (`mocks/terra-js-safe.js`, `mocks/crypto-shim.js`) produce identical output to the original `@terra-money/terra.js` when running in the Hermes runtime on an iOS simulator.

## Problem

The original `@terra-money/terra.js` depends on `tiny-secp256k1`, a native C++ addon that crashes in Hermes. The project replaces it at Metro resolution time with a pure-JS mock (`mocks/terra-js-safe.js`) using `@noble/hashes`, `elliptic`, `bip39`, and `bech32`. There is currently no test proving the mock produces identical output to the original.

Additionally, the mock has several security and correctness issues:
- `randomBytes()` silently returns zeros when the CSPRNG is unavailable
- `createHash()`/`createHmac()` silently return 32 zero-bytes for unsupported algorithms
- BIP32 HD key derivation is hand-rolled (~75 lines) without key validity checks
- `AccAddress.validate()` accepts addresses with wrong data lengths
- `@noble/hashes`, `elliptic`, `bech32`, `bip39` are transitive dependencies that could silently break

## Approach

A hidden `CryptoTestScreen` in the app runs every crypto operation on mount and renders results into `<Text testID="...">` elements. Detox launches the app on an iOS simulator, navigates to the screen, reads the rendered values, and asserts against golden values captured from the original `@terra-money/terra.js` in Node.js.

This tests in the actual Hermes runtime where the mocks will be used in production, catching engine-specific issues that Node.js unit tests would miss.

## Architecture

```
App (Hermes runtime)                    Detox (Node.js)
+---------------------------+           +------------------------+
| CryptoTestScreen          |           | crypto-parity.test.js  |
|  - runs MnemonicKey()     |  testID   |  - navigates to screen |
|  - runs RawKey.sign()     | --------> |  - reads text elements |
|  - runs hashing ops       |           |  - asserts vs golden   |
|  - renders results as     |           |    values from orig    |
|    <Text testID="...">    |           |    terra.js in Node    |
+---------------------------+           +------------------------+
```

The app uses a WebView-based architecture. The `Navigator` component (`src/navigatoin/index.tsx`) is rendered in the app tree but currently renders `<></>` inside its `NavigationContainer`. In `__DEV__` mode, we replace that empty fragment with the `CryptoTestScreen`. This avoids any need for navigation, auth, or onboarding — the test elements render directly in the view hierarchy alongside the WebView. Detox reads them via `testID` accessibility identifiers using `toHaveText()` assertions. All crypto operations run on a single screen to avoid repeated app launch overhead. The `__DEV__` guard ensures the screen is stripped from production builds.

## Golden Values

Captured from `@terra-money/terra.js@3.1.10` running in Node.js.

### MnemonicKey derivation

Mnemonic 1: `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`

| testID | Operation | Expected |
|--------|-----------|----------|
| `mk330-address` | MnemonicKey coinType=330 accAddress | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |
| `mk330-privkey` | privateKey hex | `05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10` |
| `mk330-pubkey` | publicKey base64 | `Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE` |
| `mk118-address` | MnemonicKey coinType=118 accAddress | `terra19rl4cm2hmr8afy4kldpxz3fka4jguq0a6yhaa4` |
| `mk118-privkey` | privateKey hex | `c4a48e2fce1481cd3294b4490f6678090ea98d3d0e5cd984558ab0968741b104` |
| `mk118-pubkey` | publicKey base64 | `Ak9OKtmcNNYLm6YoPJQxqEGK+GcyEpYfl6d7Y3f80Fti` |

Mnemonic 2: `zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong`

| testID | Operation | Expected |
|--------|-----------|----------|
| `mk2-330-address` | coinType=330 | `terra1whertfa9u8a8676cryt0prqdnhwkcj5tu9qsq8` |
| `mk2-330-privkey` | privateKey hex | `87dcd8210f184ade53a1a57c5cd06fc65cdaca53bfed239cd7b5dea4c126dfec` |
| `mk2-118-address` | coinType=118 | `terra1am058pdux3hyulcmfgj4m3hhrlfn8nzmprx8dq` |
| `mk2-custom-address` | account=1, index=2, coinType=330 | `terra169d7v4jaxppvpvtdl4e992m9pcshkhcjmr9tqp` |
| `mk2-custom-privkey` | privateKey hex | `07f1252907bc12a95f76ec90cbd94707c466adac141338e389c7e4533ced108f` |

### RawKey and signing

Using private key `05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10`:

| testID | Operation | Expected |
|--------|-----------|----------|
| `rawkey-address` | RawKey accAddress | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |
| `rawkey-pubkey` | publicKey base64 | `Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE` |
| `sign-payload` | sign('test message to sign') hex | `095786c42a36f31b07f4eccf6845a0348428521d12111ce8c8d821f41c41dcfd2664e6d5794105a902dde9f733b09cce1be96e4da7b6144ee82b73ddfa1d0aca` |
| `ecdsa-recid` | ecdsaSign recid | `0` |

### Address validation

| testID | Operation | Expected |
|--------|-----------|----------|
| `validate-valid` | AccAddress.validate(terra1amdttz...) | `true` |
| `validate-invalid` | AccAddress.validate('notanaddress') | `false` |
| `validate-wrong-prefix` | AccAddress.validate('cosmos1...') | `false` |
| `valaddress-valid` | ValAddress.validate(terravaloper1amdttz...) | `true` |
| `fromval` | AccAddress.fromValAddress(terravaloper1...) | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |

### Mnemonic generation

| testID | Operation | Expected |
|--------|-----------|----------|
| `gen-wordcount` | new MnemonicKey() word count | `24` |
| `gen-has-address` | accAddress starts with 'terra' | `true` |
| `gen-privkey-length` | privateKey.length | `32` |

### crypto-shim hashing

| testID | Operation | Expected |
|--------|-----------|----------|
| `hash-sha256` | createHash('sha256').update('hello world').digest('hex') | `b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9` |
| `hash-sha512` | createHash('sha512').update('hello world').digest('hex') | `309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f` |
| `hash-ripemd160` | createHash('ripemd160').update('hello world').digest('hex') | `98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f` |
| `hmac-sha256` | createHmac('sha256','secret-key').update('hello world').digest('hex') | `095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67` |
| `hash-unsupported-throws` | createHash('md5') throws | `true` |

### randomBytes safety

| testID | Operation | Expected |
|--------|-----------|----------|
| `random-not-zero` | randomBytes(32) is not all zeros | `true` |
| `random-length` | result.length | `32` |
| `random-unique` | two calls produce different output | `true` |

## Files

### New files

| File | Purpose |
|------|---------|
| `.detoxrc.js` | Detox root config: apps, devices, configurations |
| `e2e/jest.config.js` | Jest config pointing to Detox runners |
| `e2e/crypto-parity.test.js` | All test assertions against golden values |
| `src/components/CryptoTestScreen.tsx` | Dev-only screen that runs crypto ops and renders results |

### Modified files

| File | Change |
|------|--------|
| `package.json` | Add devDeps (detox, @config-plugins/detox); promote @noble/hashes, elliptic, bech32, bip39 to direct deps; add @scure/bip32; add e2e scripts |
| `app.json` | Add `@config-plugins/detox` to plugins array |
| `src/navigatoin/index.tsx` | Render CryptoTestScreen inside NavigationContainer when `__DEV__` (replaces empty `<></>`) |
| `mocks/crypto-shim.js` | `randomBytes` throws when CSPRNG unavailable; `createHash`/`createHmac` throw on unsupported algorithms |
| `mocks/terra-js-safe.js` | Replace hand-rolled BIP32 with @scure/bip32; fix AccAddress.validate data length check |

### Generated files (gitignored)

| File | Purpose |
|------|---------|
| `ios/` | Generated by `expo prebuild`, needed for Detox to build the app |

## Fixes

Applied during Phase 2, driven by test failures:

### P0: randomBytes throws when CSPRNG unavailable

```js
// mocks/crypto-shim.js
function randomBytes(size) {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new Error('No secure random number generator available');
  }
  var arr = new Uint8Array(size);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr);
}
```

### P0: Promote transitive crypto deps to direct

```
npm install @noble/hashes elliptic bech32 bip39
```

These are currently only available as transitive dependencies of other packages. Pinning them directly prevents silent breakage.

### P1: Replace hand-rolled BIP32 with @scure/bip32

```
npm install @scure/bip32
```

Replace lines 20-94 of `terra-js-safe.js` (the `HIGHEST_BIT`, `hmacSHA512`, `deriveChild`, `fromSeed` functions) with:

```js
const { HDKey } = require('@scure/bip32');

// In MnemonicKey constructor:
const seed = bip39.mnemonicToSeedSync(mnemonic);
const hdKey = HDKey.fromMasterSeed(seed);
const derived = hdKey.derive(`m/44'/${coinType}'/${account}'/0/${index}`);
// derived.privateKey is a Uint8Array
super(Buffer.from(derived.privateKey));
```

This removes ~75 lines of hand-rolled crypto and replaces it with an audited, pure-JS library by the same author as @noble/hashes.

### P1: Throw on unsupported hash algorithms

```js
// mocks/crypto-shim.js createHash()
} else {
  throw new Error('Unsupported hash algorithm: ' + algorithm);
}

// mocks/crypto-shim.js createHmac()
} else {
  throw new Error('Unsupported HMAC algorithm: ' + algorithm);
}
```

### P2: AccAddress.validate data length check

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
  // ...
};
```

## Phases

### Phase 1: Infrastructure

1. Install dependencies: `detox`, `@config-plugins/detox`, `@scure/bip32`, and promote transitive deps
2. Add `@config-plugins/detox` to `app.json` plugins
3. Create `.detoxrc.js` and `e2e/jest.config.js`
4. Create `CryptoTestScreen.tsx` with all operations
5. Wire dev-only route in navigation
6. Write `e2e/crypto-parity.test.js` with all golden value assertions
7. Run `expo prebuild --no-install`, `pod install`, `detox build`

### Phase 2: Test-driven fixes

1. Run `detox test` — capture initial failures
2. Fix `randomBytes` to throw (Group 6 tests)
3. Fix `createHash`/`createHmac` to throw on unsupported algorithms (Group 5 tests)
4. Replace hand-rolled BIP32 with `@scure/bip32` — all Group 1 tests must still pass
5. Fix `AccAddress.validate` data length check (Group 3 tests)
6. Re-run full suite — all tests green

### Phase 3: Verify

1. Full `detox test` run — all 30+ assertions pass
2. Commit all changes

## Out of scope

These issues were identified but are not crypto parity concerns. Handed to the other agent:

- `process.browser = false` in `shim.js` — behavioral, needs investigation of affected libraries
- `expo-crypto` vs `react-native-get-random-values` — dependency cleanup decision
- `LCDClient` stub methods return empty data — API stubs, not crypto
- `Wallet.accountNumberAndSequence()` returns `{0, 0}` — network layer stub
- `Wallet.sequence()` method missing — would cause TypeError but unrelated to crypto
- `Msg.toData()`/`toAmino()`/`toProto()` return `{}` — serialization stubs
- `Key.signTx()` throws — signing flow architecture, not crypto primitive parity
