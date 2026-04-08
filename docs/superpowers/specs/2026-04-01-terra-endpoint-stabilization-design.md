# Terra Endpoint Stabilization

## Problem

The app depends on Terra's public API infrastructure, which is decomposing after Terraform Labs' bankruptcy. Three backend services are used across three networks (mainnet, classic, testnet). Most are failing:

| Network | LCD | FCD | API | Mantle |
|---------|-----|-----|-----|--------|
| Mainnet | 301 -> 500 | Working (partial) | 404 | Dead |
| Classic | Working (for now) | ECONNREFUSED | Dead | Dead |
| Testnet | 503 | Dead | Dead | Dead |

The app shows "Too many requests. Try again later." because it hammers the broken/redirecting endpoints on startup.

## Approach

Minimal stabilization: swap broken URLs to verified working providers, guard dead code paths, add fallbacks. Three files changed.

## Verified Replacement Endpoints

All tested and confirmed working on 2026-04-01.

### LCD (Light Client Daemon)

| Network | Old URL | New URL | Verified |
|---------|---------|---------|----------|
| Mainnet | `https://phoenix-lcd.terra.dev` | `https://terra-rest.publicnode.com` | phoenix-1, v2.19.0 |
| Classic | `https://columbus-lcd.terra.dev` | `https://terra-classic-lcd.publicnode.com` | columbus-5, v3.6.2 |
| Testnet | `https://pisco-lcd.terra.dev` | `https://terra-testnet-api.polkachu.com` | pisco-1, v2.19.0 |

### FCD (Full Client Daemon)

| Network | Old URL | Status | Action |
|---------|---------|--------|--------|
| Mainnet | `https://phoenix-fcd.terra.dev` | Working | Keep |
| Classic | `https://columbus-fcd.terra.dev` | ECONNREFUSED | Remove (no replacement exists) |
| Testnet | `https://pisco-fcd.terra.dev` | Dead | Remove (no replacement exists) |

FCD is a Terra-proprietary service with no third-party providers. Only mainnet FCD still works.

### API Service

| Network | Old URL | Status | Action |
|---------|---------|--------|--------|
| Mainnet | `https://phoenix-api.terra.dev` | 404 | Remove |
| Classic | `https://api.terra.dev` | Dead | Remove |
| Testnet | `https://pisco-api.terra.dev` | Dead | Remove |

No replacement exists. Gas prices (the only critical API call) will be redirected to FCD on mainnet and hardcoded for classic/testnet.

### Mantle (GraphQL)

Dead on all networks. Remove from config.

## Changes

### 1. `src/hooks/useNetworks.ts` — URL replacements

Replace the `defaultNetworks` config:

- **Mainnet**: lcd -> `https://terra-rest.publicnode.com`, keep fcd, remove api and mantle
- **Classic**: lcd -> `https://terra-classic-lcd.publicnode.com`, remove fcd/api/mantle
- **Testnet**: lcd -> `https://terra-testnet-api.polkachu.com`, remove fcd/api/mantle

The `ChainOptions` type may need the `api` and `mantle` fields made optional if they aren't already, since we're dropping them for networks where no replacement exists.

For classic/testnet FCD: set to the LCD URL as a placeholder. FCD-specific paths will fail gracefully but the app won't hang trying to connect to dead hosts.

### 2. `src/qureys/Terra/TerraAPI.ts` — Kill dead API service

- `useTerraAPIURL()`: Return `undefined` for all networks (API service is dead everywhere). This triggers existing fallback logic in `useTerraAPI`.
- `useGasPrices()`: Rewrite to fetch from FCD (`/v1/txs/gas_prices`) on mainnet. For classic/testnet, hardcode reasonable defaults (`{uluna: "0.015"}`).
- `useTerraValidators()`, `useTerraProposal()`, `useSumActiveWallets()`: Already have fallback support via the `fallback` parameter in `useTerraAPI`. Ensure fallbacks are provided (empty arrays/objects).

### 3. `src/hooks/useSwapRate.ts` — Guard dead market module

Add `isClassic` check. The market module was removed from Terra v2 (Phoenix) and returns 501. Only call `lcd.market.swapRate()` when `isClassic` is true. Return empty string on mainnet.

## What This Does NOT Fix

- FCD on classic/testnet is gone with no replacement. FCD-specific features (tx history, contract browsing) will not work on those networks.
- The Terra API analytics endpoint (`chart/wallets/active/sum`) has no replacement.
- No retry/backoff/failover logic is added. Public endpoints could rate-limit in the future.
- The WebView loading `https://mobile.station.terra.money` is a separate dependency not addressed here.

## Risk

Low. URL swaps are the primary change. The fallback/guard changes are defensive and match patterns already used elsewhere in the codebase (`isClassic` guards in `oracle.ts`).
