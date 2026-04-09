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

## Out of Scope

- Export wallet functionality (buttons not included)
- Add referral flow
- "Learn more about Vault security" destination
- "The window closes in [X] days" countdown logic (shows static placeholder)
- "Share your OG status" sharing functionality
- OG status backend verification
- Wallet balance fetching (shows $0.00)
