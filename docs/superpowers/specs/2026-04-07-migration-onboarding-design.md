# Migration Onboarding Flow — Design Spec

## Overview

Redesign the onboarding experience for users upgrading from the legacy Station app to the new Expo-based Vultisig app. When a user opens the app for the first time and legacy wallets are detected, those wallets are automatically migrated with a polished, animated flow that feels magical. Post-migration, users land in a minimal wallet viewer with Vultisig branding and a teaser for the upcoming Vaultie agent.

## Goals

- Legacy wallet migration should feel instant and magical — no user input required
- Single "Upgrade" button; no secondary options on the discovery screen
- Post-migration app is a minimal wallet viewer (wallet list, Luna balances, vault export)
- Vault export is a secondary action inside wallet detail, not front-and-center
- Vaultie agent hype card signals the app's future direction
- Detox E2E test coverage for the full migration flow
- `.vult` file format is the foundation for future multi-chain support

## Non-Goals

- Multi-chain address derivation (EdDSA chains) — deferred, proto already supports it
- Full wallet functionality (send, swap, staking) — this is a migration/viewer app
- Bulk vault export — individual export per wallet only

---

## Architecture: Approach B — Dedicated MigrationNavigator

A self-contained navigation stack handles the migration flow, cleanly separated from existing auth and main app flows. This enables isolated Detox testing, avoids polluting existing flows with branching logic, and can be surgically removed when the migration window closes.

### Navigation Routing

```
App Launch
  |
  v
migrateLegacyKeystore()  [existing — copies legacy keystore to expo-secure-store]
  |
  v
Root Navigator reads auth data + checks `vaultsUpgraded` preference
  |
  +-- Legacy wallets found, vaultsUpgraded === false
  |     --> MigrationNavigator
  |
  +-- No wallets at all (fresh install)
  |     --> AuthNavigator (existing create/recover flow)
  |
  +-- Wallets exist, vaultsUpgraded === true
        --> MainNavigator (existing wallet list/home)
```

### New Preference Flag

`PreferencesEnum.vaultsUpgraded` (boolean, default `false`) — set to `true` when migration completes. Controls whether the MigrationNavigator is shown.

---

## Migration Screens

### 1. WalletDiscovery

**Purpose**: Show the user what legacy wallets were found, with a single "Upgrade" CTA.

**Data**:
- Reads auth data from `expo-secure-store` via `getAuthData()`
- Extracts wallet entries: name, Terra address, Ledger flag

**UI**:
- Vultisig logo/branding header
- Wallet cards stagger-animate in from below with spring physics
- Each card shows: wallet name, truncated Terra address (`terra1...xxxx`), Ledger badge if applicable
- "Upgrade" button fades in after the last card lands
- No secondary options, no export link, no skip

**Behavior**:
- Tapping "Upgrade" navigates to MigrationProgress with the full wallet list

### 2. MigrationProgress

**Purpose**: Animated sequence showing wallets being migrated. The actual work is near-instant but the animation creates the "magic" feeling.

**Data pipeline per wallet**:
1. Read `{ encryptedKey, password }` from auth data
2. `decryptKey(encryptedKey, password)` -> raw private key hex
3. `derivePublicKeyHex(privateKey)` -> compressed secp256k1 public key (33 bytes)
4. Build `Vault` protobuf:
   - `name`: wallet name
   - `publicKeyEcdsa`: derived public key hex
   - `publicKeyEddsa`: `""` (deferred — EdDSA chains come later)
   - `libType`: `LibType.KEYIMPORT`
   - `keyShares`: `[{ publicKey, keyshare: privateKeyHex }]`
   - `chainPublicKeys`: `[{ chain: "Terra", publicKey, isEddsa: false }]`
   - `hexChainCode`: `""`
   - `localPartyId`: `"station-mobile"`
   - `signers`: `["station-mobile"]`
5. Serialize vault protobuf to binary (unencrypted)
6. Store in secure storage for later export

**For Ledger wallets**: No decryption needed. Migrate address + derivation path only. Build vault protobuf with address info but no key material.

**Animation**:
- Smooth shared-element-style transition from WalletDiscovery
- Each wallet card gets a pulsing glow effect while processing
- Satisfying checkmark animation (Lottie or reanimated) on completion
- Subtle shimmer/particle effect ties it together
- Minimum ~500-800ms delay per wallet so animations can breathe
- All animations via `react-native-reanimated` for 60fps native-driven performance

**Behavior**:
- No user interaction during migration — purely visual
- On completion, auto-navigates to MigrationSuccess

### 3. MigrationSuccess

**Purpose**: Celebration moment + Vaultie agent teaser.

**UI**:
- Success icon scales up with bounce animation
- "Wallets Upgraded" headline
- List of migrated wallet names with checkmarks (fade in)
- Vaultie agent teaser card slides up from below:
  - "Vultisig Agent is coming to this app"
  - Brief hype copy + visual treatment
- "Continue" CTA button

**Behavior**:
- Tapping "Continue" sets `vaultsUpgraded = true` in preferences
- `navigation.reset()` to MainNavigator (prevents back-swipe into migration)

---

## Post-Migration Main App

### Wallet List / Home

- Restyled with Vultisig brand identity (colors, typography, card design)
- Each wallet card: name, Terra address, Luna balance
- Tapping a wallet navigates to Wallet Detail
- "Vultisig Agent coming soon" card — persistent, dismissible but returns on next app open (until a future update removes it)

### Wallet Detail

- Balance display, Terra address, receive QR code (existing functionality)
- "Export Vault" action — secondary placement (icon button in header or a section below the primary info)
- Export flow:
  1. User taps Export Vault
  2. User sets an export password
  3. Vault protobuf is encrypted with AES-256-GCM using that password
  4. Wrapped in VaultContainer, written as `.vult` file
  5. System share sheet opens

### Visual Identity

All screens adopt the Vultisig main brand identity — matching the desktop/iOS Vultisig app look and feel.

---

## Vault Data Architecture

### Storage

- **Pre-migration**: Auth data JSON in expo-secure-store under key `AD` (encrypted private keys + stored passwords)
- **Post-migration**: Vault protobuf binary (serialized, unencrypted) stored in expo-secure-store under key `VAULT-{walletName}`. Device keychain protects it at rest. Original auth data is preserved (still needed for Luna balance lookups and wallet functionality).
- **At export time**: Vault protobuf read from secure store, encrypted with user-chosen password via AES-256-GCM, wrapped in VaultContainer -> `.vult` file

### Future Multi-Chain Extension

The `.vult` format is ready for multi-chain expansion:
- `publicKeyEddsa` field exists in the proto — populate it when Ed25519 support is added
- `chainPublicKeys` array supports any number of chain entries with `isEddsa` flag
- Same secp256k1 public key derives addresses for all ECDSA chains (Bitcoin, Ethereum, Cosmos, EVM chains, etc.) — downstream Vultisig apps handle chain-specific address encoding
- No schema changes needed when adding new chains

---

## Detox E2E Testing

### Test Infrastructure

- Detox utility to seed legacy keystore data (write known wallet entries to expo-secure-store / native keystore) in test harness `beforeEach`
- Tests run against debug build with legacy keystore native module available
- Preference flags (`vaultsUpgraded`, `skipOnboarding`) reset before each test

### Test Cases

1. **Single wallet migration**: Seed one legacy wallet -> assert WalletDiscovery shows it -> tap Upgrade -> assert progress animation plays -> assert success screen shows wallet name with checkmark -> tap Continue -> assert landing on wallet home with correct wallet

2. **Multiple wallet migration**: Seed 3 wallets -> assert all appear on discovery -> Upgrade -> assert all migrate successfully -> assert all appear on wallet home

3. **Ledger wallet handling**: Seed a Ledger-type wallet -> assert it appears on discovery with Ledger badge -> verify it migrates correctly (address + path, no decryption)

4. **Clean install (no legacy wallets)**: No legacy data seeded -> assert app skips migration flow entirely -> lands on AuthNavigator

5. **Already migrated**: Set `vaultsUpgraded = true` -> assert app skips migration -> goes straight to MainNavigator

---

## Key Files (Existing)

| File | Role |
|------|------|
| `src/App/index.tsx` | App entry, startup sequence |
| `src/App/OnBoarding.tsx` | Current onboarding (will be bypassed for migration users) |
| `src/navigation/index.tsx` | Root navigator (add migration routing) |
| `src/utils/legacyMigration.ts` | Legacy keystore migration (unchanged) |
| `src/utils/authData.ts` | Auth data CRUD |
| `src/utils/wallet.ts` | Wallet operations, key decryption |
| `src/services/exportVaultShare.ts` | Vault export (reuse for export action) |
| `src/nativeModules/preferences.ts` | Preference flags (add vaultsUpgraded) |
| `src/proto/vultisig/vault/v1/vault_pb.ts` | Vault protobuf schema |

## New Files

| File | Role |
|------|------|
| `src/navigation/MigrationNavigator.tsx` | Migration stack navigator |
| `src/screens/migration/WalletDiscovery.tsx` | Discovered wallets + Upgrade button |
| `src/screens/migration/MigrationProgress.tsx` | Animated migration sequence |
| `src/screens/migration/MigrationSuccess.tsx` | Success + Vaultie teaser |
| `src/services/migrateToVault.ts` | Core migration logic (decrypt -> vault protobuf -> store) |
| `e2e/migration.test.ts` | Detox E2E tests |
| `e2e/utils/seedLegacyWallets.ts` | Test utility to seed legacy wallet data |
