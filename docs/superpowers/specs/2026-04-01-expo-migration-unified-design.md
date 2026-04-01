# Expo Migration — Unified Design Spec

**Date:** 2026-04-01
**Branch:** feat/expo-migration
**Consolidates:** terra-js-polyfill-hardening, detox-crypto-parity, native-wallet-ui

## Goal

Get the Station Wallet mobile app into a shippable state on Expo 55:

1. **App loads without errors** — no WebView pointing at dead infrastructure, no silent crypto failures
2. **Existing wallets work** — users who created wallets with the old Station app can access them with identical derived addresses and keys
3. **Core read-only functionality** — balance display, receive (QR + address), transaction history
4. **Send** — deferred to a follow-up spec (requires protobuf/amino transaction signing not yet implemented)

## Critical Invariant: Bundle ID Preservation

The iOS bundle identifier (`money.terra.station`) and Android package (`money.terra.station`) in `app.json` **must not change**. Existing wallets are stored in the device keystore, which is scoped to the app's bundle ID. Changing it means users lose access to all stored wallet data on app update. This is catastrophic and non-recoverable.

## Context

The app was a thin React Native shell around a WebView loading `https://mobile.station.terra.money`. That remote web app is dead (returns "Too many requests"). The Expo 55 migration replaced `@terra-money/terra.js` with a pure-JS polyfill (`mocks/terra-js-safe.js`) to avoid Hermes crashes from terra.js's native dependency chain (bip32 → tiny-secp256k1). The crypto layer (MnemonicKey, RawKey, address derivation) is functional but has security gaps. The LCD client and Msg types are stubs returning empty/hardcoded data.

**Key architectural fact:** The Expo 55 migration (commit `95e2094`) deleted all native auth screens (~22 files, ~1984 lines) that previously handled wallet creation and recovery. The orphaned navigation stacks (`NewWalletStack.tsx`, `RecoverWalletStack.tsx`, `AuthNavigator.tsx`) and Recoil stores (`NewWalletStore.ts`, `RecoverWalletStore.ts`) remain. These screens must be restored from git history (commit `fd39a64`) and adapted.

This spec defines three phases to ship a working app:

| Phase | What | Why |
|-------|------|-----|
| 1 | Polyfill hardening + LCD client | Foundation: real data, safe crypto |
| 2 | Crypto parity verification | Prove existing wallets survive the migration |
| 3 | Native wallet UI + auth screens | Replace the dead WebView with native screens; restore wallet creation/recovery |

## Phase 1: Polyfill Hardening & LCD Client

### 1.1 Rename `mocks/` → `polyfills/`

These files are functional pure-JS replacements, not mocks. Rename to reflect this:

```
mocks/                          →  polyfills/
  terra-js-safe.js              →  terra.js
  crypto-shim.js                →  crypto.js
  ledger-transport-ble.js       →  ledger-transport-ble.js  (unchanged)
  ledger-terra-js.js            →  ledger-terra-js.js        (unchanged)
                                    terra-lcd.js              (NEW)
```

Update `metro.config.js` to reference `polyfills/` paths for all resolver intercepts.

### 1.2 Crypto Safety Fixes (in `polyfills/crypto.js`)

**P0 — `randomBytes` must throw when CSPRNG unavailable:**

Currently returns a zero-filled buffer silently. This is a security vulnerability — any code generating keys or nonces would get predictable zeros.

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

Apply the same fix to `getRandomValues`.

**P1 — `createHash`/`createHmac` must throw on unsupported algorithms:**

Currently returns 32 zero-bytes silently for unsupported algorithms. Code expecting a real hash would silently produce wrong results.

```js
// createHash — after ripemd160 branch:
} else {
  throw new Error('Unsupported hash algorithm: ' + algorithm);
}

// createHmac — after sha512 branch:
} else {
  throw new Error('Unsupported HMAC algorithm: ' + algorithm);
}
```

### 1.3 Crypto Correctness Fixes (in `polyfills/terra.js`)

**P0 — Promote transitive crypto deps to direct:**

`@noble/hashes`, `elliptic`, `bech32`, and `bip39` are currently only resolved as transitive dependencies. A version bump in any parent package could silently break the polyfill.

```
npm install @noble/hashes elliptic bech32 bip39
```

**P1 — Replace hand-rolled BIP32 with `@scure/bip32`:**

Lines 20–94 of `terra-js-safe.js` contain ~75 lines of hand-rolled HD key derivation (HIGHEST_BIT, hmacSHA512, deriveChild, fromSeed) without key validity checks. Replace with the audited `@scure/bip32` library (same author as @noble/hashes):

```
npm install @scure/bip32
```

```js
const { HDKey } = require('@scure/bip32');

// In MnemonicKey constructor, replace fromSeed + derivePath with:
const seed = bip39.mnemonicToSeedSync(mnemonic);
const hdKey = HDKey.fromMasterSeed(seed);
const derived = hdKey.derive(`m/44'/${coinType}'/${account}'/0/${index}`);
super(Buffer.from(derived.privateKey));
```

Remove the `HIGHEST_BIT`, `hmacSHA512`, `deriveChild`, and `fromSeed` functions entirely.

**P2 — `AccAddress.validate` data length check:**

Currently checks only `decoded.words.length > 0` — accepts addresses with wrong data lengths.

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
  // fromValAddress unchanged
};
```

### 1.4 Msg Serialization (in `polyfills/terra.js`)

All Msg subclasses currently inherit `toData()`/`toAmino()`/`toProto()` returning `{}`. Fix each to return structured data with correct Cosmos SDK type URLs:

| Class | `@type` (proto) | `type` (amino) |
|-------|-----------------|----------------|
| MsgSend | `/cosmos.bank.v1beta1.MsgSend` | `cosmos-sdk/MsgSend` |
| MsgExecuteContract | `/cosmwasm.wasm.v1.MsgExecuteContract` | `wasm/MsgExecuteContract` |
| MsgSwap | `/terra.market.v1beta1.MsgSwap` | `market/MsgSwap` |
| MsgDelegate | `/cosmos.staking.v1beta1.MsgDelegate` | `cosmos-sdk/MsgDelegate` |
| MsgBeginRedelegate | `/cosmos.staking.v1beta1.MsgBeginRedelegate` | `cosmos-sdk/MsgBeginRedelegate` |
| MsgUndelegate | `/cosmos.staking.v1beta1.MsgUndelegate` | `cosmos-sdk/MsgUndelegate` |
| MsgWithdrawDelegatorReward | `/cosmos.distribution.v1beta1.MsgWithdrawDelegationReward` | `cosmos-sdk/MsgWithdrawDelegationReward` |
| MsgDeposit | `/cosmos.gov.v1beta1.MsgDeposit` | `cosmos-sdk/MsgDeposit` |

Pattern for each Msg:
- `toProto()` returns `{ '@type': typeUrl, ...constructorFields }`
- `toAmino()` returns `{ type: aminoType, value: { ...constructorFields } }`
- `toData()` delegates to `toProto()`
- Coin/Coins fields call `.toProto()` if available

### 1.5 LCD Client (new file: `polyfills/terra-lcd.js`)

Fetch-based LCD client making real HTTP requests to Cosmos REST endpoints. Exported as a factory taking a base URL, returning module objects matching terra.js's LCDClient API shape.

**auth module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `accountInfo(address)` | GET `/cosmos/auth/v1beta1/accounts/{address}` | Account with `account_number`, `sequence` |

**bank module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `balance(address)` | GET `/cosmos/bank/v1beta1/balances/{address}` | `[Coins, Pagination]` |
| `total()` | GET `/cosmos/bank/v1beta1/supply` | `Coins` |

**staking module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `validators(status)` | GET `/cosmos/staking/v1beta1/validators?status={status}` | `[Validator[], Pagination]` |
| `validator(addr)` | GET `/cosmos/staking/v1beta1/validators/{addr}` | Validator |
| `delegations(delegator, validator, pagination)` | GET `/cosmos/staking/v1beta1/delegations/{delegator}` | `[Delegation[], Pagination]` |
| `delegation(delegator, validator)` | GET `/cosmos/staking/v1beta1/validators/{validator}/delegations/{delegator}` | Delegation |
| `unbondingDelegations(delegator)` | GET `/cosmos/staking/v1beta1/delegators/{delegator}/unbonding_delegations` | `[UnbondingDelegation[], Pagination]` |
| `pool()` | GET `/cosmos/staking/v1beta1/pool` | Pool object |

**distribution module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `rewards(delegator)` | GET `/cosmos/distribution/v1beta1/delegators/{delegator}/rewards` | `{total: Coins, rewards: Record}` |
| `communityPool()` | GET `/cosmos/distribution/v1beta1/community_pool` | Coins |
| `validatorCommission(validator)` | GET `/cosmos/distribution/v1beta1/validators/{validator}/commission` | Commission |
| `withdrawAddress(delegator)` | GET `/cosmos/distribution/v1beta1/delegators/{delegator}/withdraw_address` | address string |

**oracle module (Classic only — returns empty data gracefully on Phoenix-1 501):**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `activeDenoms()` | GET `/terra/oracle/v1beta1/denoms/actives` | string[] |
| `exchangeRates()` | GET `/terra/oracle/v1beta1/denoms/exchange_rates` | Coins |
| `parameters()` | GET `/terra/oracle/v1beta1/params` | OracleParams |

**tx module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `create(signers, options)` | POST `/cosmos/tx/v1beta1/simulate` | Unsigned Tx with estimated gas |
| `estimateFee(signers, options)` | POST `/cosmos/tx/v1beta1/simulate` | Fee |
| `broadcastSync(tx)` | POST `/cosmos/tx/v1beta1/txs` (BROADCAST_MODE_SYNC) | `{txhash, raw_log}` |
| `broadcast(tx)` | POST `/cosmos/tx/v1beta1/txs` (BROADCAST_MODE_BLOCK) | `{txhash, raw_log}` |
| `txInfo(hash)` | GET `/cosmos/tx/v1beta1/txs/{hash}` | TxInfo |
| `txsByEvents(events, params)` | GET `/cosmos/tx/v1beta1/txs?events=...&order_by=...&pagination.limit=...` | `{txs, tx_responses, pagination}` |

**ibc module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `denomTrace(hash)` | GET `/ibc/apps/transfer/v1beta1/denom_traces/{hash}` | `{denom_trace: {path, base_denom}}` |

**Response shaping:** Each method fetches raw JSON, then wraps responses into terra.js types (Coins, Fee, etc.) imported from `terra.js`. This keeps all consuming code in `src/` unchanged.

**Error handling:**
- Network failures: throw
- Non-2xx responses: throw with status and body
- Oracle endpoints returning 501 on Phoenix-1: return empty data gracefully

**Rate limiting:** Not implemented. ~20+ queries fire on startup. No rate limiting observed on PublicNode or Polkachu. Documented as a known consideration in the file header.

The `txsByEvents` method is new (not in the original polyfill hardening spec) — needed by the History screen in Phase 3.

### 1.6 Wire LCDClient to LCD Module (in `polyfills/terra.js`)

Replace inline stubs in the `LCDClient` class with delegation to `terra-lcd.js`:

```js
const createLCD = require('./terra-lcd');

class LCDClient {
  constructor(config) {
    this.config = config;
    this.chainID = config?.chainID || 'phoenix-1';
    this.URL = config?.URL || '';
    const lcd = createLCD(this.URL);
    this._auth = lcd.auth;
    this._bank = lcd.bank;
    this._staking = lcd.staking;
    this._distribution = lcd.distribution;
    this._oracle = lcd.oracle;
    this._tx = lcd.tx;
    this._ibc = lcd.ibc;
  }
  wallet(key) { return new Wallet(this, key); }
  get auth() { return this._auth; }
  get bank() { return this._bank; }
  // ... etc for each module
}
```

### 1.7 Wire Wallet to LCD Auth (in `polyfills/terra.js`)

```js
class Wallet {
  constructor(lcd, key) {
    this.lcd = lcd;
    this.key = key;
  }
  async accountNumberAndSequence() {
    const info = await this.lcd.auth.accountInfo(this.key.accAddress);
    return {
      account_number: info.account_number,
      sequence: info.sequence,
    };
  }
  async sequence() {
    const { sequence } = await this.accountNumberAndSequence();
    return sequence;
  }
  async createAndSignTx() {
    throw new Error('createAndSignTx requires full terra.js — use WebView signing flow');
  }
}
```

### 1.8 `shim.js` Comment

No functional change. Add explanatory comment:

```js
// Must be false — node-forge, pbkdf2, and other deps check this to select
// Node.js-compatible code paths (nextTick, native crypto, binary encoding).
// Setting to true or removing breaks crypto operations.
process.browser = false
```

### 1.9 Remove `expo-crypto`

`expo-crypto` is listed in `package.json` dependencies but unused. `react-native-get-random-values` already covers the CSPRNG need.

- Remove `expo-crypto` from `package.json` dependencies
- `app.json` plugins array does not currently include it (confirmed), so no change needed there

### 1.10 Drop: `useSwapRate.ts` isClassic Fix

The original polyfill hardening spec flagged `useSwapRate.ts` as missing an `isClassic` guard. **This is incorrect** — the file already guards oracle calls with `if (!isClassic || ...)` at line 21. No change needed.

---

## Phase 2: Crypto Parity Verification

### Why

The polyfill's MnemonicKey must produce **identical** addresses and keys from the same mnemonic as the original `@terra-money/terra.js`. If it doesn't, users lose access to their existing wallets. This phase proves parity in the actual Hermes runtime, catching engine-specific issues that Node.js unit tests would miss.

### Architecture

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

A `CryptoTestScreen` component runs every crypto operation on mount and renders results into `<Text testID="...">` elements. Detox launches the app on an iOS simulator, reads the rendered values, and asserts against golden values captured from the original `@terra-money/terra.js@3.1.10` in Node.js.

### CryptoTestScreen Integration

The `CryptoTestScreen` is gated by `__DEV__` and rendered as a dev-only route within the navigation structure. Since the existing `Navigator` component (`src/navigatoin/index.tsx`) renders `<></>` inside its `NavigationContainer`, in `__DEV__` mode we render `CryptoTestScreen` there. This avoids any need for navigation, auth, or onboarding — Detox reads elements via `testID` accessibility identifiers.

In Phase 3, when we add real navigation, the `CryptoTestScreen` moves to a dev-only route accessible via deep link (`terrastation://crypto-test`) so it doesn't interfere with normal development.

### Golden Values

Captured from `@terra-money/terra.js@3.1.10` running in Node.js.

**MnemonicKey derivation — Mnemonic 1:** `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`

| testID | Operation | Expected |
|--------|-----------|----------|
| `mk330-address` | MnemonicKey coinType=330 accAddress | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |
| `mk330-privkey` | privateKey hex | `05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10` |
| `mk330-pubkey` | publicKey base64 | `Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE` |
| `mk118-address` | MnemonicKey coinType=118 accAddress | `terra19rl4cm2hmr8afy4kldpxz3fka4jguq0a6yhaa4` |
| `mk118-privkey` | privateKey hex | `c4a48e2fce1481cd3294b4490f6678090ea98d3d0e5cd984558ab0968741b104` |
| `mk118-pubkey` | publicKey base64 | `Ak9OKtmcNNYLm6YoPJQxqEGK+GcyEpYfl6d7Y3f80Fti` |

**MnemonicKey derivation — Mnemonic 2:** `zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong`

| testID | Operation | Expected |
|--------|-----------|----------|
| `mk2-330-address` | coinType=330 | `terra1whertfa9u8a8676cryt0prqdnhwkcj5tu9qsq8` |
| `mk2-330-privkey` | privateKey hex | `87dcd8210f184ade53a1a57c5cd06fc65cdaca53bfed239cd7b5dea4c126dfec` |
| `mk2-118-address` | coinType=118 | `terra1am058pdux3hyulcmfgj4m3hhrlfn8nzmprx8dq` |
| `mk2-custom-address` | account=1, index=2, coinType=330 | `terra169d7v4jaxppvpvtdl4e992m9pcshkhcjmr9tqp` |
| `mk2-custom-privkey` | privateKey hex | `07f1252907bc12a95f76ec90cbd94707c466adac141338e389c7e4533ced108f` |

**RawKey and signing** (using private key `05be413bb5bd1fb67757251976dd43adf0d4db27d1a5444b4f6ef754ef939b10`):

| testID | Operation | Expected |
|--------|-----------|----------|
| `rawkey-address` | RawKey accAddress | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |
| `rawkey-pubkey` | publicKey base64 | `Aqy0vCZ9t3dGFL9gEcWZKbAGwlVDhqMJC6/ws/xBjsBE` |
| `sign-payload` | sign('test message to sign') hex | `095786c42a36f31b07f4eccf6845a0348428521d12111ce8c8d821f41c41dcfd2664e6d5794105a902dde9f733b09cce1be96e4da7b6144ee82b73ddfa1d0aca` |
| `ecdsa-recid` | ecdsaSign recid | `0` |

**Address validation:**

| testID | Operation | Expected |
|--------|-----------|----------|
| `validate-valid` | AccAddress.validate(terra1amdttz...) | `true` |
| `validate-invalid` | AccAddress.validate('notanaddress') | `false` |
| `validate-wrong-prefix` | AccAddress.validate('cosmos1...') | `false` |
| `valaddress-valid` | ValAddress.validate(terravaloper1amdttz...) | `true` |
| `fromval` | AccAddress.fromValAddress(terravaloper1...) | `terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv` |

**Mnemonic generation:**

| testID | Operation | Expected |
|--------|-----------|----------|
| `gen-wordcount` | new MnemonicKey() word count | `24` |
| `gen-has-address` | accAddress starts with 'terra' | `true` |
| `gen-privkey-length` | privateKey.length | `32` |

**crypto.js hashing:**

| testID | Operation | Expected |
|--------|-----------|----------|
| `hash-sha256` | createHash('sha256').update('hello world').digest('hex') | `b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9` |
| `hash-sha512` | createHash('sha512').update('hello world').digest('hex') | `309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f` |
| `hash-ripemd160` | createHash('ripemd160').update('hello world').digest('hex') | `98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f` |
| `hmac-sha256` | createHmac('sha256','secret-key').update('hello world').digest('hex') | `095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67` |
| `hash-unsupported-throws` | createHash('md5') throws | `true` |

**randomBytes safety:**

| testID | Operation | Expected |
|--------|-----------|----------|
| `random-not-zero` | randomBytes(32) is not all zeros | `true` |
| `random-length` | result.length | `32` |
| `random-unique` | two calls produce different output | `true` |

### Detox Infrastructure

| File | Purpose |
|------|---------|
| `.detoxrc.js` | Detox root config: apps, devices, configurations |
| `e2e/jest.config.js` | Jest config pointing to Detox runners |
| `e2e/crypto-parity.test.js` | All test assertions against golden values |
| `src/components/CryptoTestScreen.tsx` | Dev-only screen that runs crypto ops and renders results |

Dependencies to add:
```
npm install --save-dev detox @config-plugins/detox
```

Add `@config-plugins/detox` to `app.json` plugins. Add `e2e` scripts to `package.json`.

### Execution

1. Run `detox test` — capture initial failures (expected: randomBytes, unsupported hash, AccAddress validate)
2. Verify all golden value tests pass after Phase 1 crypto fixes
3. Full suite — all 30+ assertions green

---

## Phase 3: Native Wallet UI + Auth Screens

### Architecture

Remove the WebView (which loads dead `mobile.station.terra.money`) and replace with native React Native screens using the LCD client from Phase 1.

**Routing logic in `App/index.tsx`:**
- If `getWallets()` returns non-empty → show `MainNavigator`
- If no wallets → show `AuthNavigator`
- OnBoarding flow remains unchanged (first run only)

```
App
├── OnBoarding (first run only)
├── AuthNavigator (no wallet)
│   ├── AuthMenu
│   ├── NewWallet (Step1 → Step2 → Step3 → Created)
│   └── RecoverWallet (Step1 → ... → Recovered)
└── MainNavigator (has wallet)
    ├── WalletHome (default)
    ├── Receive
    ├── History
    └── CryptoTestScreen (__DEV__ only, deep link: terrastation://crypto-test)
```

### 3.1 Restore Auth Screens from Git History

The native auth screens were deleted in the Expo 55 migration (commit `95e2094`). They must be restored from their original implementation (commit `fd39a64`) and adapted to the current codebase.

**Screens to restore:**

| Screen | Source path | Purpose |
|--------|------------|---------|
| `AuthMenu` | `src/screens/auth/AuthMenu.tsx` | Entry: "Create New Wallet" / "Recover Wallet" buttons |
| `NewWallet/Step1` | `src/screens/auth/NewWallet/Step1.tsx` | Generate mnemonic, display 24 words |
| `NewWallet/Step2` | `src/screens/auth/NewWallet/Step2.tsx` | Confirm mnemonic (quiz verification) |
| `NewWallet/Step3` | `src/screens/auth/NewWallet/Step3.tsx` | Set wallet name and password |
| `NewWallet/WalletCreated` | `src/screens/auth/NewWallet/WalletCreated.tsx` | Success confirmation |
| `RecoverWallet/Step1` | `src/screens/auth/RecoverWallet/Step1.tsx` | Choose recovery method (seed/QR) |
| `RecoverWallet/Step2Seed` | `src/screens/auth/RecoverWallet/Step2Seed.tsx` | Enter seed phrase |
| `RecoverWallet/Step3Seed` | `src/screens/auth/RecoverWallet/Step3Seed.tsx` | Set wallet name and password |
| `RecoverWallet/Step4Seed` | `src/screens/auth/RecoverWallet/Step4Seed.tsx` | Confirm details |
| `RecoverWallet/WalletRecovered` | `src/screens/auth/RecoverWallet/WalletRecovered.tsx` | Success confirmation |

**Adaptation required:**
- Verify all imported components still exist (Card, Text, Button, FormInput, etc.)
- Verify Recoil stores (`NewWalletStore.ts`, `RecoverWalletStore.ts`) still match expected shape
- Verify wallet utility functions (`createWallet`, `generateAddresses`, `recoverWalletWithMnemonicKey`) still work — they do, these were not deleted
- Remove any references to deleted components or APIs
- Wire the orphaned navigation stacks (`NewWalletStack.tsx`, `RecoverWalletStack.tsx`, `AuthNavigator.tsx`) to the restored screens
- Use `useTranslation()` for all user-facing strings (app has i18n with 6 languages)

**ConnectLedger screens:** Were also deleted but Ledger support is out of scope for MVP. Do not restore.

### 3.2 Directory Rename: `src/navigatoin/` → `src/navigation/`

The directory has a typo inherited from the original codebase. Since we're rewriting the navigation structure in this phase, fix it now. Update all imports across the codebase (`src/App/index.tsx` imports from `../navigatoin`).

### 3.3 Data Layer

All LCD queries use the existing `useLCD()` hook which returns a configured `LCDClient`. New queries wrapped in `useQuery` from react-query (v3 — the app uses `react-query ^3.21.0`, not `@tanstack/react-query`) for caching and refetch.

**Consolidate `useLCD()` hooks:** Two implementations exist:
- `src/hooks/useLCD.ts` — primary, used by most code
- `src/lib/api/useLCD.ts` — includes `isClassic` support

Merge into a single hook at `src/hooks/useLCD.ts` with `isClassic` support from the lib version.

### 3.4 Balance Display: Denomination Handling

LCD returns balances in micro-units (`uluna` = 10^-6 LUNA). The display must divide by 10^6 for human-readable amounts. Use integer arithmetic (BigInt) to avoid floating-point precision issues:

```ts
function formatAmount(uluna: string): string {
  const amount = BigInt(uluna);
  const whole = amount / BigInt(1_000_000);
  const frac = amount % BigInt(1_000_000);
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
```

### 3.5 Screens

**WalletHome** — main screen after login:
- Wallet name and address (truncated, tap to copy)
- LUNA balance via `lcd.bank.balance(address)` — displayed in a dark Card component, formatted from uluna to LUNA (see 3.4)
- Two action buttons: "Receive" and "History"
- Pull-to-refresh via `RefreshControl`
- If multiple wallets: show first one (wallet switching out of scope)
- Use `useTranslation()` for all labels

**Receive** — simple display screen:
- Full wallet address as text
- QR code generated from address using `react-native-qrcode-svg`
- "Copy" button → clipboard via `expo-clipboard` (already installed)
- Use `useTranslation()` for all labels

**New dependency for QR generation:**
```
npm install react-native-qrcode-svg react-native-svg
```
(`react-native-svg` is a peer dependency of `react-native-qrcode-svg`)

**History** — transaction list:
- Fetches via `lcd.tx.txsByEvents(events, params)` with `events=message.sender='{address}'`, `order_by=ORDER_BY_DESC`, `pagination.limit=20`
- Each row: date, message type (`MsgSend`, `MsgDelegate`, etc.), success/fail badge, truncated tx hash
- Tap opens block explorer in system browser. Use `https://chainsco.pe/terra2/tx/{hash}` (Chainscope) as the default explorer — `finder.terra.money` is part of the same dead infrastructure we're migrating away from. Verify URL is live before implementation.
- Pull-to-refresh + "Load more" pagination
- Use `useTranslation()` for all labels and empty state text

### 3.6 Reused Existing Code

- **Components:** Card, Text, Button, FormInput, FormLabel, Icon, Header, Body, Loading, Error
- **Styling:** COLOR constants, Gotham font family via Text `fontType` prop, LAYOUT utilities
- **Data:** `useLCD()` hook, react-query, `getWallets()`, `AccAddress.validate()`
- **State:** Recoil for app-level state, `useConfig()` for chain config, `useAuth()` for wallet state
- **i18n:** `useTranslation()` from react-i18next for all user-facing strings
- **Patterns:** KeyboardAvoidingView for forms, ScrollView with RefreshControl

### 3.7 Error Handling

- **Network errors:** react-query handles retries. Failed queries show existing Error component with retry.
- **Empty balance:** Show "0 LUNA" normally.
- **No history:** Show "No transactions yet" placeholder.

### 3.8 App Lock / Auth Gating — Conscious Deferral

The old app relied on the WebView for auth gating (password entry). With the WebView removed, returning users go straight to `WalletHome` with no unlock step. This is acceptable for MVP because:
- Read-only operations (balance, receive, history) only need the wallet address, which is stored unencrypted
- The private key remains encrypted in the keystore and is never accessed without a password
- Biometric auth (`useBioAuth`) exists as a hook but wiring it into the app launch flow is additional scope

A lock screen should be added in a follow-up, before Send is enabled (since Send requires decrypting the private key).

### 3.9 WebView Removal

In `App/index.tsx`:
- Remove `<WebViewContainer>` from the render tree
- Keep `WebViewContainer.tsx` file — message-passing patterns may be useful later
- Remove `<UnderMaintenance>` component render
- The JSON parse error from the WebView's `onMessage` handler goes away automatically
- Clean up dead Recoil atoms (`AppStore.webviewInstance`, `AppStore.webviewComponentLoaded`) and their references in App — these only existed to manage WebView state

### 3.10 Key Signing Methods — Unchanged

`Key.signTx()`, `Key.createSignature()`, `Key.createSignatureAmino()` continue to throw. Transaction signing (needed for Send) requires either full protobuf/amino encoding of Cosmos SDK transaction types or integration with `@cosmjs/stargate`. This is deferred.

---

## Files Changed — Complete List

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `polyfills/terra-lcd.js` | 1 | Fetch-based LCD client with response shaping |
| `.detoxrc.js` | 2 | Detox root config |
| `e2e/jest.config.js` | 2 | Jest config for Detox |
| `e2e/crypto-parity.test.js` | 2 | Golden value test assertions |
| `src/components/CryptoTestScreen.tsx` | 2 | Dev-only crypto test screen |
| `src/screens/WalletHome.tsx` | 3 | Balance display screen |
| `src/screens/Receive.tsx` | 3 | QR code + address screen |
| `src/screens/History.tsx` | 3 | Transaction history screen |
| `src/navigation/MainNavigator.tsx` | 3 | Stack navigator for wallet screens |

### Restored from Git History (commit `fd39a64`)

| File | Phase | Purpose |
|------|-------|---------|
| `src/screens/auth/AuthMenu.tsx` | 3 | "Create" / "Recover" wallet menu |
| `src/screens/auth/NewWallet/Step1.tsx` | 3 | Generate and display mnemonic |
| `src/screens/auth/NewWallet/Step2.tsx` | 3 | Mnemonic confirmation quiz |
| `src/screens/auth/NewWallet/Step3.tsx` | 3 | Wallet name + password |
| `src/screens/auth/NewWallet/WalletCreated.tsx` | 3 | Success screen |
| `src/screens/auth/RecoverWallet/Step1.tsx` | 3 | Recovery method selection |
| `src/screens/auth/RecoverWallet/Step2Seed.tsx` | 3 | Seed phrase entry |
| `src/screens/auth/RecoverWallet/Step3Seed.tsx` | 3 | Wallet name + password |
| `src/screens/auth/RecoverWallet/Step4Seed.tsx` | 3 | Confirm details |
| `src/screens/auth/RecoverWallet/WalletRecovered.tsx` | 3 | Success screen |

These files need adaptation after restoration — verify component imports, remove dead references, ensure compatibility with current polyfill and store shapes.

### Renamed/Moved Files

| From | To | Phase |
|------|----|-------|
| `mocks/terra-js-safe.js` | `polyfills/terra.js` | 1 |
| `mocks/crypto-shim.js` | `polyfills/crypto.js` | 1 |
| `mocks/ledger-transport-ble.js` | `polyfills/ledger-transport-ble.js` | 1 |
| `mocks/ledger-terra-js.js` | `polyfills/ledger-terra-js.js` | 1 |
| `src/navigatoin/` | `src/navigation/` | 3 |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `metro.config.js` | 1 | Update paths from `mocks/` to `polyfills/` |
| `polyfills/crypto.js` | 1 | `randomBytes` throws on missing CSPRNG; `createHash`/`createHmac` throw on unsupported algorithms |
| `polyfills/terra.js` | 1 | Replace BIP32 with @scure/bip32; fix AccAddress.validate; fix Msg serialization; wire Wallet to LCD auth; wire LCDClient to terra-lcd.js |
| `shim.js` | 1 | Add explanatory comment on `process.browser = false` |
| `package.json` | 1+2+3 | Remove expo-crypto; promote @noble/hashes, elliptic, bech32, bip39 to direct deps; add @scure/bip32; add detox devDeps; add e2e scripts; add react-native-qrcode-svg + react-native-svg |
| `app.json` | 2 | Add `@config-plugins/detox` to plugins |
| `src/navigation/index.tsx` | 2, 3 | Phase 2: render CryptoTestScreen in __DEV__. Phase 3: replace with MainNavigator/AuthNavigator routing |
| `src/navigation/AuthNavigator.tsx` | 3 | Wire to restored auth screens |
| `src/navigation/NewWalletStack.tsx` | 3 | Wire to restored NewWallet screens |
| `src/navigation/RecoverWalletStack.tsx` | 3 | Wire to restored RecoverWallet screens |
| `src/App/index.tsx` | 3 | Remove WebViewContainer + UnderMaintenance + dead Recoil atoms; add wallet-based routing; update import from `navigatoin` to `navigation` |
| `src/hooks/useLCD.ts` | 3 | Consolidate with `src/lib/api/useLCD.ts` — merge `isClassic` support into single hook |

### Generated Files (gitignored)

| File | Purpose |
|------|---------|
| `ios/` | Generated by `expo prebuild`, needed for Detox builds |

---

## Inconsistencies Resolved

| Issue | Resolution |
|-------|------------|
| Spec 1 says `useSwapRate.ts` needs `isClassic` guard | **Already present** (line 21). No change needed. |
| Spec 2 references `mocks/` paths | Reconciled — all references use `polyfills/` after rename |
| Spec 2 modifies `mocks/crypto-shim.js` + `mocks/terra-js-safe.js`; Spec 1 modifies same files | **Merged** — all changes applied to renamed `polyfills/crypto.js` and `polyfills/terra.js` |
| Spec 1 lists crypto fixes as "out of scope"; Spec 2 lists them as in-scope | **Merged** — all fixes in Phase 1 |
| Spec 2 renders CryptoTestScreen in Navigator's empty fragment; Spec 3 replaces Navigator with real screens | **Sequenced** — Phase 2 uses empty fragment; Phase 3 moves CryptoTestScreen to dev-only route |
| Spec 3 Send flow assumes signing works; polyfill's `signTx()` throws | **Deferred** — Send requires protobuf encoding not yet available. Core goal (balance + history) doesn't need it. |
| Two `useLCD()` hooks exist (`src/hooks/` and `src/lib/api/`) | Consolidate during Phase 3 into single hook with `isClassic` support |
| Spec 3 says "existing native auth screens" | **They don't exist** — deleted in Expo migration. Must be restored from git history (commit `fd39a64`). Added to Phase 3 scope. |
| `src/navigatoin/` directory typo | Fix during Phase 3 navigation rewrite — rename to `src/navigation/` |
| Spec 3 references `finder.terra.money` block explorer | Part of dead Terra infrastructure. Replaced with Chainscope (`chainsco.pe/terra2`). Verify before implementation. |
| LCD returns `uluna` micro-units; spec didn't address display formatting | Added denomination handling (section 3.4) — divide by 10^6 using BigInt arithmetic |

---

## Out of Scope (Future Work)

| Item | Notes |
|------|-------|
| **Send flow** | Requires transaction signing (protobuf/amino encoding + ECDSA). Likely needs `@cosmjs/stargate` integration. Prerequisite: app lock screen (private key must be decrypted). |
| **App lock screen** | Biometric/password unlock on app launch. `useBioAuth` hook exists. Should be added before Send is enabled. |
| **Wallet switching** | Multi-wallet support — show first wallet for now |
| **Staking, governance, contracts, NFTs** | Beyond core read-only goal |
| **Multi-token support** | Only LUNA balance for now |
| **Settings screen** | Not needed for MVP |
| **Tab-based navigation** | Restructure when more features warrant it |
| **Rate limiting** | No issues observed on PublicNode/Polkachu, but no guarantee |
| **Ledger wallet support** | Stubs exist; functional support deferred |
| **ConnectLedger auth screens** | Were deleted alongside other auth screens. Not restoring for MVP. |
