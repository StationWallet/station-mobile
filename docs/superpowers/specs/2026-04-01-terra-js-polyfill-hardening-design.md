# Terra.js Polyfill Hardening

**Date:** 2026-04-01
**Branch:** feat/expo-migration
**Scope:** Issues A-F from the Expo migration review

## Context

The Expo 55 migration replaced `@terra-money/terra.js` with a pure-JS mock (`mocks/terra-js-safe.js`) to avoid Hermes crashes caused by terra.js's native dependency chain (bip32 -> tiny-secp256k1). The crypto layer (MnemonicKey, RawKey, address derivation) is already functional. However, the LCDClient, Wallet, and Msg types are stubs returning empty/hardcoded data — the app needs these to be functional.

The LCD is standard Cosmos SDK REST. There is no reason it can't work in Hermes via `fetch()`.

## Issues Addressed

| ID | Issue | Resolution |
|----|-------|------------|
| A | `process.browser = false` in shim.js | No change — correct as-is. Add explanatory comment. |
| B | `expo-crypto` installed but unused | Remove from package.json and app.json plugins. |
| C | LCDClient stubs return empty data silently | Replace with real `fetch()` calls to Cosmos REST endpoints. |
| D | `Wallet.accountNumberAndSequence()` returns `{0, 0}` | Wire to `lcd.auth.accountInfo()` via real HTTP. |
| E | `Wallet.sequence()` method missing | Add method delegating to `accountNumberAndSequence()`. |
| F | `Msg.toData()/toAmino()/toProto()` return `{}` | Return structured data with correct `@type` URLs and amino types. |

## Design

### 1. Directory and File Rename

The files are no longer mocks — they are functional pure-JS replacements for packages that crash in Hermes. Rename to reflect this:

```
mocks/                          ->  polyfills/
  terra-js-safe.js              ->  terra.js
  crypto-shim.js                ->  crypto.js
  ledger-transport-ble.js       ->  ledger-transport-ble.js  (unchanged)
  ledger-terra-js.js            ->  ledger-terra-js.js        (unchanged)
                                    terra-lcd.js              (NEW)
```

`metro.config.js` updated to reference `polyfills/` paths.

### 2. `polyfills/terra-lcd.js` (new file)

Fetch-based LCD client that makes real HTTP requests to Terra LCD REST endpoints. Exported as a factory that takes a base URL and returns module objects matching terra.js's LCDClient API shape.

#### Endpoints

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

**ibc module:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `denomTrace(hash)` | GET `/ibc/apps/transfer/v1beta1/denom_traces/{hash}` | `{denom_trace: {path, base_denom}}` |

#### Response Shaping

Each method fetches raw JSON from the REST endpoint, then wraps responses into terra.js types (Coins, Fee, etc.) imported from `terra.js`. This keeps all consuming code in `src/` unchanged.

#### Error Handling

- Network failures: throw
- Non-2xx responses: throw with status and body
- Oracle endpoints returning 501 on Phoenix-1: return empty data gracefully (empty Coins, empty arrays) since the app already handles empty states for these

#### Rate Limiting

No rate limiting logic for now. ~20+ queries fire on startup. No rate limiting observed on PublicNode or Polkachu, but there is no guarantee. Documented as a known consideration in the file header.

### 3. Changes to `polyfills/terra.js`

#### Wallet (Issues D, E)

Wire `Wallet` to the real LCD auth endpoint:

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

#### Msg Serialization (Issue F)

Each Msg class returns structured data from constructor args with correct Cosmos SDK type URLs:

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

`toProto()` returns `{ '@type': ..., ...fields }`. `toAmino()` returns `{ type: ..., value: { ...fields } }`. `toData()` delegates to `toProto()`.

Coin/Coins serialization in Msg fields handled by checking for `.toProto()` method on amount fields.

#### LCDClient

Imports and delegates to `terra-lcd.js` instead of inline stubs. Constructor passes `config.URL` to the LCD factory.

#### Signing Methods

`Key.signTx()`, `Key.createSignature()`, `Key.createSignatureAmino()` continue to throw — these need the full crypto chain that lives in the WebView.

### 4. `shim.js` (Issue A)

No functional change. Add explanatory comment:

```js
// Must be false — node-forge, pbkdf2, and other deps check this to select
// Node.js-compatible code paths (nextTick, native crypto, binary encoding).
// Setting to true or removing breaks crypto operations.
process.browser = false
```

### 5. Remove `expo-crypto` (Issue B)

- Remove `expo-crypto` from `package.json` dependencies
- Remove `expo-crypto` from `app.json` plugins array
- `react-native-get-random-values` already covers the CSPRNG need and uses Expo's native random module under the hood

### 6. `useSwapRate.ts` isClassic guard (related fix)

Oracle endpoints return 501 on Phoenix-1 (Terra v2). The app guards most oracle calls with `isClassic` checks (see `src/qureys/oracle.ts`), but `src/hooks/useSwapRate.ts` does not. Add the `isClassic` guard before the oracle call, matching the existing pattern.

## Files Changed

| File | Change |
|------|--------|
| `mocks/` -> `polyfills/` | Rename directory |
| `polyfills/terra.js` | Rename from terra-js-safe.js. Wire Wallet to LCD auth, add sequence(), fix Msg serialization, import terra-lcd.js |
| `polyfills/terra-lcd.js` | **New.** Fetch-based LCD client with response shaping into terra.js types |
| `polyfills/crypto.js` | Rename from crypto-shim.js. No functional change |
| `polyfills/ledger-transport-ble.js` | Move to new directory |
| `polyfills/ledger-terra-js.js` | Move to new directory |
| `metro.config.js` | Update all paths from mocks/ to polyfills/ |
| `shim.js` | Add explanatory comment on process.browser = false |
| `package.json` | Remove expo-crypto |
| `app.json` | Remove expo-crypto from plugins |
| `src/hooks/useSwapRate.ts` | Add isClassic guard before oracle call |

## Boundaries

**In scope:** Issues A-F as described above, directory rename, related useSwapRate fix.

**Out of scope (handled by another agent):**
- P0: randomBytes silent zero-fill in crypto-shim
- P0: @noble/hashes, elliptic, bech32, bip39 as direct dependencies
- P1: Replace hand-rolled BIP32 with @scure/bip32
- P1: Throw on unsupported hash algorithms in crypto-shim
