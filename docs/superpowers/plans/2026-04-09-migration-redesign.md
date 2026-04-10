# Migration Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the migration/onboarding flow with Rive animation intro, per-wallet migration, vault import, and fast vault creation — matching the updated Figma designs.

**Architecture:** Single `MigrationNavigator` stack with 10 screens. Navigation branches at MigrationHome based on legacy wallet detection and user choice. Replaces both the current MigrationNavigator and NewWalletStack. All dark-theme screens use updated Figma design tokens (Brockmann font, `#0b4eff` blue CTA, `#02122b` background).

**Tech Stack:** React Native, react-navigation, rive-react-native, expo-document-picker, react-native-reanimated, @noble/ciphers, @bufbuild/protobuf

**Spec:** `docs/superpowers/specs/2026-04-09-migration-redesign-design.md`
**Figma screenshots:** `docs/designs/migration/*.png` (13 screens at 2x)

---

## File Structure

### New files:
- `assets/fonts/Brockmann-Regular.otf` — copied from vultiagent-app
- `assets/fonts/Brockmann-Medium.otf` — copied from vultiagent-app
- `assets/fonts/Brockmann-SemiBold.otf` — copied from vultiagent-app
- `assets/fonts/Brockmann-Bold.otf` — copied from vultiagent-app
- `assets/fonts/Satoshi-Medium.otf` — copied from vultiagent-app
- `assets/animations/station_wallet_animation.riv` — from user downloads
- `assets/animations/agent_background_transition.riv` — from user downloads
- `assets/animations/vault_setup_device1.riv` — copied from vultiagent-app
- `src/consts/migration.ts` — design tokens for migration screens (Figma values)
- `src/components/migration/StepProgressBar.tsx` — step icons for vault creation flow
- `src/components/migration/WalletMigrationCard.tsx` — wallet card with migrate button
- `src/components/migration/InfoCard.tsx` — "A new type of wallet" info card
- `src/components/migration/OGStatusCard.tsx` — static OG status card for success screen
- `src/components/migration/FileDropZone.tsx` — file picker drop zone
- `src/components/migration/DecryptPasswordSheet.tsx` — bottom sheet for vault share password
- `src/components/migration/GlassButton.tsx` — glassmorphic circular back/action button
- `src/screens/migration/RiveIntro.tsx` — full-screen Rive animation
- `src/screens/migration/MigrationHome.tsx` — "Your seed phrase becomes a Fast Vault"
- `src/screens/migration/VaultName.tsx` — name input for create path
- `src/screens/migration/ImportVault.tsx` — file picker + decrypt flow
- `src/services/importVaultBackup.ts` — AES-GCM decrypt + protobuf parse (ported from vultiagent)
- `src/hooks/useImportFlow.ts` — import state machine hook (ported from vultiagent)

### Modified files:
- `package.json` — add rive-react-native, expo-document-picker
- `src/consts/vultisig.ts` — add Figma-sourced color tokens
- `src/components/Text.tsx` — add Brockmann/Satoshi font families
- `src/components/Button.tsx` — add `ctaBlue` and `secondaryDark` themes
- `src/navigation/MigrationNavigator.tsx` — complete rewrite with new screens
- `src/navigation/index.tsx` — update routing logic for new onboarding flow
- `src/screens/migration/WalletDiscovery.tsx` — rename/rewrite to WalletsFound
- `src/screens/migration/VaultEmail.tsx` — restyle with Figma tokens + step bar
- `src/screens/migration/VaultPassword.tsx` — restyle with Figma tokens + step bar
- `src/screens/migration/KeygenProgress.tsx` — add `mode` param (migrate vs create)
- `src/screens/migration/VerifyEmail.tsx` — copy updates
- `src/screens/migration/MigrationSuccess.tsx` — complete redesign with OG card

---

### Task 1: Install Dependencies & Copy Assets

**Files:**
- Modify: `package.json`
- Create: `assets/fonts/Brockmann-Regular.otf`, `assets/fonts/Brockmann-Medium.otf`, `assets/fonts/Brockmann-SemiBold.otf`, `assets/fonts/Brockmann-Bold.otf`, `assets/fonts/Satoshi-Medium.otf`
- Create: `assets/animations/station_wallet_animation.riv`, `assets/animations/agent_background_transition.riv`, `assets/animations/vault_setup_device1.riv`

- [ ] **Step 1: Install npm packages**

```bash
npx expo install rive-react-native expo-document-picker
```

- [ ] **Step 2: Copy font files from vultiagent-app**

```bash
mkdir -p assets/fonts
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/fonts/Brockmann-Regular.otf assets/fonts/
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/fonts/Brockmann-Medium.otf assets/fonts/
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/fonts/Brockmann-SemiBold.otf assets/fonts/
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/fonts/Brockmann-Bold.otf assets/fonts/
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/fonts/Satoshi-Medium.otf assets/fonts/
```

- [ ] **Step 3: Copy Rive animation files**

```bash
mkdir -p assets/animations
cp /Users/apotheosis/Downloads/station_wallet_animation.riv assets/animations/
cp /Users/apotheosis/Downloads/agent_background_transition.riv assets/animations/
cp /Users/apotheosis/git/vultisig/vultiagent-app/assets/animations/vault_setup_device1.riv assets/animations/
```

- [ ] **Step 4: Register fonts with Expo**

Check how fonts are currently loaded in the app (likely via `expo-font` or `react-native.config.js`). Add the new font files to the same mechanism. If using `react-native.config.js`:

```js
// react-native.config.js — add to assets array
module.exports = {
  assets: ['./assets/fonts'],
};
```

Then run:
```bash
npx react-native-asset
```

- [ ] **Step 5: Verify installation compiles**

```bash
npx expo start --clear
```

Expected: App starts without errors. Rive and document picker packages resolve.

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock assets/fonts/ assets/animations/ react-native.config.js
git commit -m "chore: add rive-react-native, expo-document-picker, Brockmann/Satoshi fonts, Rive assets"
```

---

### Task 2: Design Tokens & Component Updates

**Files:**
- Create: `src/consts/migration.ts`
- Modify: `src/consts/vultisig.ts`
- Modify: `src/components/Text.tsx`
- Modify: `src/components/Button.tsx`

- [ ] **Step 1: Create migration design tokens**

Create `src/consts/migration.ts` with exact Figma values:

```typescript
/**
 * Design tokens from Figma "Migration old station" section.
 * These match the Vultisig dark theme used across all migration screens.
 * See: docs/designs/migration/*.png for visual reference.
 */
export const MIGRATION = {
  // Backgrounds
  bg: '#02122b',
  surface1: '#061b3a',
  surface1_2: '#0d2240',

  // Borders
  borderLight: '#11284a',
  borderExtraLight: 'rgba(255,255,255,0.03)',

  // Text
  textPrimary: '#f0f4fc',
  textTertiary: '#8295ae',
  textLink: '#4879fd',

  // Buttons
  ctaBlue: '#0b4eff',
  buttonSecondary: '#11284a',
  buttonDisabled: '#0b1a3a',

  // Station brand (for landing/wizard 1)
  stationBlue: '#2044b5',

  // Radii
  radiusPill: 99,
  radiusCard: 24,
  radiusSmallButton: 30,

  // Spacing
  screenPadding: 16,
  cardPadding: 20,
  cardGap: 12,

  // Button sizes
  ctaHeight: 46,
  smallButtonHeight: 42,
} as const
```

- [ ] **Step 2: Add Brockmann/Satoshi to Text component**

Modify `src/components/Text.tsx` — add new font families to the switch statement:

```typescript
// Add new cases after existing ones:
case 'brockmann':
  fontStyle.fontFamily = 'Brockmann-Regular'
  break
case 'brockmann-medium':
  fontStyle.fontFamily = 'Brockmann-Medium'
  break
case 'brockmann-semibold':
  fontStyle.fontFamily = 'Brockmann-SemiBold'
  break
case 'brockmann-bold':
  fontStyle.fontFamily = 'Brockmann-Bold'
  break
case 'satoshi-medium':
  fontStyle.fontFamily = 'Satoshi-Medium'
  break
```

Update the `fontType` type in `TextProps`:

```typescript
fontType?: 'light' | 'book' | 'medium' | 'bold' | 'brockmann' | 'brockmann-medium' | 'brockmann-semibold' | 'brockmann-bold' | 'satoshi-medium'
```

- [ ] **Step 3: Add new button themes**

Modify `src/components/Button.tsx` — add `ctaBlue` and `secondaryDark` to the theme type and switch statement:

```typescript
// Add to theme type union:
| 'ctaBlue'
| 'secondaryDark'

// Add cases in switch:
case 'ctaBlue':
  titleStyle.color = '#f0f4fc'
  containerStyle.backgroundColor = '#0b4eff'
  containerStyle.borderColor = '#0b4eff'
  break
case 'secondaryDark':
  titleStyle.color = '#f0f4fc'
  containerStyle.backgroundColor = '#11284a'
  containerStyle.borderColor = 'rgba(255,255,255,0.03)'
  break
```

Also update the default `borderRadius` in styles from `30` to support pill buttons — add a `pill` prop or use `containerStyle` override per-screen.

- [ ] **Step 4: Commit**

```bash
git add src/consts/migration.ts src/consts/vultisig.ts src/components/Text.tsx src/components/Button.tsx
git commit -m "feat: add Figma design tokens, Brockmann fonts, new button themes"
```

---

### Task 3: Shared Migration Components

**Files:**
- Create: `src/components/migration/GlassButton.tsx`
- Create: `src/components/migration/InfoCard.tsx`
- Create: `src/components/migration/StepProgressBar.tsx`
- Create: `src/components/migration/WalletMigrationCard.tsx`
- Create: `src/components/migration/OGStatusCard.tsx`

- [ ] **Step 1: Create GlassButton component**

Glassmorphic circular button used in toolbars (back, info, etc.). See `docs/designs/migration/04-wallets-found.png` for reference — the back chevron button at top-left.

Create `src/components/migration/GlassButton.tsx`:

```typescript
import React from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'

type Props = {
  onPress: () => void
  children: React.ReactNode
  testID?: string
}

export default function GlassButton({ onPress, children, testID }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      testID={testID}
    >
      <View style={styles.fill} />
      {children}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 296,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MIGRATION.buttonSecondary,
    opacity: 0.67,
    borderRadius: 296,
  },
})
```

- [ ] **Step 2: Create InfoCard component**

The "A new type of wallet" info card on MigrationHome. See `docs/designs/migration/03-wizard-2-migration-home.png`.

Create `src/components/migration/InfoCard.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'

export default function InfoCard() {
  return (
    <View style={styles.container}>
      <View style={styles.mainCard}>
        <View style={styles.headerRow}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚡</Text>
          </View>
          <View style={styles.textContent}>
            <Text style={styles.cardTitle} fontType="brockmann-medium">
              A new type of wallet
            </Text>
            <Text style={styles.cardBody} fontType="brockmann-medium">
              Faster transactions. Stronger security.{'\n'}
              One password instead of 12 words.
              {'\n\n'}
              Fast Vaults are the next evolution of self-custody, built for what's coming to Station.
              {'\n\n'}
              Early explorers get{' '}
              <Text style={styles.boldWhite} fontType="brockmann-medium">Station OG</Text>
              {' '}status and a{' '}
              <Text style={styles.boldWhite} fontType="brockmann-medium">$VULT airdrop</Text>.
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.countdownBar}>
        <Text style={styles.countdownIcon}>🕐</Text>
        <Text style={styles.countdownText} fontType="brockmann-medium">
          The window closes in [X] days.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  mainCard: {
    width: '100%',
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
    borderTopLeftRadius: MIGRATION.radiusCard,
    borderTopRightRadius: MIGRATION.radiusCard,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: MIGRATION.cardPadding,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 25,
    height: 24,
  },
  icon: {
    fontSize: 18,
  },
  textContent: {
    flex: 1,
    paddingTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 17,
    color: MIGRATION.textPrimary,
    letterSpacing: -0.18,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
    letterSpacing: 0.06,
  },
  boldWhite: {
    color: MIGRATION.textPrimary,
  },
  countdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: MIGRATION.surface1,
    borderBottomLeftRadius: MIGRATION.radiusCard,
    borderBottomRightRadius: MIGRATION.radiusCard,
    paddingTop: 32,
    paddingBottom: 14,
    marginTop: -22,
    zIndex: 1,
  },
  countdownIcon: {
    fontSize: 14,
  },
  countdownText: {
    fontSize: 12,
    lineHeight: 16,
    color: MIGRATION.textPrimary,
    letterSpacing: 0.12,
  },
})
```

- [ ] **Step 3: Create StepProgressBar component**

Top progress indicator for VaultName/Email/Password screens. See `docs/designs/migration/05-vault-name.png` — the circular icons at top.

Create `src/components/migration/StepProgressBar.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'

type Step = { icon: string; label: string }

const STEPS: Step[] = [
  { icon: '🔒', label: 'vault' },
  { icon: '✏️', label: 'name' },
  { icon: '✉️', label: 'email' },
  { icon: '🔑', label: 'password' },
]

type Props = {
  /** 0-based index of the current active step */
  currentStep: number
  /** Total number of steps to show (default: all 4) */
  totalSteps?: number
}

export default function StepProgressBar({ currentStep, totalSteps }: Props) {
  const steps = STEPS.slice(0, totalSteps ?? STEPS.length)

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep

        return (
          <React.Fragment key={step.label}>
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  (isCompleted || isActive) && styles.connectorActive,
                ]}
              />
            )}
            <View
              style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isCompleted && styles.stepCircleCompleted,
              ]}
            >
              {isCompleted ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : (
                <Text style={styles.stepIcon}>{step.icon}</Text>
              )}
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MIGRATION.surface1_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
  },
  stepCircleActive: {
    borderColor: MIGRATION.ctaBlue,
    backgroundColor: MIGRATION.surface1,
  },
  stepCircleCompleted: {
    backgroundColor: MIGRATION.ctaBlue,
    borderColor: MIGRATION.ctaBlue,
  },
  stepIcon: {
    fontSize: 16,
  },
  checkmark: {
    fontSize: 16,
    color: MIGRATION.textPrimary,
  },
  connector: {
    width: 24,
    height: 2,
    backgroundColor: MIGRATION.borderLight,
  },
  connectorActive: {
    backgroundColor: MIGRATION.ctaBlue,
  },
})
```

- [ ] **Step 4: Create WalletMigrationCard component**

Wallet card with name, address, balance, and "Migrate to a vault" button. See `docs/designs/migration/04-wallets-found.png`.

Create `src/components/migration/WalletMigrationCard.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import { UTIL } from 'consts'

type Props = {
  name: string
  address: string
  migrated: boolean
  onMigrate: () => void
  testID?: string
}

export default function WalletMigrationCard({ name, address, migrated, onMigrate, testID }: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.walletName} fontType="brockmann-medium">{name}</Text>
        <Text style={styles.balance} fontType="satoshi-medium">$0.00</Text>
      </View>
      <Text style={styles.address} fontType="brockmann">{UTIL.truncate(address, [14, 3])}</Text>
      <View style={styles.divider} />
      <View style={styles.buttonRow}>
        {migrated ? (
          <View style={styles.migratedBadge}>
            <Text style={styles.migratedText} fontType="brockmann-medium">✓ Fast Vault</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.migrateButton} onPress={onMigrate} testID={`${testID}-migrate`}>
            <Text style={styles.migrateButtonText} fontType="brockmann-medium">
              Migrate to a vault
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
    borderRadius: MIGRATION.radiusCard,
    padding: MIGRATION.cardPadding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletName: {
    fontSize: 16,
    lineHeight: 24,
    color: MIGRATION.textPrimary,
  },
  balance: {
    fontSize: 20,
    lineHeight: 20,
    color: MIGRATION.textPrimary,
    letterSpacing: 0.2,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: MIGRATION.borderLight,
    marginVertical: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  migrateButton: {
    flex: 1,
    height: MIGRATION.smallButtonHeight,
    backgroundColor: MIGRATION.ctaBlue,
    borderRadius: MIGRATION.radiusSmallButton,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  migrateButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: MIGRATION.textPrimary,
  },
  migratedBadge: {
    flex: 1,
    height: MIGRATION.smallButtonHeight,
    backgroundColor: MIGRATION.surface1_2,
    borderRadius: MIGRATION.radiusSmallButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  migratedText: {
    fontSize: 14,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
  },
})
```

- [ ] **Step 5: Create OGStatusCard component**

Static card for success screen. See `docs/designs/migration/09-success-full.png`.

Create `src/components/migration/OGStatusCard.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'

export default function OGStatusCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.statusLabel} fontType="brockmann-medium">
        Status: Station OG
      </Text>
      <Text style={styles.airdropLabel} fontType="brockmann-medium">
        #XLT Airdrop: Eligible
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 225,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
    borderRadius: MIGRATION.radiusCard,
    padding: 24,
    alignItems: 'center',
    gap: 24,
  },
  statusLabel: {
    fontSize: 13,
    color: MIGRATION.textPrimary,
  },
  airdropLabel: {
    fontSize: 13,
    color: MIGRATION.textPrimary,
  },
})
```

- [ ] **Step 6: Commit**

```bash
git add src/components/migration/
git commit -m "feat: add shared migration components (GlassButton, InfoCard, StepProgressBar, WalletMigrationCard, OGStatusCard)"
```

---

### Task 4: RiveIntro Screen

**Files:**
- Create: `src/screens/migration/RiveIntro.tsx`

- [ ] **Step 1: Create Rive discovery script (temporary)**

Before building the screen, discover what's in the Rive files. Create a temporary test component that loads each .riv file and logs artboard/state machine names. Wire it into a dev screen and run the app to capture the output.

```typescript
// Temporary: add to a dev screen to log Rive metadata
import Rive from 'rive-react-native'

// Load each file and check the onPlay/onStateChange callbacks for metadata
// Log artboard names, state machine names, and input names
```

Run the app and document the discovered artboard/state machine names. Update the RiveIntro screen code with the real names.

- [ ] **Step 2: Create RiveIntro screen**

Create `src/screens/migration/RiveIntro.tsx`. This screen plays the Rive animation full-screen and auto-navigates to MigrationHome on completion.

```typescript
import React, { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import Rive from 'rive-react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'RiveIntro'>

export default function RiveIntro() {
  const navigation = useNavigation<Nav>()

  const handleAnimationEnd = useCallback(() => {
    navigation.replace('MigrationHome')
  }, [navigation])

  return (
    <View style={styles.container}>
      {/* Background transition layer */}
      <Rive
        resourceName="agent_background_transition"
        style={StyleSheet.absoluteFill}
        autoplay
        // artboardName and stateMachineName to be filled after Rive discovery
        onStop={handleAnimationEnd}
      />
      {/* Foreground wallet animation layer */}
      <View style={styles.walletAnimation}>
        <Rive
          resourceName="station_wallet_animation"
          style={styles.walletRive}
          autoplay
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  walletAnimation: {
    position: 'absolute',
    top: 179,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  walletRive: {
    width: 300,
    height: 300,
  },
})
```

**Note:** The exact `resourceName`, `artboardName`, `stateMachineName`, and `onStop`/`onStateChange` callback will need adjustment based on what the Rive discovery step reveals. The animation might use state machines with a completion state, or it might be a simple timeline animation.

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/RiveIntro.tsx
git commit -m "feat: add RiveIntro screen with layered animation"
```

---

### Task 5: MigrationHome Screen

**Files:**
- Create: `src/screens/migration/MigrationHome.tsx`

- [ ] **Step 1: Create MigrationHome screen**

See `docs/designs/migration/03-wizard-2-migration-home.png` for visual reference.

Create `src/screens/migration/MigrationHome.tsx`:

```typescript
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import InfoCard from 'components/migration/InfoCard'
import { MIGRATION } from 'consts/migration'
import { discoverLegacyWallets, MigrationWallet } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationHome'>

export default function MigrationHome() {
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    discoverLegacyWallets()
      .then((found) => {
        setWallets(found)
        setReady(true)
      })
      .catch(() => {
        setReady(true)
      })
  }, [])

  const hasLegacyWallets = wallets.length > 0

  return (
    <SafeAreaView style={styles.container}>
      {/* Rive wallet animation at top (static final frame or idle loop) */}
      <View style={styles.riveContainer}>
        {/* Rive component here — placeholder until wired */}
      </View>

      <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.content}>
        <Text style={styles.title} fontType="brockmann-medium">
          {'Your seed phrase\nbecomes a Fast Vault'}
        </Text>

        <InfoCard />

        <View style={styles.buttonGroup}>
          <Button
            title={hasLegacyWallets ? 'Start Migration' : 'Create a Fast Vault'}
            theme="ctaBlue"
            onPress={() => {
              if (hasLegacyWallets) {
                navigation.navigate('WalletsFound', { wallets })
              } else {
                navigation.navigate('VaultName')
              }
            }}
            containerStyle={styles.ctaButton}
            testID="migration-cta"
          />

          <Button
            title="I already have a Fast Vault"
            theme="secondaryDark"
            onPress={() => navigation.navigate('ImportVault')}
            containerStyle={styles.secondaryButton}
            testID="import-vault-button"
          />

          <TouchableOpacity>
            <Text style={styles.learnMore} fontType="brockmann-medium">
              Learn more about Vault security
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  riveContainer: {
    alignItems: 'center',
    marginTop: 92,
    height: 200,
  },
  content: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
    gap: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 24,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.36,
  },
  buttonGroup: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
  secondaryButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
  learnMore: {
    fontSize: 14,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
    textDecorationLine: 'underline',
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/MigrationHome.tsx
git commit -m "feat: add MigrationHome screen with info card and conditional CTAs"
```

---

### Task 6: WalletsFound Screen

**Files:**
- Rewrite: `src/screens/migration/WalletDiscovery.tsx` → rename to `WalletsFound.tsx`

- [ ] **Step 1: Create WalletsFound screen**

Delete `WalletDiscovery.tsx` and create `src/screens/migration/WalletsFound.tsx`. See `docs/designs/migration/04-wallets-found.png`.

This receives `wallets` array via route params. Each wallet has a "Migrate to a vault" button that starts the per-wallet migration flow, or shows "Fast Vault" badge if already migrated.

```typescript
import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import GlassButton from 'components/migration/GlassButton'
import WalletMigrationCard from 'components/migration/WalletMigrationCard'
import { MIGRATION } from 'consts/migration'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'WalletsFound'>
type Route = RouteProp<MigrationStackParams, 'WalletsFound'>

export default function WalletsFound() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { wallets } = route.params
  const [migratedNames, setMigratedNames] = useState<Set<string>>(new Set())

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <GlassButton onPress={() => navigation.goBack()} testID="wallets-back">
          <Text style={styles.chevron}>‹</Text>
        </GlassButton>
      </View>

      <View style={styles.header}>
        <Text style={styles.title} fontType="brockmann-medium">Your wallets</Text>
        <Text style={styles.subtitle} fontType="brockmann">Handle each one separately.</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {wallets.map((wallet, index) => (
          <WalletMigrationCard
            key={wallet.name}
            name={wallet.name}
            address={wallet.address}
            migrated={migratedNames.has(wallet.name)}
            onMigrate={() => {
              navigation.navigate('VaultEmail', {
                walletName: wallet.name,
                wallets,
                mode: 'migrate',
              })
            }}
            testID={`wallet-card-${index}`}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 0,
    paddingBottom: 10,
  },
  header: {
    paddingHorizontal: MIGRATION.screenPadding,
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 24,
    color: '#ffffff',
    letterSpacing: -0.36,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: MIGRATION.screenPadding,
    gap: MIGRATION.cardGap,
    paddingBottom: 24,
  },
  chevron: {
    fontSize: 24,
    color: '#c9d6e8',
  },
})
```

- [ ] **Step 2: Commit**

```bash
git rm src/screens/migration/WalletDiscovery.tsx
git add src/screens/migration/WalletsFound.tsx
git commit -m "feat: add WalletsFound screen with per-wallet migration cards"
```

---

### Task 7: VaultName Screen

**Files:**
- Create: `src/screens/migration/VaultName.tsx`

- [ ] **Step 1: Create VaultName screen**

See `docs/designs/migration/05-vault-name.png`. Includes StepProgressBar at step 0. Create path only.

Create `src/screens/migration/VaultName.tsx`:

```typescript
import React, { useState } from 'react'
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import GlassButton from 'components/migration/GlassButton'
import { MIGRATION } from 'consts/migration'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultName'>

export default function VaultName() {
  const navigation = useNavigation<Nav>()
  const [name, setName] = useState('')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <GlassButton onPress={() => navigation.goBack()}>
          <Text style={styles.chevron}>‹</Text>
        </GlassButton>
      </View>
      <StepProgressBar currentStep={1} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title} fontType="brockmann-medium">Name your vault</Text>
          <Text style={styles.subtitle} fontType="brockmann">
            No inspiration? You can always change the name in your settings later.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              testID="vault-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Saving Vault"
              placeholderTextColor={MIGRATION.textTertiary}
              autoFocus
            />
            {name.length > 0 && (
              <TouchableOpacity onPress={() => setName('')} style={styles.clearButton}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <Button
              testID="vault-name-next"
              title="Next"
              theme="ctaBlue"
              disabled={name.trim().length === 0}
              onPress={() => {
                navigation.navigate('VaultEmail', {
                  walletName: name.trim(),
                  mode: 'create',
                })
              }}
              containerStyle={styles.nextButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 10,
  },
  chevron: { fontSize: 24, color: '#c9d6e8' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 24,
    color: MIGRATION.textPrimary,
    letterSpacing: -0.36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: MIGRATION.textPrimary,
    fontFamily: 'Brockmann-Regular',
  },
  clearButton: {
    padding: 8,
  },
  clearIcon: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingBottom: 24,
    paddingTop: 16,
  },
  nextButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/VaultName.tsx
git commit -m "feat: add VaultName screen with step progress bar"
```

---

### Task 8: Restyle VaultEmail & VaultPassword

**Files:**
- Modify: `src/screens/migration/VaultEmail.tsx`
- Modify: `src/screens/migration/VaultPassword.tsx`

- [ ] **Step 1: Restyle VaultEmail**

Update `src/screens/migration/VaultEmail.tsx` to use:
- `MIGRATION` design tokens instead of `VULTISIG`
- `StepProgressBar` at step 2 (for create path) or step 1 (for migrate path, which skips VaultName)
- `GlassButton` back button
- Brockmann fonts
- Updated copy from Figma: "This will only be used once to send your backup file. Vultisig doesn't store any data."
- `ctaBlue` button theme
- Accept `mode` param from route to determine step bar state
- Pill button radius (99px)

See `docs/designs/migration/06-enter-email.png` for reference.

- [ ] **Step 2: Restyle VaultPassword**

Update `src/screens/migration/VaultPassword.tsx` to use:
- Same token/font/component changes as VaultEmail
- `StepProgressBar` at step 3 (create) or step 2 (migrate)
- Updated copy: "If you want an extra layer of security, choose a password. **Password cannot be recovered.**"
- Button text: "Create vault" (create path) or "Continue" (migrate path) based on `mode` param
- See `docs/designs/migration/07-choose-password.png` for reference.

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/VaultEmail.tsx src/screens/migration/VaultPassword.tsx
git commit -m "feat: restyle VaultEmail and VaultPassword with Figma tokens and step bar"
```

---

### Task 9: Update KeygenProgress & VerifyEmail

**Files:**
- Modify: `src/screens/migration/KeygenProgress.tsx`
- Modify: `src/screens/migration/VerifyEmail.tsx`

- [ ] **Step 1: Add mode param to KeygenProgress**

Modify `src/screens/migration/KeygenProgress.tsx`:
- Accept `mode: 'migrate' | 'create'` in route params
- When `mode === 'create'`, call a fresh keygen service instead of `importKeyToFastVault`
- Update visual styling to use `MIGRATION` tokens and Brockmann fonts
- Keep the existing progress bar animation logic

- [ ] **Step 2: Update VerifyEmail copy**

Modify `src/screens/migration/VerifyEmail.tsx`:
- Restyle with `MIGRATION` tokens and Brockmann fonts
- No structural changes — just visual alignment with new design system

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/KeygenProgress.tsx src/screens/migration/VerifyEmail.tsx
git commit -m "feat: update KeygenProgress with mode param, restyle VerifyEmail"
```

---

### Task 10: ImportVault Screen

**Files:**
- Create: `src/services/importVaultBackup.ts`
- Create: `src/hooks/useImportFlow.ts`
- Create: `src/components/migration/FileDropZone.tsx`
- Create: `src/components/migration/DecryptPasswordSheet.tsx`
- Create: `src/screens/migration/ImportVault.tsx`

- [ ] **Step 1: Port importVaultBackup service**

Copy and adapt `importVaultBackup.ts` from `/Users/apotheosis/git/vultisig/vultiagent-app/src/services/importVaultBackup.ts`. This handles:
- Parsing base64 file content as VaultContainer protobuf
- Detecting if encryption is needed
- AES-256-GCM decryption with SHA256(password) key derivation
- Deserializing the Vault protobuf
- Creating VaultData object

Adapt to station-mobile's types and storage APIs. The protobuf schemas should already be available since `@bufbuild/protobuf` is installed — check if the vault proto types exist in station-mobile or need to be copied from vultiagent.

- [ ] **Step 2: Port useImportFlow hook**

Copy and adapt `useImportFlow.ts` from `/Users/apotheosis/git/vultisig/vultiagent-app/src/screens/onboarding/import/hooks/useImportFlow.ts`. This manages:
- File picker via `expo-document-picker`
- File validation (`.bak` / `.vult` extensions)
- State machine: empty → file selected → needs password → decrypting → success/error

- [ ] **Step 3: Create FileDropZone component**

See `docs/designs/migration/10-import-vault-empty.png` and `docs/designs/migration/11-import-vault-file-selected.png`.

Create `src/components/migration/FileDropZone.tsx`:
- Empty state: upload icon centered, "Import your vault share" text
- Selected state: filename badge with X to clear
- Error state: red error text
- Background: `#0b1a3a80` with `#1b3f73` border, 24px radius

- [ ] **Step 4: Create DecryptPasswordSheet component**

See `docs/designs/migration/12-import-vault-decrypt.png`.

Create `src/components/migration/DecryptPasswordSheet.tsx`:
- Bottom sheet with grabber handle
- Lock icon at top
- "Enter Vault Share Password" title (Brockmann Medium 17px)
- "This password was set when the vault share was exported." subtitle
- Password input field
- "Continue" button
- Error state: "Incorrect password, try again" in red

- [ ] **Step 5: Create ImportVault screen**

Create `src/screens/migration/ImportVault.tsx`:
- Toolbar: GlassButton back + "Import Vault" title + info button
- FileDropZone centered
- "Supported file types: .bak & .vult" text
- "Continue" button at bottom (disabled until file selected)
- On Continue: calls useImportFlow.importVault()
- If password needed: shows DecryptPasswordSheet
- On success: navigates to MigrationSuccess

- [ ] **Step 6: Commit**

```bash
git add src/services/importVaultBackup.ts src/hooks/useImportFlow.ts src/components/migration/FileDropZone.tsx src/components/migration/DecryptPasswordSheet.tsx src/screens/migration/ImportVault.tsx
git commit -m "feat: add ImportVault screen with file picker and decrypt flow"
```

---

### Task 11: MigrationSuccess Screen Redesign

**Files:**
- Rewrite: `src/screens/migration/MigrationSuccess.tsx`

- [ ] **Step 1: Rewrite MigrationSuccess**

Complete redesign based on `docs/designs/migration/09-success-full.png`.

Rewrite `src/screens/migration/MigrationSuccess.tsx`:
- Toolbar: GlassButton back (left) + GlassButton cube icon (right, placeholder)
- Title: "You are aboard, Station OG!" — Brockmann Medium 22px, white, left-aligned
- Subtitle: "Your vault is secured. No single key.\nNo single point of failure." — Brockmann Regular 14px, tertiary
- OGStatusCard centered
- "[ Entering orbit soon... ]" — Gotham Medium 14px, `#4879fd`, centered
- "Share your OG status" button — ctaBlue, pill radius, with copy icon
- Conditional "Migrate another wallet" link — Brockmann Medium 14px, tertiary, underlined
- Write `vaultsUpgraded` flag on mount
- `onMigrationComplete` callback for "Continue to wallets" navigation

Route params include `wallets` and `migratedWalletName` to determine if "Migrate another wallet" link shows.

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/MigrationSuccess.tsx
git commit -m "feat: redesign MigrationSuccess with OG status card"
```

---

### Task 12: MigrationNavigator & Route Params

**Files:**
- Rewrite: `src/navigation/MigrationNavigator.tsx`
- Modify: `src/navigation/index.tsx`

- [ ] **Step 1: Rewrite MigrationNavigator**

Complete rewrite of `src/navigation/MigrationNavigator.tsx` with new screen inventory and route params:

```typescript
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import RiveIntro from '../screens/migration/RiveIntro'
import MigrationHome from '../screens/migration/MigrationHome'
import WalletsFound from '../screens/migration/WalletsFound'
import VaultName from '../screens/migration/VaultName'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import VerifyEmail from '../screens/migration/VerifyEmail'
import ImportVault from '../screens/migration/ImportVault'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet } from 'services/migrateToVault'

export type MigrationStackParams = {
  RiveIntro: undefined
  MigrationHome: undefined
  WalletsFound: {
    wallets: MigrationWallet[]
  }
  VaultName: undefined
  VaultEmail: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: 'migrate' | 'create'
    email?: string
  }
  VaultPassword: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: 'migrate' | 'create'
    email: string
  }
  KeygenProgress: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: 'migrate' | 'create'
    email: string
    password: string
  }
  VerifyEmail: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: 'migrate' | 'create'
    email: string
    publicKey: string
  }
  ImportVault: undefined
  MigrationSuccess: {
    wallets?: MigrationWallet[]
    migratedWalletName?: string
  }
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="RiveIntro"
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="RiveIntro" component={RiveIntro} />
      <Stack.Screen name="MigrationHome" component={MigrationHome} />
      <Stack.Screen name="WalletsFound" component={WalletsFound} />
      <Stack.Screen name="VaultName" component={VaultName} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen name="KeygenProgress" component={KeygenProgress} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Update root navigator routing**

Modify `src/navigation/index.tsx`. The migration flow should show for:
1. Existing users with legacy wallets not yet migrated (current behavior)
2. Brand new users with no wallets (currently goes to Auth — should go to Migration instead)

Update the routing logic in the `init` function:

```typescript
if (loaded.length > 0 && !vaultsUpgraded && legacyDataFound) {
  setRootRoute('Migration')
} else if (loaded.length === 0) {
  // NEW: brand new users go through migration flow (create a fast vault)
  setRootRoute('Migration')
} else {
  setRootRoute('Main')
  const picked = await pickInitialWallet(loaded)
  if (picked) setInitialWallet(picked)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MigrationNavigator.tsx src/navigation/index.tsx
git commit -m "feat: rewrite MigrationNavigator with new screens and routing"
```

---

### Task 13: Visual Polish & Screenshot Validation

**Files:**
- Various — all migration screens

- [ ] **Step 1: Compare each screen against Figma screenshots**

Open each screen in the running app and compare side-by-side with the corresponding screenshot in `docs/designs/migration/`:

| Screen | Reference |
|---|---|
| RiveIntro | `01-landing.png`, `02-wizard-1.png`, `13-migration-video.png` |
| MigrationHome | `03-wizard-2-migration-home.png` |
| WalletsFound | `04-wallets-found.png` |
| VaultName | `05-vault-name.png` |
| VaultEmail | `06-enter-email.png` |
| VaultPassword | `07-choose-password.png` |
| MigrationSuccess | `09-success-full.png` |
| ImportVault | `10-import-vault-empty.png`, `11-import-vault-file-selected.png`, `12-import-vault-decrypt.png` |

Fix any spacing, color, font, or layout discrepancies.

- [ ] **Step 2: Test all navigation paths**

Manually test:
1. RiveIntro → MigrationHome → "Start Migration" → WalletsFound → pick wallet → Email → Password → Keygen → Verify → Success → "Migrate another wallet" → WalletsFound
2. RiveIntro → MigrationHome → "Create a Fast Vault" → VaultName → Email → Password → Keygen → Verify → Success
3. RiveIntro → MigrationHome → "I already have a Fast Vault" → ImportVault → Success

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual polish and layout adjustments for migration screens"
```

---

### Task 14: Clean Up Old Screens

**Files:**
- Delete: `src/screens/migration/WalletDiscovery.tsx` (if not already removed)
- Modify: `src/navigation/AuthNavigator.tsx` — remove NewWallet route (replaced by migration flow)

- [ ] **Step 1: Remove old NewWalletStack references**

Since the migration flow replaces new wallet creation, update `AuthNavigator.tsx` to remove the `NewWallet` route. Keep `RecoverWallet` for now.

- [ ] **Step 2: Verify no broken imports**

```bash
npx tsc --noEmit
```

Fix any TypeScript errors from removed/renamed files.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old wallet creation flow replaced by migration"
```

---

### Task 15: Update AgentMail Helper for Per-Wallet Flow

**Files:**
- Modify: `e2e/helpers/agentmail.js`

- [ ] **Step 1: Update migrateOneWallet helper**

The existing `migrateOneWallet()` assumes the VaultEmail screen is already visible and the flow advances sequentially. The new flow is per-wallet from WalletsFound:

1. Tap "Migrate to a vault" on a specific wallet card
2. VaultEmail → VaultPassword → KeygenProgress → VerifyEmail
3. MigrationSuccess appears
4. If more wallets: tap "Migrate another wallet" → back to WalletsFound

Update `e2e/helpers/agentmail.js`:

```javascript
/**
 * Walk one wallet through the per-wallet migration flow.
 * Assumes WalletsFound screen is visible with the wallet card.
 *
 * @param {number} walletIndex - 0-based index of the wallet card
 * @param {string} walletLabel - For logging
 * @param {Set} knownMessageIds - AgentMail message tracking
 * @param {boolean} hasMoreWallets - Whether to tap "Migrate another wallet" after
 */
async function migrateOneWalletFromCard(walletIndex, walletLabel, knownMessageIds, hasMoreWallets) {
  console.log(`\n--- Migrating ${walletLabel} from card ${walletIndex} ---`);

  // Tap the "Migrate to a vault" button on the wallet card
  await waitFor(element(by.id(`wallet-card-${walletIndex}-migrate`)))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id(`wallet-card-${walletIndex}-migrate`)).tap();

  // Email screen
  await waitFor(element(by.text('Enter your email')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('vault-email-input')).tap();
  await element(by.id('vault-email-input')).clearText();
  await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
  await element(by.id('vault-email-next')).tap();

  // Password screen
  await waitFor(element(by.text('Choose a password')))
    .toBeVisible()
    .withTimeout(10000);

  const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
  for (const id of preKeygenIds) knownMessageIds.add(id);

  await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
  await element(by.id('vault-password-continue')).tap();

  // KeygenProgress → VerifyEmail
  await waitFor(element(by.text('Verify your email')))
    .toExist()
    .withTimeout(150000);

  const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
  await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
  await element(by.id('verify-code-input')).tap();
  await element(by.id('verify-code-input')).replaceText(otp);

  // Wait for verification + navigation to MigrationSuccess
  await waitFor(element(by.text('You are aboard, Station OG!')))
    .toBeVisible()
    .withTimeout(15000);

  if (hasMoreWallets) {
    // Tap "Migrate another wallet" → back to WalletsFound
    await element(by.id('migrate-another-wallet')).tap();
    await waitFor(element(by.text('Your wallets')))
      .toBeVisible()
      .withTimeout(10000);
  }

  console.log(`--- ${walletLabel} complete ---\n`);
}

module.exports = {
  AGENTMAIL_API_KEY,
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
  migrateOneWallet,
  migrateOneWalletFromCard,
};
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/agentmail.js
git commit -m "test: add migrateOneWalletFromCard helper for per-wallet flow"
```

---

### Task 16: E2E Test — Full Per-Wallet Migration

**Files:**
- Rewrite: `e2e/fast-vault-migration.test.js`

- [ ] **Step 1: Rewrite fast-vault-migration test**

Rewrite `e2e/fast-vault-migration.test.js` for the new per-wallet flow:

```javascript
/**
 * Fast Vault Migration E2E Tests — Per-Wallet Flow
 *
 * Seeds legacy data (2 standard + 1 ledger), walks through:
 * RiveIntro → MigrationHome → "Start Migration" → WalletsFound →
 * per-wallet: tap "Migrate to a vault" → Email → Password → Keygen → Verify →
 * Success → "Migrate another wallet" → WalletsFound → next wallet.
 *
 * After all wallets: verify vault integrity, persistence.
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const { execSync } = require('child_process');
const {
  AGENTMAIL_EMAIL,
  getExistingMessageIds,
  migrateOneWalletFromCard,
} = require('./helpers/agentmail');

describe('Fast Vault Migration — Per-Wallet', () => {
  let knownMessageIds = new Set();

  describe('Setup and RiveIntro', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Seed legacy keystore data
      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      await waitFor(element(by.text('Seed Legacy Data (dev)')))
        .toBeVisible()
        .withTimeout(30000);
      await element(by.text('Seed Legacy Data (dev)')).tap();
      await waitFor(element(by.id('seed-done')))
        .toExist()
        .withTimeout(30000);

      // Relaunch to trigger migration flow
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should play RiveIntro and reach MigrationHome', async () => {
      // RiveIntro plays → auto-navigates to MigrationHome
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should show "Start Migration" (legacy wallets found)', async () => {
      await expect(element(by.id('migration-cta'))).toBeVisible();
    });

    it('should navigate to WalletsFound', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show wallet cards', async () => {
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Per-wallet migration', () => {
    it('should migrate wallet 1', async () => {
      await migrateOneWalletFromCard(0, 'TestWallet1', knownMessageIds, true);
    });

    it('should migrate wallet 2', async () => {
      await migrateOneWalletFromCard(1, 'TestWallet2', knownMessageIds, false);
    });
  });

  describe('Vault integrity verification', () => {
    it('should show success screen with vault verification', async () => {
      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('DKLS keyshares are loadable by native module', async () => {
      await waitFor(element(by.id('verify-vault1-keyshare-loadable')))
        .toExist()
        .withTimeout(15000);
      await expect(element(by.id('verify-vault1-keyshare-loadable')))
        .toHaveText('vault1-keyshare-loadable: true');

      await waitFor(element(by.id('verify-vault2-keyshare-loadable')))
        .toExist()
        .withTimeout(5000);
      await expect(element(by.id('verify-vault2-keyshare-loadable')))
        .toHaveText('vault2-keyshare-loadable: true');
    });

    it('DKLS vaults have correct structure', async () => {
      await expect(element(by.id('verify-vault1-vault-type')))
        .toHaveText('vault1-vault-type: DKLS');
      await expect(element(by.id('verify-vault1-signers')))
        .toHaveText('vault1-signers: true');
    });

    it('all vault verification checks pass', async () => {
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(10000);
      await expect(element(by.id('verify-all-passed')))
        .toHaveText('all-passed: true');
    });
  });

  describe('Persistence', () => {
    beforeAll(async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 2000));

      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    it('should not show migration flow on relaunch', async () => {
      let migrationShown = false;
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000);
        migrationShown = true;
      } catch {}

      if (migrationShown) {
        throw new Error('Migration flow should not appear after successful migration');
      }
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fast-vault-migration.test.js
git commit -m "test: rewrite fast-vault-migration for per-wallet flow"
```

---

### Task 17: E2E Test — Fast Vault Creation (New User)

**Files:**
- Create: `e2e/fast-vault-creation.test.js`

- [ ] **Step 1: Create fast vault creation test**

Tests the brand new user path: no legacy wallets, create a fast vault from scratch.

```javascript
/**
 * Fast Vault Creation E2E Test — New User
 *
 * Clean install (no legacy wallets) → RiveIntro → MigrationHome →
 * "Create a Fast Vault" → VaultName → VaultEmail → VaultPassword →
 * KeygenProgress → VerifyEmail → MigrationSuccess.
 *
 * Verifies a brand new DKLS fast vault is created with correct structure.
 *
 * Requires: vultiserver at api.vultisig.com, agentmail credentials in .env
 */
const { execSync } = require('child_process');
const {
  AGENTMAIL_EMAIL,
  VAULT_PASSWORD,
  getExistingMessageIds,
  fetchOtpFromAgentmail,
} = require('./helpers/agentmail');

describe('Fast Vault Creation — New User', () => {
  let knownMessageIds = new Set();

  describe('Setup — clean install', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();

      knownMessageIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should play RiveIntro and reach MigrationHome', async () => {
      await waitFor(element(by.id('migration-cta')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should show "Create a Fast Vault" (no legacy wallets)', async () => {
      // The CTA text should be "Create a Fast Vault" not "Start Migration"
      await expect(element(by.id('migration-cta'))).toBeVisible();
    });

    it('should navigate to VaultName', async () => {
      await element(by.id('migration-cta')).tap();
      await waitFor(element(by.text('Name your vault')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter vault name and advance', async () => {
      await element(by.id('vault-name-input')).typeText('My Fast Vault');
      await element(by.id('vault-name-next')).tap();
      await waitFor(element(by.text('Enter your email')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter email and advance', async () => {
      await element(by.id('vault-email-input')).tap();
      await element(by.id('vault-email-input')).typeText(AGENTMAIL_EMAIL);
      await element(by.id('vault-email-next')).tap();
      await waitFor(element(by.text('Choose a password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should enter password and start keygen', async () => {
      const preKeygenIds = await getExistingMessageIds(AGENTMAIL_EMAIL);
      for (const id of preKeygenIds) knownMessageIds.add(id);

      await element(by.id('vault-password-input')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-confirm')).typeText(VAULT_PASSWORD);
      await element(by.id('vault-password-continue')).tap();

      // Fresh keygen → VerifyEmail
      await waitFor(element(by.text('Verify your email')))
        .toExist()
        .withTimeout(150000);
    });

    it('should verify email with OTP', async () => {
      const otp = await fetchOtpFromAgentmail(AGENTMAIL_EMAIL, knownMessageIds);
      await waitFor(element(by.id('verify-code-input'))).toExist().withTimeout(5000);
      await element(by.id('verify-code-input')).tap();
      await element(by.id('verify-code-input')).replaceText(otp);

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000);
    });

    it('should show success with vault verification', async () => {
      // DevVerifyVault checks vault integrity
      await waitFor(element(by.id('verify-all-passed')))
        .toExist()
        .withTimeout(15000);
      await expect(element(by.id('verify-all-passed')))
        .toHaveText('all-passed: true');
    });

    it('should not show "Migrate another wallet" (no wallets to migrate)', async () => {
      let migrateAnotherVisible = false;
      try {
        await waitFor(element(by.id('migrate-another-wallet')))
          .toBeVisible()
          .withTimeout(2000);
        migrateAnotherVisible = true;
      } catch {}

      if (migrateAnotherVisible) {
        throw new Error('"Migrate another wallet" should not appear for new user');
      }
    });

    it('should complete and show main app', async () => {
      await element(by.id('continue-button')).tap();
      await new Promise(r => setTimeout(r, 3000));
    });
  });

  describe('Persistence', () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
      await new Promise(r => setTimeout(r, 3000));
    });

    it('should not show migration flow on relaunch', async () => {
      let migrationShown = false;
      try {
        await waitFor(element(by.id('migration-cta')))
          .toBeVisible()
          .withTimeout(5000);
        migrationShown = true;
      } catch {}

      if (migrationShown) {
        throw new Error('Migration flow should not appear after vault creation');
      }
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fast-vault-creation.test.js
git commit -m "test: add E2E test for new user fast vault creation flow"
```

---

### Task 18: E2E Test — Partial Migration (Skip/Retry)

**Files:**
- Rewrite: `e2e/fast-vault-partial-migration.test.js`

- [ ] **Step 1: Rewrite partial migration test**

Update for new flow: RiveIntro → MigrationHome → "Start Migration" → WalletsFound → tap wallet card → Email → Password → KeygenProgress fails → Skip → back to WalletsFound or Success.

Same pattern as existing test but navigating through new screens with updated testIDs. Seeds corrupt data via DevSeedCorruptData, walks through the error/skip path.

Key changes from existing:
- Wait for RiveIntro → MigrationHome first
- Tap `migration-cta` to get to WalletsFound
- Tap `wallet-card-0-migrate` instead of `upgrade-button`
- Success screen text changes to "You are aboard, Station OG!" (or error variant)

- [ ] **Step 2: Commit**

```bash
git add e2e/fast-vault-partial-migration.test.js
git commit -m "test: rewrite partial migration test for per-wallet flow"
```

---

### Task 19: E2E Test — Import Vault

**Files:**
- Create: `e2e/import-vault.test.js`

- [ ] **Step 1: Create import vault test**

Tests the "I already have a Fast Vault" → ImportVault flow. Requires staging a test `.vult` file on the simulator.

```javascript
/**
 * Import Vault E2E Test
 *
 * RiveIntro → MigrationHome → "I already have a Fast Vault" →
 * ImportVault → pick .vult file → decrypt → MigrationSuccess.
 *
 * Uses a pre-staged test vault file in the simulator's Documents directory.
 * Does NOT require vultiserver (import is local decrypt only).
 */
const { execSync } = require('child_process');

describe('Import Vault', () => {
  describe('Setup', () => {
    beforeAll(async () => {
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      // Stage a test .vult file in the simulator's Documents directory
      // The file should be an encrypted vault backup created by the export flow.
      // For CI, this file is checked into e2e/fixtures/test-vault.vult
      // Copy it to the simulator's Documents directory:
      const docsDir = execSync(
        `xcrun simctl get_app_container ${udid} com.station.mobile data 2>/dev/null || echo ""`,
        { encoding: 'utf8' }
      ).trim();

      if (docsDir) {
        execSync(`mkdir -p "${docsDir}/Documents"`, { timeout: 5000 });
        execSync(
          `cp e2e/fixtures/test-vault.vult "${docsDir}/Documents/"`,
          { timeout: 5000 }
        );
      }

      await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: { detoxURLBlacklistRegex: '.*' },
      });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('should reach MigrationHome', async () => {
      await waitFor(element(by.id('import-vault-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should navigate to ImportVault', async () => {
      await element(by.id('import-vault-button')).tap();
      await waitFor(element(by.text('Import your vault share')))
        .toBeVisible()
        .withTimeout(10000);
    });

    // NOTE: Automating expo-document-picker in Detox is limited.
    // On iOS simulator, the file picker opens a system dialog.
    // For CI, consider using a Detox-staged file approach where the
    // app auto-detects a file in Documents (similar to vultiagent's
    // detox-import.vult pattern). The useImportFlow hook should
    // check for staged files in dev mode.
    //
    // If auto-detection is implemented:
    it('should auto-detect staged vault file', async () => {
      // In dev mode, ImportVault screen checks for detox-import.vult
      // and auto-selects it
      await waitFor(element(by.id('import-continue')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show decrypt password sheet', async () => {
      await element(by.id('import-continue')).tap();
      await waitFor(element(by.text('Enter Vault Share Password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should decrypt and navigate to success', async () => {
      await element(by.id('decrypt-password-input')).typeText('testpass123');
      await element(by.id('decrypt-continue')).tap();

      await waitFor(element(by.text('You are aboard, Station OG!')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });
});
```

**Note:** Automating file picker in Detox requires a staged-file approach. The vultiagent app uses `detox-import.vult` auto-detection — port that pattern.

- [ ] **Step 2: Create test fixture**

Create `e2e/fixtures/test-vault.vult` — a pre-encrypted vault backup file for testing. This can be generated by running the export flow in the existing app, or by using the `importVaultBackup.ts` service in reverse.

- [ ] **Step 3: Commit**

```bash
git add e2e/import-vault.test.js e2e/fixtures/
git commit -m "test: add E2E test for vault import flow"
```

---

### Task 20: Update Remaining E2E Tests

**Files:**
- Modify: `e2e/migration-onboarding.test.js`
- Modify: `e2e/fast-vault-retry-upgrade.test.js`

- [ ] **Step 1: Update migration-onboarding test**

Update `e2e/migration-onboarding.test.js`:
- Clean install test: now goes to Migration (not Auth) → update assertion to check for `migration-cta` instead of "Create New Wallet"
- Real upgrade path: wait for RiveIntro → MigrationHome → tap `migration-cta` → WalletsFound → use `migrateOneWalletFromCard` helper
- Vault integrity checks: unchanged (DevVerifyVault still renders)
- Persistence: unchanged

- [ ] **Step 2: Update retry-upgrade test**

Update `e2e/fast-vault-retry-upgrade.test.js`:
- Minimal changes — this tests upgrade from the main UI, not the migration flow
- Update any testIDs that changed on Email/Password/Verify screens
- Success screen text: "You are aboard, Station OG!" instead of "Wallets Upgraded!"

- [ ] **Step 3: Commit**

```bash
git add e2e/migration-onboarding.test.js e2e/fast-vault-retry-upgrade.test.js
git commit -m "test: update migration-onboarding and retry-upgrade tests for new flow"
```
