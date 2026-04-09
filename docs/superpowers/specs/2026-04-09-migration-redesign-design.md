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

## Visual Reference

Figma screenshots saved to `docs/designs/migration/` are the source of truth for visual implementation. Reference these during implementation for pixel-level accuracy.

| File | Screens Shown |
|---|---|
| `01-landing-wizard.png` | Landing (white, Station logo centered), Migration Wizard 1 (white bg, Rive USB connector, "Station is entering the Vultiverse"), Migration VIDEO frame |
| `02-wizard2-wallets.png` | Migration Wizard 2 (dark bg, blue glow, info card, CTAs), Wallets Found (dark bg, wallet cards with balance + migrate buttons) |
| `03-vault-flow-import-success.png` | Fast Vault flow (Name/Email/Password with top step bar), Success screens ("You are aboard, Station OG!"), Import Vault flow (file picker, decrypt password sheet) |

### Key Visual Details from Figma

**Color palette (dark screens):**
- Background: deep navy (~#0B1426 or matching VULTISIG.bg)
- Cards: slightly lighter navy (#0D1F3C) with subtle teal-tinted border
- Primary buttons: bright blue filled (#3366FF or similar — NOT the teal accent, this is a blue)
- Secondary buttons: outlined with same blue, transparent fill
- Text: white primary, gray secondary
- Blue glow effect at top of MigrationHome screen (radial gradient or Rive-rendered)

**MigrationHome info card:**
- Rounded corners (~16px), subtle border
- Interior sections separated by spacing, not dividers
- Lightning bolt icon (yellow/gold) next to "A new type of wallet"
- Clock icon (teal) next to countdown text
- Bold treatment on "Station OG" and "$VULT airdrop" within body text

**WalletsFound wallet cards:**
- Full-width cards with rounded corners
- Wallet name (white, bold, left) + balance (white, bold, right-aligned)
- Truncated address below name in gray
- Two buttons at bottom of each card: "Export" (outlined, skip this) and "Migrate to a vault" (blue filled with Vultisig swirl icon)
- Cards have dark card background with subtle border

**Fast Vault creation step bar:**
- Horizontal bar at top with circular step icons
- Icons represent each step (vault, name, email, password)
- Active step highlighted, completed steps checked
- Thin connecting line between steps

**MigrationSuccess:**
- Dark background, centered layout
- Small Vultisig icons at top (vault/email/check row)
- Close X in top-right corner
- OG status card with rounded corners, centered
- Card contains "Status: Station OG" and "#XLT Airdrop Eligible" text
- "[ Entering orbit soon... ]" in muted text below card
- "Share your OG status" primary blue button
- "Migrate another wallet" as text link below

**ImportVault:**
- Header bar with back chevron, "Import Vault" title, info icon right
- Large central drop zone area with dashed/subtle border
- Upload/link icon centered in drop zone
- "Import your vault share" text below zone
- File type note in gray
- "Continue" button at bottom
- Password sheet slides up as bottom sheet modal with lock icon

## Out of Scope

- Export wallet functionality (buttons not included)
- Add referral flow
- "Learn more about Vault security" destination
- "The window closes in [X] days" countdown logic (shows static placeholder)
- "Share your OG status" sharing functionality
- OG status backend verification
- Wallet balance fetching (shows $0.00)
