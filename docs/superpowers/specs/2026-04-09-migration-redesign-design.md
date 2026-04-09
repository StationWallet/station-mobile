# Migration Flow Redesign — Design Spec

**Date:** 2026-04-09
**Status:** Draft

## Overview

Redesign the migration/onboarding flow to match updated Figma designs. Replaces the current sequential batch migration with a per-wallet migration model, adds Rive animation intro, vault import flow, and new fast vault creation flow. The Rive animation visually transitions from Station Wallet's light aesthetic to Vultisig's dark aesthetic, telling the story of the product evolution.

This single flow replaces both the current `MigrationNavigator` and the existing new-wallet creation flow.

## Architecture

Single `MigrationNavigator` stack with all screens. No nested navigators. Navigation branches based on wallet discovery state and user choice.

### Screen Inventory

| Screen | Purpose |
|---|---|
| **RiveIntro** | Full-screen Rive animation. Plays through Station → Vultisig transition. No skip, always plays fully. Auto-navigates to MigrationHome on completion. |
| **MigrationHome** | Resting state after animation. Info card about Fast Vaults. Conditional CTA based on legacy wallet detection. |
| **WalletsFound** | Per-wallet cards with "Migrate to a vault" button. Migrated wallets show as completed fast vaults. |
| **VaultName** | Name input for new vault (create path only, skipped for migrate path). |
| **VaultEmail** | Email input (shared by migrate + create paths). |
| **VaultPassword** | Password + confirm (shared by both paths). |
| **KeygenProgress** | DKLS key import (migrate) or fresh keygen (create). |
| **VerifyEmail** | 4-digit code verification (shared). |
| **ImportVault** | File picker for .bak/.vult files + decrypt password sheet. Ported from vultiagent-app. |
| **MigrationSuccess** | "You are aboard, Station OG!" with static OG card, conditional "Migrate another wallet" link. |

### Navigation Paths

```
RiveIntro → MigrationHome
  ├── "Start Migration" → WalletsFound
  │     └── [pick wallet] → VaultEmail → VaultPassword → KeygenProgress → VerifyEmail → MigrationSuccess
  │                                                                                        └── "Migrate another wallet" → WalletsFound (if unmigrated wallets remain)
  │
  ├── "Create a Fast Vault" → VaultName → VaultEmail → VaultPassword → KeygenProgress → VerifyEmail → MigrationSuccess
  │                                                                                                       └── [link to wallets page]
  │
  └── "I already have a Fast Vault" → ImportVault → MigrationSuccess
                                                       └── [link to wallets page]
```

## Screen Details

### RiveIntro

Full-screen Rive animation using two layered files:
- `station_wallet_animation.riv` (31KB) — Station Wallet logo/connector animation (the blue USB-like icon)
- `agent_background_transition.riv` (130KB) — background transition (white → dark blue)

The animation tells the story of Station evolving into Vultisig — transitioning from the light Station style to the dark Vultisig style. No skip button; always plays fully. On completion, auto-navigates to MigrationHome.

Plays every app launch until the user completes migration or vault creation.

**Note:** Artboard names, state machine names, and inputs are unknown — will be discovered at implementation time by loading the .riv files and inspecting their metadata.

### MigrationHome

Dark background. Content:
- Rive wallet animation at top (static final frame or subtle idle loop)
- Title: **"Your seed phrase becomes a Fast Vault"**
- Info card:
  - Lightning icon + **"A new type of wallet"**
  - "Faster transactions. Stronger security. One password instead of 12 words."
  - "Fast Vaults are the next evolution of self-custody, built for what's coming to Station."
  - "Early explorers get **Station OG** status and a **$VULT airdrop**."
  - Clock icon + **"The window closes in [X] days."** (static placeholder, not wired to backend)
- Conditional primary CTA:
  - Legacy wallets found → **"Start Migration"** (blue filled button)
  - No legacy wallets → **"Create a Fast Vault"** (blue filled button)
- Secondary button: **"I already have a Fast Vault"** (outlined)
- Link: **"Learn more about Vault security"** (static placeholder, not wired yet)

### WalletsFound

Dark background. Content:
- Back button (chevron) → MigrationHome
- Title: **"Your wallets"**
- Subtitle: **"Handle each one separately."**
- Scrollable wallet card list. Each card shows:
  - Wallet name (bold, left-aligned)
  - Truncated address below name
  - Balance: **"$0.00"** (static placeholder)
  - **"Migrate to a vault"** button (blue filled, Vultisig icon) — for unmigrated wallets
  - Migrated wallets display as regular fast vault cards (no migrate button)

### VaultName (create path only)

Dark background. Content:
- Top progress bar with step icons (step 1 of creation flow)
- Title: **"Name your vault"**
- Subtitle: "No inspiration? You can always change the name in your settings later."
- Text input with clear (x) button
- "Next" button

### VaultEmail (shared)

Dark background. Content:
- Top progress bar with step icons
- Title: **"Enter your email"**
- Subtitle: "This will only be used once to send your backup file. Vultisig doesn't store any data."
- Email input
- "Next" button

### VaultPassword (shared)

Dark background. Content:
- Top progress bar with step icons
- Title: **"Choose a password"**
- Subtitle: "If you want an extra layer of security, choose a password. **Password cannot be recovered.** key-emoji"
- Password input + confirm input
- "Create vault" (create path) or "Continue" (migrate path) button

### KeygenProgress

Existing screen, updated to handle both paths:
- **Migrate path:** DKLS key import (imports existing private key into fast vault via MPC ceremony) — current behavior
- **Create path:** Fresh fast vault keygen (generates new keys via MPC ceremony with the server) — needs new service call

Both paths show the same progress bar UI. The screen receives a `mode` param (`'migrate' | 'create'`) to determine which service to call. Progress bar animation retained.

### VerifyEmail

Existing screen, no major changes beyond copy updates to match Figma.

### ImportVault

Ported from vultiagent-app (`/Users/apotheosis/git/vultisig/vultiagent-app/`). Dark background. Content:
- Back button + header: **"Import Vault"**
- Info icon (top-right)
- Central file drop zone with upload icon
- Text: **"Import your vault share"**
- Subtitle: **"Supported file types: .bak & .vult"**
- "Continue" button (disabled until file selected)

**States:**
1. **Empty** — drop zone waiting for file selection
2. **File selected** — filename badge shown, Continue enabled
3. **Error** — "Unsupported file type, please try again" (red text)
4. **Password required** — bottom sheet: "Enter Vault Share Password", password input, Continue
5. **Password error** — "Incorrect password, try again" in sheet
6. **Decrypting** — loading state
7. **Success** → navigate to MigrationSuccess

**Ported code:**
- `importVaultBackup.ts` — AES-256-GCM decryption, protobuf deserialization, VaultContainer parsing
- `useImportFlow.ts` — state machine hook (pickFile, importVault, submitPassword, resetSelection)
- UI rebuilt using station-mobile design system (VULTISIG tokens, Button/Text components)

**Dependencies to add:** `expo-document-picker`, `@noble/ciphers`, `@noble/hashes`, `@bufbuild/protobuf` (check which are already installed)

### MigrationSuccess

Dark background. Content:
- Close/X button (top-right) → wallets page
- Title: **"You are aboard, Station OG!"**
- Subtitle: **"Your vault is secured. No single key. No single point of failure."**
- OG Status card (static):
  - "Status: Station OG"
  - "#XLT Airdrop Eligible"
- Text: **"[ Entering orbit soon... ]"**
- Primary button: **"Share your OG status"** (blue filled, no-op placeholder)
- Conditional link: **"Migrate another wallet"** — only if unmigrated wallets remain → WalletsFound
- Link to wallets page (always visible)

## Rive Integration

**Package:** `rive-react-native` (new dependency)

**Asset location:** `assets/animations/station_wallet_animation.riv`, `assets/animations/agent_background_transition.riv`

**Discovery step:** At implementation start, load each .riv file and log available artboards, state machines, and inputs. Wire up based on discovered metadata.

**Additional Rive files available in vultiagent-app** (`/Users/apotheosis/git/vultisig/vultiagent-app/assets/animations/`):
- `vault_setup_device1.riv` — Landing screen animation (Figma annotation: `vault_setup_1device.riv`)
- `onboarding_success.riv` — potential success screen animation
- `keygen_fast.riv` — potential keygen progress animation
- `creating_vault_checkmark.riv` — vault creation success checkmark
- `connecting_with_server.riv` — server connection state
- `import_seedphrase.riv` — seed phrase import animation
- `splash_logo.riv` — splash/loading animation

Copy from vultiagent as needed during implementation.

**RiveIntro approach:**
- Two Rive components layered (background + foreground animation)
- Listen for animation completion event to trigger navigation
- If state machines exist, may use inputs to control transition

## New Components

| Component | Purpose |
|---|---|
| **StepProgressBar** | Top progress indicator with step icons for VaultName/Email/Password screens |
| **OGStatusCard** | Static card showing Station OG status and airdrop eligibility |
| **FileDropZone** | File picker area with empty/selected/error visual states |
| **DecryptPasswordSheet** | Bottom sheet for vault share password entry |
| **WalletMigrationCard** | Wallet card with name, address, balance, and "Migrate to a vault" button or completed state |

## App Integration

**Entry point:** `AuthNavigator` routes to `MigrationNavigator` when migration/onboarding is needed.

**Trigger conditions (show RiveIntro → MigrationHome):**
- Existing user with legacy wallets not yet migrated
- Brand new user (no wallets at all)
- Replaces old new-wallet creation flow

**RiveIntro plays every launch** until user completes migration or vault creation. Completion is tracked via the existing `vaultsUpgraded` preference flag.

**Post-completion:** Navigate to main app / wallets page.

## Styling

No new design tokens needed. Existing `VULTISIG` constants cover the dark palette:
- `VULTISIG.bg` — dark background
- `VULTISIG.card`, `VULTISIG.cardBorder` — card styling
- `VULTISIG.accent` (#33CCBB) — teal accent
- Sapphire button theme for primary CTAs

Light-to-dark transition handled entirely by Rive animation (no CSS/RN style transitions needed).

Blue accent for text (e.g., "Station is entering the Vultiverse") is part of the Rive animation content, not app-rendered text.

## Visual Reference

Design context and screenshots pulled from Figma MCP (file `puB2fsVpPrBx3Sup7gaa3v`, section "Migration old station" node `73621:97497`).

### Figma Node IDs (for future reference)

| Screen | Node ID |
|---|---|
| Landing | `73621:97616` |
| Migration Wizard 1 | `73621:97625` |
| Migration Wizard 2 (MigrationHome) | `73621:97636` |
| Wallets Found | `73621:97679` |
| Fast Vault flow section | `73621:97516` |
| Name Your Vault | `73621:97549` |
| Enter Email | `73621:97566` |
| Choose a Password | `73621:97583` |
| Migration Wizard 6 (small success) | `73621:97498` |
| You are aboard, Station OG! (full success) | `73621:97600` |
| Import Vault section | `73621:97718` |
| Migration VIDEO | `73621:97863` |

### Design Tokens (from Figma CSS variables)

**Colors:**
| Token | Variable | Hex |
|---|---|---|
| Background | `--backgrounds/background` | `#02122b` |
| Surface 1 | `--backgrounds/surface-1` | `#061b3a` |
| Surface 1-2 | `--backgrounds/surface-1-2` | `#0d2240` |
| Border light | `--borders/light` | `#11284a` |
| Border extra-light | `--borders/extra-light` | `rgba(255,255,255,0.03)` |
| Text primary | `--text/primary` | `#f0f4fc` |
| Text tertiary | `--text/tertiary` | `#8295ae` |
| Button CTA (primary) | `--buttons/cta-(primary)` | `#0b4eff` |
| Button secondary | `--buttons/secondary` | `#11284a` |
| Button text primary | `--text/button/primary-(light-light)` | `#f0f4fc` |
| Button text secondary | `--text/button/secondary-(light-dark)` | `#f0f4fc` |

**Typography (Brockmann font family):**
| Style | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Title 2 | Brockmann Medium | 22px | 500 | 24px | -0.36px |
| Title 3 | Brockmann Medium | 17px | 500 | 20px | -0.30px |
| Subtitle | Brockmann Medium | 15px | 500 | 17px | -0.18px |
| Body M (Medium) | Brockmann Medium | 16px | 500 | 24px | 0 |
| Body S (Regular) | Brockmann Regular | 14px | 400 | 20px | 0 |
| Footnote | Brockmann Medium | 13px | 500 | 18px | 0.06px |
| Caption | Brockmann Medium | 12px | 500 | 16px | 0.12px |
| Button Small | Brockmann Medium | 14px | 500 | 18px | 0 |
| Price Body L | Satoshi Medium | 20px | 500 | 20px | 0.20px |

**Spacing & Radii:**
| Element | Value |
|---|---|
| Button radius (pill) | `99px` |
| Card radius | `24px` |
| Small button radius | `30px` |
| Card padding | `20px` |
| Card gap (between cards) | `12px` |
| Section horizontal padding | `16px` |
| Card inner gap | `6px` |
| Card button height | `42px` |
| CTA button height | `46px` |
| CTA button padding | `14px 32px` |

**Rive Annotations (confirmed from Figma):**
- Node `73621:97678` (200x200 at top of MigrationHome): `data-rive-annotations="station wallet animation"`
- Node `73621:97638` (background ellipses on MigrationHome): `data-rive-annotations="agent_background_transition"`

### Key Visual Details

**MigrationHome (Wizard 2):**
- Blue radial glow background composed of 3 overlapping ellipses (Rive-rendered via `agent_background_transition`)
- Station wallet animation (200x200) positioned at top center (`top: 92px`)
- Title at `top: 310px`, 22px Brockmann Medium, centered
- Info card: surface-1 bg (`#061b3a`), border-light (`#11284a`), radius 24px, 20px padding
- Lightning bolt icon (small, ~25px) with shadow, next to "A new type of wallet" text
- Body text 13px Brockmann Medium, tertiary color, "Station OG" and "$VULT airdrop" in primary white
- Countdown bar: surface-1 bg, radius 24px, inner shadow, clock icon + "The window closes in [X] days." caption text
- "Start Migration" button: blue `#0b4eff`, pill radius 99px, 14px Brockmann Medium white text, inner shadow
- "I already have a Fast Vault" button: secondary bg `#11284a`, border extra-light, pill radius 99px, with arrow-down-circle icon
- "Learn more about Vault security" link: 14px tertiary text, underlined
- Animation annotation: "Dissolve blocks sequentially, 300ms per block, 600ms stagger, linear easing"

**WalletsFound:**
- Glassmorphic back button: 44x44, rounded, blur effect, chevron-left icon
- Title "Your wallets": 22px Brockmann Medium, white, `top: 125px`
- Subtitle: 14px Brockmann Regular, tertiary
- Wallet cards: surface-1 bg, border-light, 24px radius, 20px padding
- Card header: wallet name (16px Brockmann Medium) left, balance (20px Satoshi Medium) right
- Address: 14px Brockmann Regular, tertiary
- Divider line between address and buttons
- Export button: surface-1-2 bg (`#0d2240`), 30px radius, 42px height, flex-1
- "Migrate to a vault" button: CTA blue `#0b4eff`, 30px radius, 42px height, 175px wide, cloud-upload icon
- Cards stacked with 12px gap

## E2E Testing Strategy

All existing Detox E2E tests must be updated to match the new screen structure and testIDs. Tests must continue to perform **real** vault operations — actual DKLS ceremonies against vultiserver, real OTP verification via AgentMail, protobuf integrity checks, and persistence validation.

### Test Files to Update/Create

| Test File | What It Tests |
|---|---|
| `e2e/fast-vault-migration.test.js` | **Update:** New flow — RiveIntro → MigrationHome → "Start Migration" → WalletsFound → per-wallet migrate (Email → Password → Keygen → Verify) → Success → "Migrate another wallet" → back to WalletsFound. Must handle per-wallet flow (not batch). Verify vault integrity with DevVerifyVault. |
| `e2e/fast-vault-partial-migration.test.js` | **Update:** Same error/skip/retry flow but through new screens. Seeds corrupt data, walks through RiveIntro → MigrationHome → WalletsFound → pick wallet → fail → skip → Success. |
| `e2e/fast-vault-retry-upgrade.test.js` | **Update:** Minimal changes — upgrade from main UI uses the restyled Email/Password/Keygen/Verify screens. Update testIDs if changed. |
| `e2e/migration-onboarding.test.js` | **Update:** New flow for legacy wallet detection. RiveIntro plays, MigrationHome shows "Start Migration", walk through WalletsFound per-wallet flow. Vault integrity checks unchanged. |
| `e2e/fast-vault-creation.test.js` | **New:** Clean install → RiveIntro → MigrationHome → "Create a Fast Vault" → VaultName → VaultEmail → VaultPassword → KeygenProgress → VerifyEmail → MigrationSuccess. Verifies a brand new fast vault is created (not a migration). Uses AgentMail for OTP. Checks vault protobuf integrity. |
| `e2e/import-vault.test.js` | **New:** RiveIntro → MigrationHome → "I already have a Fast Vault" → ImportVault → pick .vult file → decrypt with password → MigrationSuccess. Requires a test .vult file to be staged in the simulator. |

### Key Test Patterns (preserved from existing tests)

1. **AgentMail OTP flow** — `e2e/helpers/agentmail.js` is reused. `migrateOneWallet()` helper needs updating for new screen flow (WalletsFound card tap instead of batch "Upgrade" button).
2. **DevVerifyVault** — the dev component rendered on MigrationSuccess that checks vault protobuf integrity. Must still be rendered and all checks must pass.
3. **Simulator erase** — tests erase the simulator before each suite to clear keychain.
4. **Persistence** — after migration, relaunch app and verify migration flow does NOT appear.
5. **Real DKLS ceremonies** — tests hit actual vultiserver (api.vultisig.com) for key import. No mocks.
6. **`migrateOneWallet` helper update** — currently navigates Email → Password → Keygen → Verify sequentially. Needs update to: tap "Migrate to a vault" on WalletsFound card → Email → Password → Keygen → Verify → Success → "Migrate another wallet" (if more wallets).

### New testIDs Required

| Screen | testID | Element |
|---|---|---|
| MigrationHome | `migration-cta` | "Start Migration" / "Create a Fast Vault" button |
| MigrationHome | `import-vault-button` | "I already have a Fast Vault" button |
| WalletsFound | `wallet-card-{N}` | Wallet card (preserved) |
| WalletsFound | `wallet-card-{N}-migrate` | "Migrate to a vault" button per card |
| WalletsFound | `wallets-back` | Back button |
| VaultName | `vault-name-input` | Name text input |
| VaultName | `vault-name-next` | Next button |
| VaultEmail | `vault-email-input` | Email text input (preserved) |
| VaultEmail | `vault-email-next` | Next button (preserved) |
| VaultPassword | `vault-password-input` | Password input (preserved) |
| VaultPassword | `vault-password-confirm` | Confirm input (preserved) |
| VaultPassword | `vault-password-continue` | Continue button (preserved) |
| KeygenProgress | `keygen-skip` | Skip button (preserved) |
| KeygenProgress | `keygen-retry` | Retry button (preserved) |
| VerifyEmail | `verify-code-input` | Code input (preserved) |
| VerifyEmail | `verify-paste` | Paste button (preserved) |
| ImportVault | `import-file-picker` | File drop zone / picker trigger |
| ImportVault | `import-continue` | Continue button |
| ImportVault | `decrypt-password-input` | Password input in sheet |
| ImportVault | `decrypt-continue` | Continue button in sheet |
| MigrationSuccess | `continue-button` | Continue to wallets (preserved) |
| MigrationSuccess | `migrate-another-wallet` | "Migrate another wallet" link |
| MigrationSuccess | `share-og-status` | "Share your OG status" button |

## Out of Scope

- Export wallet functionality (buttons not included)
- Add referral flow
- "Learn more about Vault security" destination
- "The window closes in [X] days" countdown logic (shows static placeholder)
- "Share your OG status" sharing functionality
- OG status backend verification
- Wallet balance fetching (shows $0.00)
