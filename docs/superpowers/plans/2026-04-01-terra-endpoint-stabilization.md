# Terra Endpoint Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken Terra API endpoints with verified working providers so the app loads without "Too many requests" errors.

**Architecture:** Swap LCD URLs to PublicNode/Polkachu, keep working mainnet FCD, stub dead FCD/mantle with LCD URLs, kill dead API service with fallbacks, guard market module calls with isClassic.

**Tech Stack:** React Native, Expo 55, axios, react-query, @terra-money/terra.js

---

## File Map

- Modify: `src/hooks/useNetworks.ts` — network URL config
- Modify: `src/qureys/Terra/TerraAPI.ts` — dead API service + gas prices
- Modify: `src/hooks/useSwapRate.ts` — market module guard
- Modify: `src/lib/types/app/config.ts` — make mantle optional in ChainOptions

---

### Task 1: Update ChainOptions type

**Files:**
- Modify: `src/lib/types/app/config.ts:63-70`

- [ ] **Step 1: Make mantle optional in ChainOptions**

In `src/lib/types/app/config.ts`, change the `ChainOptions` interface:

```typescript
export interface ChainOptions {
  name: NetworkEnum
  chainID: string
  lcd: string
  fcd: string
  mantle?: string
  walletconnectID: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/app/config.ts
git commit -m "refactor: make mantle optional in ChainOptions type"
```

---

### Task 2: Replace network endpoint URLs

**Files:**
- Modify: `src/hooks/useNetworks.ts:7-35`

- [ ] **Step 1: Update defaultNetworks config**

Replace the entire `defaultNetworks` object in `src/hooks/useNetworks.ts`:

```typescript
const defaultNetworks: Record<NetworkEnum, ChainOptions> = {
  mainnet: {
    name: NetworkEnum.mainnet,
    chainID: 'phoenix-1',
    lcd: 'https://terra-rest.publicnode.com',
    fcd: 'https://phoenix-fcd.terra.dev',
    walletconnectID: 1
  },
  classic: {
    name: NetworkEnum.classic,
    chainID: 'columbus-5',
    lcd: 'https://terra-classic-lcd.publicnode.com',
    fcd: 'https://terra-classic-lcd.publicnode.com',
    walletconnectID: 2
  },
  testnet: {
    name: NetworkEnum.testnet,
    chainID: 'pisco-1',
    lcd: 'https://terra-testnet-api.polkachu.com',
    fcd: 'https://terra-testnet-api.polkachu.com',
    walletconnectID: 0
  }
}
```

Changes:
- Mainnet LCD: `phoenix-lcd.terra.dev` -> `terra-rest.publicnode.com`
- Classic LCD: `columbus-lcd.terra.dev` -> `terra-classic-lcd.publicnode.com`
- Classic FCD: `columbus-fcd.terra.dev` -> LCD URL (FCD is dead, LCD as fallback)
- Testnet LCD: `pisco-lcd.terra.dev` -> `terra-testnet-api.polkachu.com`
- Testnet FCD: `pisco-fcd.terra.dev` -> LCD URL (FCD is dead, LCD as fallback)
- Removed `api` field (not in ChainOptions type, was extra)
- Removed `mantle` field (dead on all networks, now optional in type)

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNetworks.ts
git commit -m "fix: replace broken Terra LCD endpoints with PublicNode/Polkachu"
```

---

### Task 3: Kill dead API service, fix gas prices

**Files:**
- Modify: `src/qureys/Terra/TerraAPI.ts:27-74`

- [ ] **Step 1: Make useTerraAPIURL return undefined**

Replace `useTerraAPIURL` (lines 27-34):

```typescript
export const useTerraAPIURL = (_network?: string) => {
  // Terra API service (phoenix-api.terra.dev) is dead on all networks.
  // TFL infrastructure shut down after bankruptcy.
  return undefined
}
```

- [ ] **Step 2: Rewrite useGasPrices to use FCD**

Replace `useGasPrices` (lines 60-74):

```typescript
export const useGasPrices = () => {
  return useQuery(
    [queryKey.TerraAPI, 'gas-prices'],
    async () => {
      try {
        const { data } = await axios.get<GasPrices>(
          'https://phoenix-fcd.terra.dev/v1/txs/gas_prices'
        )
        return data
      } catch {
        return { uluna: '0.015' } as GasPrices
      }
    },
    { ...RefetchOptions.INFINITY }
  )
}
```

- [ ] **Step 3: Ensure fallbacks on validators/proposals/charts**

Verify these already pass fallbacks (they do):
- `useTerraValidators()` passes `[]` as fallback
- `useTerraProposal()` has no fallback — add empty array

Replace `useTerraProposal` (line 99-101):

```typescript
export const useTerraProposal = (id: number) => {
  return useTerraAPI<TerraProposalItem[]>(`proposals/${id}`, undefined, [])
}
```

- [ ] **Step 4: Commit**

```bash
git add src/qureys/Terra/TerraAPI.ts
git commit -m "fix: remove dead Terra API service, redirect gas prices to FCD"
```

---

### Task 4: Guard market module in useSwapRate

**Files:**
- Modify: `src/hooks/useSwapRate.ts:1-31`

- [ ] **Step 1: Add isClassic guard**

Replace the full file:

```typescript
import { Coin } from '@terra-money/terra.js'
import { UTIL } from 'consts'
import { uToken } from 'types'
import { useIsClassic } from 'lib'
import useLCD from './useLCD'

export const useSwapRate = (): {
  getSwapAmount: (
    offerCoin: Coin,
    askDenom: string
  ) => Promise<uToken>
} => {
  const lcd = useLCD()
  const isClassic = useIsClassic()

  const getSwapAmount = async (
    offerCoin: Coin,
    askDenom: string
  ): Promise<uToken> => {
    if (
      !isClassic ||
      offerCoin.denom === askDenom ||
      UTIL.isIbcDenom(offerCoin.denom)
    ) {
      return '' as uToken
    }

    const result = await lcd.market.swapRate(offerCoin, askDenom)
    return result.amount.toString() as uToken
  }

  return { getSwapAmount }
}
```

Change: added `useIsClassic` import and `!isClassic` to the early-return guard.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSwapRate.ts
git commit -m "fix: guard market.swapRate with isClassic check (module removed from Terra v2)"
```

---

### Task 5: Verify the app builds

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no type errors related to the changed files.

- [ ] **Step 2: Commit all changes if any fixups needed**
