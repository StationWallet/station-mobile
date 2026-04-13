# Wallet List Consolidation Design

**Date:** 2026-04-13
**Status:** Approved

## Summary

Consolidate the "Select Wallet" screen (`WalletPicker`) and "Your wallets" migration screen (`WalletsFound`) into a single `WalletList` screen. Remove `WalletHome` entirely. The new screen becomes the sole wallet management surface in the app — handling wallet selection, migration entry, export, and deletion.

## Motivation

The current app has three overlapping wallet screens:
- `WalletPicker` — select/switch wallets, upgrade legacy wallets
- `WalletsFound` — migration-specific wallet list with per-wallet migration status
- `WalletHome` — wallet detail with balance, receive, history, export, delete

These should be one screen. The "Your wallets" pattern from the migration flow is the right model: a card-based list showing each wallet with its status and available actions.

## Design

### New `WalletList` Screen

**File:** `src/screens/WalletList.tsx`

The initial (and only) wallet screen in `MainNavigator`. Renders:

- **Header:** "Your wallets" title, subtitle with wallet count
- **Scrollable list of `WalletCard` components**, one per wallet
- **Footer:** "Add Wallet" button → navigates to `AddWalletMenu`

### New `WalletCard` Component

**File:** `src/components/WalletCard.tsx`

Each card displays:
- Wallet name (with "Terra only" tag for migrated Fast Vaults that were created from a leaf private key — these vaults only support Terra since only the single-chain key was available during migration, not a full seed phrase for multi-chain derivation)
- Truncated address
- Balance (right-aligned)
- Divider
- Button row:
  - "Export" button (secondary style) — navigates to `ExportPrivateKey`
  - Migration status: green "Fast Vault" badge if migrated, blue "Migrate to a vault" button if legacy
- Delete affordance (trash icon) — triggers alert confirmation

**Tap behavior (entire card):**
- **Legacy wallet:** Selects wallet (saves to settings), starts migration flow (navigates to `VaultEmail`)
- **Migrated (Fast Vault) wallet:** Selects wallet (saves to settings), navigates to `MigrationSuccess`

### Delete Flow

Triggered from trash icon on each card:
1. Alert: "Remove Wallet — This will remove the wallet from this device. Make sure you have your seed phrase backed up."
2. Cancel / Remove (destructive)
3. On confirm: `deleteWallet({ walletName })` → `onWalletDisconnected()`
4. If wallets remain: list refreshes on `WalletList`. If none: routes to Auth/Migration.

### Export Flow

"Export" button navigates to `ExportPrivateKey` screen (existing), which handles:
- **Fast Vault:** Prompt for encryption password → `exportVaultShare()` → share sheet with `.vult` file
- **Legacy:** Prompt for wallet password (decrypt key), then encryption password → `exportVaultShare()` → share sheet

### Navigation Changes

**MainNavigator (`src/navigation/MainNavigator.tsx`):**
- Initial screen: `WalletList` (replaces conditional WalletPicker/WalletHome logic)
- Remove from stack params: `WalletPicker`, `WalletHome`, `Receive`, `History`
- Keep: `WalletList`, `ExportPrivateKey`, `AddWalletMenu`, `AddNewWallet`, `AddRecoverWallet`, `Migration` (nested), dev screens

**AppNavigator (`src/navigation/index.tsx`):**
- Simplify `pickInitialWallet` — no longer needed to choose between WalletPicker and WalletHome
- `onWalletDisconnected`: return to `WalletList` if wallets remain, Auth if empty
- `onMigrationComplete`: transition to Main route → lands on `WalletList`

**MigrationNavigator (`src/navigation/MigrationNavigator.tsx`):**
- Remove `WalletsFound` screen from the stack
- Rest of migration flow unchanged (VaultEmail → VaultPassword → KeygenProgress → VerifyEmail → MigrationSuccess)

**MigrationSuccess (`src/screens/migration/MigrationSuccess.tsx`):**
- Now reachable from two paths: tapping a migrated wallet on `WalletList`, or completing a migration
- "Migrate another wallet" → `onMigrationComplete` → returns to `WalletList`
- "Continue to wallets" → same behavior
- Back button → same behavior
- No behavioral changes needed — both paths converge on the same screen

### Files Changed

**New:**
- `src/screens/WalletList.tsx`
- `src/components/WalletCard.tsx`

**Deleted:**
- `src/screens/WalletPicker.tsx`
- `src/screens/WalletHome.tsx`
- `src/screens/migration/WalletsFound.tsx`
- `src/components/migration/WalletMigrationCard.tsx`

**Modified:**
- `src/navigation/MainNavigator.tsx` — new initial screen, remove old screens from params
- `src/navigation/MigrationNavigator.tsx` — remove WalletsFound
- `src/navigation/index.tsx` — simplify routing logic
- `src/screens/migration/MigrationSuccess.tsx` — handle dual entry, navigate back to WalletList
- `src/screens/ExportPrivateKey.tsx` — minor adjustments if needed for direct vault share export

**Untouched:**
- Migration flow screens (VaultEmail, VaultPassword, KeygenProgress, VerifyEmail)
- Export/import utilities (exportVaultShare.ts, importVaultBackup.ts)
- Wallet utilities (wallet.ts)
- AddWalletMenu and related screens
