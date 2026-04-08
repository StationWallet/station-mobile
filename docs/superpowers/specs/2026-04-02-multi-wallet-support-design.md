# Multi-Wallet Support

**Date:** 2026-04-02
**Branch:** feat/expo-migration

## Problem

The app currently shows `wallets[0]` blindly — no way to select, switch, or add wallets. The data layer supports multiple wallets (stored as a JSON object keyed by name), but the UI assumes a single wallet. Users who had multiple wallets in the old Station app would only see the first one.

## Goal

Users can view all their wallets, switch between them, and create additional ones — matching the capabilities of the old app.

## Design

### App Launch Flow

```
App init
  ↓
getWallets()
  ↓
0 wallets → AuthNavigator (create/recover) [existing, unchanged]
  ↓
1 wallet → WalletHome (auto-select, skip picker) 
  ↓
2+ wallets → check settings.walletName
  ↓
  ├── last-used wallet found → WalletHome with that wallet
  └── not found → WalletPicker
```

No password required to view a wallet. The address is stored unencrypted — password is only needed for signing (future Send flow). This matches the old app's behavior where wallet viewing was immediate after selection.

### Navigation Structure

```
AppNavigator
├── AuthNavigator (no wallets exist)
│   ├── AuthMenu
│   ├── NewWallet stack
│   └── RecoverWallet stack
└── MainNavigator (wallets exist)
    ├── WalletPicker (2+ wallets, no last-used remembered)
    ├── WalletHome (selected wallet)
    ├── Receive
    └── History
```

`MainNavigator` always has `WalletHome` as the initial route. If there are 2+ wallets and no remembered selection, `WalletPicker` is pushed on top immediately.

### Screens

#### WalletPicker (new)

Shown when the user has multiple wallets and needs to choose one.

- List of all wallets, each showing:
  - Wallet name
  - Truncated address
  - Ledger badge if applicable
- Tap a wallet → navigate to WalletHome with that wallet
- "Add Wallet" button at the bottom → navigate to AuthNavigator for create/recover flow
- No back button (this is the root when no wallet is selected)

#### WalletHome (modified)

Currently loads `wallets[0]`. Changes:

- Accept selected wallet via route param OR fall back to remembered wallet OR first wallet
- Add wallet name as header
- Replace "Disconnect Wallet" with a wallet management section:
  - "Switch Wallet" (if 2+ wallets exist) → navigates to WalletPicker
  - "Add Wallet" → navigates to create/recover flow
  - "Remove Wallet" → confirmation alert, deletes wallet, handles navigation:
    - If other wallets remain → WalletPicker
    - If no wallets remain → AuthNavigator
- Save selected wallet name to `settings.walletName` when a wallet is selected

#### AuthMenu (modified)

Currently only accessible when zero wallets exist. Needs to also be reachable from WalletPicker/WalletHome for adding wallets. Two modes:

- **No wallets (current)**: Shows as the root screen in AuthNavigator
- **Adding a wallet**: Pushed onto MainNavigator's stack. After wallet creation, pops back (instead of triggering `onWalletCreated` which switches navigators)

### Data Flow

**Selecting a wallet:**
1. User taps wallet in WalletPicker (or auto-selected on launch)
2. Save wallet name to `settings.walletName`
3. Navigate to WalletHome with `{ wallet: { name, address } }` param

**Remembering last wallet:**
- On launch: read `settings.walletName`, look up in `getWallets()`
- If found → auto-navigate to WalletHome with that wallet
- If not found (deleted, or first launch) → WalletPicker (if 2+ wallets) or first wallet

**Adding a wallet (from MainNavigator):**
1. Navigate to embedded create/recover flow
2. On success → wallet is now in keystore
3. Pop back to WalletPicker or WalletHome
4. Refresh wallet list

**Removing a wallet:**
1. Confirmation alert with warning about seed phrase backup
2. `deleteWallet({ walletName })`
3. If last wallet → `onWalletDisconnected()` → AuthNavigator
4. If other wallets remain → navigate to WalletPicker

### State Management

The existing `WalletNavContext` in `navigation/index.tsx` is extended:

```typescript
interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  wallets: LocalWallet[]
  refreshWallets: () => Promise<void>
}
```

`wallets` and `refreshWallets` are needed so child screens can access the current wallet list without each fetching independently. The list is loaded once in `AppNavigator` and refreshed after create/delete operations.

## Files Changed

| File | Change |
|------|--------|
| `src/screens/WalletPicker.tsx` | **New.** Wallet list with tap-to-select and "Add Wallet" button. |
| `src/screens/WalletHome.tsx` | Accept wallet via route params. Add Switch/Add/Remove wallet options. Save last-used wallet to settings. |
| `src/navigation/index.tsx` | Load wallet list. Auto-select logic (1 wallet → skip picker, 2+ → check settings). Extend WalletNavContext with wallets + refreshWallets. |
| `src/navigation/MainNavigator.tsx` | Add WalletPicker and AddWallet routes. |
| `src/screens/auth/NewWallet/WalletCreated.tsx` | Detect whether adding to existing wallets (pop back) vs first wallet (onWalletCreated). |
| `src/screens/auth/RecoverWallet/WalletRecovered.tsx` | Same as above. |

## Out of Scope

- Password/biometric authentication on wallet select (no private key access needed for read-only)
- Wallet rename
- Wallet reordering
- Ledger wallet functional support (badge only)
