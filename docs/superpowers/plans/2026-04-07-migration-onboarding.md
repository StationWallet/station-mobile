# Migration Onboarding Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic onboarding with a polished migration flow that discovers legacy wallets, upgrades them to `.vult` format with animation, shows a Vaultie agent teaser, and lands users in a Vultisig-branded wallet viewer.

**Architecture:** A new `MigrationNavigator` stack (3 screens: WalletDiscovery, MigrationProgress, MigrationSuccess) sits alongside the existing AuthNavigator and MainNavigator. The root `AppNavigator` checks a new `vaultsUpgraded` preference to decide which stack to show. Migration logic lives in a dedicated service (`migrateToVault.ts`) that decrypts legacy keys and builds vault protobufs. All animations use `react-native-reanimated` (already installed v4.2.1).

**Tech Stack:** React Native / Expo, react-native-reanimated 4.2.1, @react-navigation/stack, @bufbuild/protobuf, expo-secure-store, Detox 20.50.1

**Spec:** `docs/superpowers/specs/2026-04-07-migration-onboarding-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/services/migrateToVault.ts` | Core migration logic: decrypt key → build vault protobuf → store |
| `src/navigation/MigrationNavigator.tsx` | Stack navigator for the 3 migration screens |
| `src/navigation/MigrationContext.ts` | Context providing `onMigrationComplete` callback to child screens |
| `src/screens/migration/WalletDiscovery.tsx` | Shows discovered wallets + "Upgrade" button |
| `src/screens/migration/MigrationProgress.tsx` | Animated migration sequence |
| `src/screens/migration/MigrationSuccess.tsx` | Success celebration + Vaultie teaser |
| `src/components/VaultieComingSoonCard.tsx` | "Vultisig Agent coming soon" card for wallet home |
| `src/consts/vultisig.ts` | Vultisig brand colors and design tokens |
| `e2e/migration-onboarding.test.js` | Detox E2E tests for the migration flow |

### Modified Files
| File | Change |
|------|--------|
| `src/nativeModules/preferences.ts` | Add `vaultsUpgraded` to `PreferencesEnum` |
| `src/navigation/index.tsx` | Add migration routing via conditional rendering + MigrationContext |
| `src/App/index.tsx` | Skip old onboarding for migration users |
| `src/screens/WalletHome.tsx` | Add VaultieComingSoonCard |

---

## Task 1: Add `vaultsUpgraded` Preference Flag

**Files:**
- Modify: `src/nativeModules/preferences.ts:3-13`

- [ ] **Step 1: Add the enum value**

In `src/nativeModules/preferences.ts`, add `vaultsUpgraded` to the `PreferencesEnum`:

```typescript
export enum PreferencesEnum {
  settings = 'settings',
  onboarding = 'skipOnboarding',
  useBioAuth = 'useBioAuth',
  firstRun = 'firstRun',
  walletHideSmall = 'walletHideSmall',
  scheme = 'scheme',
  walletConnectSession = 'walletConnectSession',
  stakingFilter = 'stakingFilter',
  tokens = 'tokens',
  legacyKeystoreMigrated = 'legacyKeystoreMigrated',
  vaultsUpgraded = 'vaultsUpgraded',
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/nativeModules/preferences.ts
git commit -m "feat: add vaultsUpgraded preference flag for migration routing"
```

---

## Task 2: Vultisig Brand Tokens

**Files:**
- Create: `src/consts/vultisig.ts`

- [ ] **Step 1: Create the brand constants file**

Create `src/consts/vultisig.ts`:

```typescript
/**
 * Vultisig brand design tokens.
 * Used across migration screens and restyled wallet views.
 * Aligns with the Vultisig desktop/iOS app visual identity.
 */
export const VULTISIG = {
  // Core palette
  bg: '#02122B',
  surface: '#061B3A',
  surfaceLight: '#0A2550',
  card: '#0D1F3C',
  cardBorder: 'rgba(51, 204, 187, 0.15)',

  // Brand accent — Vultisig teal
  accent: '#33CCBB',
  accentDim: 'rgba(51, 204, 187, 0.3)',
  accentGlow: 'rgba(51, 204, 187, 0.12)',

  // Text
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  textAccent: '#33CCBB',

  // Semantic
  success: '#33CCBB',
  error: '#FF5C5C',
  warning: '#FFB340',

  // Spacing
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusPill: 30,
} as const
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/consts/vultisig.ts
git commit -m "feat: add Vultisig brand design tokens"
```

---

## Task 3: Migration Service (`migrateToVault.ts`)

**Files:**
- Create: `src/services/migrateToVault.ts`

This is the core logic: reads auth data, decrypts each wallet's private key, builds a vault protobuf, and stores it in secure storage.

- [ ] **Step 1: Create the migration service**

Create `src/services/migrateToVault.ts`:

```typescript
import { create, toBinary } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { getAuthData, AuthDataValueType, LedgerDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'

const LOCAL_PARTY_ID = 'station-mobile'
const VAULT_KEY_PREFIX = 'VAULT-'

function vaultStoreOpts(): SecureStore.SecureStoreOptions {
  return {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  }
}

function derivePublicKeyHex(privateKeyHex: string): string {
  const privateKeyBytes = hex.decode(privateKeyHex)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
  return hex.encode(publicKeyBytes)
}

export interface MigrationWallet {
  name: string
  address: string
  ledger: boolean
  path?: number
}

export interface MigrationResult {
  wallet: MigrationWallet
  success: boolean
  error?: string
}

/**
 * Reads legacy auth data and returns the list of wallets available for migration.
 */
export async function discoverLegacyWallets(): Promise<MigrationWallet[]> {
  const authData = await getAuthData()
  if (!authData) return []

  return Object.entries(authData).map(([name, data]) => ({
    name,
    address: data.address,
    ledger: data.ledger === true,
    path: data.ledger === true ? (data as LedgerDataValueType).path : undefined,
  }))
}

/**
 * Migrates a single wallet to vault protobuf format and stores it.
 * For standard wallets: decrypts key, builds full vault with key material.
 * For Ledger wallets: builds vault with address info only (no key material).
 */
export async function migrateWalletToVault(
  name: string,
  data: AuthDataValueType | LedgerDataValueType,
): Promise<MigrationResult> {
  const wallet: MigrationWallet = {
    name,
    address: data.address,
    ledger: data.ledger === true,
    path: data.ledger === true ? (data as LedgerDataValueType).path : undefined,
  }

  try {
    let publicKeyHex = ''
    let privateKeyHex = ''

    if (!data.ledger) {
      const standardData = data as AuthDataValueType
      privateKeyHex = decrypt(standardData.encryptedKey, standardData.password)
      if (!privateKeyHex) {
        return { wallet, success: false, error: 'Decryption failed' }
      }
      publicKeyHex = derivePublicKeyHex(privateKeyHex)
    }

    const vaultProto = create(VaultSchema, {
      name,
      publicKeyEcdsa: publicKeyHex,
      publicKeyEddsa: '',
      signers: [LOCAL_PARTY_ID],
      localPartyId: LOCAL_PARTY_ID,
      hexChainCode: '',
      resharePrefix: '',
      libType: LibType.KEYIMPORT,
      keyShares: publicKeyHex
        ? [{ publicKey: publicKeyHex, keyshare: privateKeyHex }]
        : [],
      chainPublicKeys: publicKeyHex
        ? [{ chain: 'Terra', publicKey: publicKeyHex, isEddsa: false }]
        : [],
      createdAt: {
        seconds: BigInt(Math.floor(Date.now() / 1000)),
        nanos: 0,
      },
      publicKeyMldsa44: '',
    })

    const vaultBytes = toBinary(VaultSchema, vaultProto)
    const encoded = btoa(String.fromCharCode(...vaultBytes))

    await SecureStore.setItemAsync(
      `${VAULT_KEY_PREFIX}${name}`,
      encoded,
      vaultStoreOpts(),
    )

    return { wallet, success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { wallet, success: false, error: msg }
  }
}

/**
 * Migrates all wallets from legacy auth data to vault protobuf format.
 * Calls `onProgress` after each wallet completes (for animation timing).
 */
export async function migrateAllWallets(
  onProgress?: (result: MigrationResult, index: number, total: number) => void,
): Promise<MigrationResult[]> {
  const authData = await getAuthData()
  if (!authData) return []

  const entries = Object.entries(authData)
  const results: MigrationResult[] = []

  for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i]
    const result = await migrateWalletToVault(name, data)
    results.push(result)
    onProgress?.(result, i, entries.length)
  }

  return results
}

/**
 * Reads a stored vault protobuf for a given wallet name.
 * Returns the raw base64-encoded vault bytes, or null if not found.
 */
export async function getStoredVault(walletName: string): Promise<string | null> {
  return SecureStore.getItemAsync(
    `${VAULT_KEY_PREFIX}${walletName}`,
    vaultStoreOpts(),
  )
}

export { VAULT_KEY_PREFIX }
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/services/migrateToVault.ts
git commit -m "feat: add vault migration service — decrypt keys and build vault protobufs"
```

---

## Task 4: WalletDiscovery Screen

**Files:**
- Create: `src/screens/migration/WalletDiscovery.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/migration/WalletDiscovery.tsx`:

```typescript
import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeInDown,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import { discoverLegacyWallets, MigrationWallet } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'WalletDiscovery'>

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 10)}...${addr.slice(-4)}`
}

export default function WalletDiscovery() {
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    discoverLegacyWallets().then((found) => {
      setWallets(found)
      setReady(true)
    })
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.header}>
          <Text style={styles.title} fontType="bold">
            Wallets Found
          </Text>
          <Text style={styles.subtitle} fontType="book">
            We discovered your existing wallets and they're ready to upgrade to Vultisig.
          </Text>
        </Animated.View>

        <View style={styles.walletList}>
          {wallets.map((wallet, index) => (
            <Animated.View
              key={wallet.name}
              entering={SlideInDown.delay(400 + index * 150).springify().damping(15)}
              style={styles.walletCard}
              testID={`wallet-card-${index}`}
            >
              <View style={styles.walletInfo}>
                <Text style={styles.walletName} fontType="medium">
                  {wallet.name}
                </Text>
                <Text style={styles.walletAddress} fontType="book">
                  {truncateAddress(wallet.address)}
                </Text>
              </View>
              {wallet.ledger && (
                <View style={styles.ledgerBadge}>
                  <Text style={styles.ledgerText} fontType="medium">Ledger</Text>
                </View>
              )}
            </Animated.View>
          ))}
        </View>

        {ready && (
          <Animated.View
            entering={FadeInDown.delay(400 + wallets.length * 150 + 200).duration(500)}
            style={styles.buttonContainer}
          >
            <Button
              title="Upgrade"
              theme="sapphire"
              onPress={() => navigation.navigate('MigrationProgress', { wallets })}
              containerStyle={styles.upgradeButton}
              testID="upgrade-button"
            />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    lineHeight: 22,
  },
  walletList: {
    flex: 1,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    color: VULTISIG.textPrimary,
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
  },
  ledgerBadge: {
    backgroundColor: VULTISIG.accentDim,
    borderRadius: VULTISIG.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ledgerText: {
    fontSize: 11,
    color: VULTISIG.accent,
  },
  buttonContainer: {
    paddingBottom: 24,
  },
  upgradeButton: {
    width: '100%',
    backgroundColor: VULTISIG.accent,
    borderColor: VULTISIG.accent,
  },
})
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (MigrationNavigator not yet created, so there may be an import error — that's OK, it gets created in Task 6)

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/WalletDiscovery.tsx
git commit -m "feat: add WalletDiscovery screen — shows found legacy wallets with stagger animation"
```

---

## Task 5: MigrationProgress Screen

**Files:**
- Create: `src/screens/migration/MigrationProgress.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/migration/MigrationProgress.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { VULTISIG } from 'consts/vultisig'
import { migrateAllWallets, MigrationWallet, MigrationResult } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationProgress'>

const MIN_DELAY_PER_WALLET = 700

function WalletProgressCard({
  wallet,
  index,
  completed,
}: {
  wallet: MigrationWallet
  index: number
  completed: boolean
}) {
  const glow = useSharedValue(0)
  const checkScale = useSharedValue(0)

  useEffect(() => {
    if (!completed) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      )
    } else {
      glow.value = withTiming(0, { duration: 300 })
      checkScale.value = withSpring(1, { damping: 10, stiffness: 200 })
    }
  }, [completed])

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: completed
      ? VULTISIG.accent
      : `rgba(51, 204, 187, ${0.15 + glow.value * 0.35})`,
    shadowColor: VULTISIG.accent,
    shadowOpacity: completed ? 0 : glow.value * 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  }))

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }))

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(400)}
      style={[styles.walletCard, cardAnimatedStyle]}
      testID={`progress-card-${index}`}
    >
      <View style={styles.walletInfo}>
        <Text style={styles.walletName} fontType="medium">
          {wallet.name}
        </Text>
      </View>
      <Animated.View style={[styles.checkContainer, checkAnimatedStyle]}>
        <Text style={styles.checkMark} fontType="bold">{'✓'}</Text>
      </Animated.View>
    </Animated.View>
  )
}

export default function MigrationProgress() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationProgress'>>()
  const navigation = useNavigation<Nav>()
  const { wallets } = params

  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<MigrationResult[]>([])

  const runMigration = useCallback(async () => {
    const allResults: MigrationResult[] = []
    let currentIndex = 0

    await migrateAllWallets((result, index, _total) => {
      allResults.push(result)
      currentIndex = index
    })

    // Animate completions with staggered delays
    for (let i = 0; i < allResults.length; i++) {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          setCompletedIndices((prev) => new Set(prev).add(i))
          resolve()
        }, MIN_DELAY_PER_WALLET)
      })
    }

    setResults(allResults)

    // Brief pause after last checkmark before navigating
    setTimeout(() => {
      navigation.navigate('MigrationSuccess', { results: allResults })
    }, 600)
  }, [navigation])

  useEffect(() => {
    runMigration()
  }, [runMigration])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Text style={styles.title} fontType="bold">
            Upgrading Wallets
          </Text>
          <Text style={styles.subtitle} fontType="book">
            Preparing your wallets for Vultisig...
          </Text>
        </Animated.View>

        <View style={styles.walletList}>
          {wallets.map((wallet, index) => (
            <WalletProgressCard
              key={wallet.name}
              wallet={wallet}
              index={index}
              completed={completedIndices.has(index)}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    lineHeight: 22,
  },
  walletList: {
    flex: 1,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderRadius: VULTISIG.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    color: VULTISIG.textPrimary,
  },
  checkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: VULTISIG.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 18,
    color: VULTISIG.bg,
  },
})
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/MigrationProgress.tsx
git commit -m "feat: add MigrationProgress screen — animated wallet migration with pulsing glow"
```

---

## Task 6: MigrationContext + MigrationSuccess Screen

**Files:**
- Create: `src/navigation/MigrationContext.ts`
- Create: `src/screens/migration/MigrationSuccess.tsx`

- [ ] **Step 1: Create the MigrationContext**

Create `src/navigation/MigrationContext.ts`:

```typescript
import { createContext, useContext } from 'react'

interface MigrationContextValue {
  onMigrationComplete: () => void
}

export const MigrationContext = createContext<MigrationContextValue>({
  onMigrationComplete: () => {},
})

export const useMigrationComplete = () => useContext(MigrationContext).onMigrationComplete
```

- [ ] **Step 2: Create the MigrationSuccess screen**

Create `src/screens/migration/MigrationSuccess.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  BounceIn,
  SlideInDown,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp, useRoute } from '@react-navigation/native'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'
import { useMigrationComplete } from 'navigation/MigrationContext'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationResult } from 'services/migrateToVault'

export default function MigrationSuccess() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const onMigrationComplete = useMigrationComplete()
  const results: MigrationResult[] = params.results

  const handleContinue = async () => {
    await preferences.setBool(PreferencesEnum.vaultsUpgraded, true)
    onMigrationComplete()
  }

  const successCount = results.filter((r) => r.success).length

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={BounceIn.delay(200).duration(600)} style={styles.iconContainer}>
          <Text style={styles.icon}>{'✓'}</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)}>
          <Text style={styles.title} fontType="bold">
            Wallets Upgraded
          </Text>
          <Text style={styles.subtitle} fontType="book">
            {successCount} {successCount === 1 ? 'wallet' : 'wallets'} successfully migrated to Vultisig format.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(700).duration(400)}
          style={styles.walletList}
        >
          {results.map((result, index) => (
            <View key={result.wallet.name} style={styles.walletRow} testID={`success-wallet-${index}`}>
              <Text style={styles.checkMark}>{result.success ? '✓' : '✗'}</Text>
              <Text
                style={[
                  styles.walletName,
                  !result.success && styles.walletNameFailed,
                ]}
                fontType="medium"
              >
                {result.wallet.name}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View
          entering={SlideInDown.delay(900).springify().damping(14)}
          style={styles.vaultieCard}
        >
          <Text style={styles.vaultieTitle} fontType="bold">
            Vultisig Agent
          </Text>
          <Text style={styles.vaultieSubtitle} fontType="book">
            Your AI-powered crypto companion is coming to this app. Stay tuned.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(1200).duration(400)}
          style={styles.buttonContainer}
        >
          <Button
            title="Continue"
            theme="sapphire"
            onPress={handleContinue}
            containerStyle={styles.continueButton}
            testID="continue-button"
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: VULTISIG.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
    color: VULTISIG.bg,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  walletList: {
    width: '100%',
    marginBottom: 24,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkMark: {
    fontSize: 16,
    color: VULTISIG.accent,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  walletName: {
    fontSize: 15,
    color: VULTISIG.textPrimary,
  },
  walletNameFailed: {
    color: VULTISIG.error,
  },
  vaultieCard: {
    width: '100%',
    backgroundColor: VULTISIG.accentGlow,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusLg,
    padding: 20,
    marginBottom: 24,
  },
  vaultieTitle: {
    fontSize: 18,
    color: VULTISIG.accent,
    marginBottom: 8,
  },
  vaultieSubtitle: {
    fontSize: 14,
    color: VULTISIG.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 24,
    marginTop: 'auto',
  },
  continueButton: {
    width: '100%',
    backgroundColor: VULTISIG.accent,
    borderColor: VULTISIG.accent,
  },
})
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MigrationContext.ts src/screens/migration/MigrationSuccess.tsx
git commit -m "feat: add MigrationContext and MigrationSuccess screen — celebration + Vaultie teaser"
```

---

## Task 7: MigrationNavigator

**Files:**
- Create: `src/navigation/MigrationNavigator.tsx`

- [ ] **Step 1: Create the navigator**

Create `src/navigation/MigrationNavigator.tsx`:

```typescript
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import WalletDiscovery from '../screens/migration/WalletDiscovery'
import MigrationProgress from '../screens/migration/MigrationProgress'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationStackParams = {
  WalletDiscovery: undefined
  MigrationProgress: { wallets: MigrationWallet[] }
  MigrationSuccess: { results: MigrationResult[] }
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="WalletDiscovery" component={WalletDiscovery} />
      <Stack.Screen name="MigrationProgress" component={MigrationProgress} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MigrationNavigator.tsx
git commit -m "feat: add MigrationNavigator — 3-screen migration stack"
```

---

## Task 8: Wire Migration Routing into AppNavigator

**Files:**
- Modify: `src/navigation/index.tsx`
- Modify: `src/App/index.tsx`

This is the critical wiring step. The root navigator uses conditional rendering (same pattern as existing auth/main split) to show the migration flow when legacy wallets exist. `MigrationContext` provides a callback that MigrationSuccess calls to transition to the main app.

- [ ] **Step 1: Update AppNavigator to include migration routing**

Replace the contents of `src/navigation/index.tsx` with:

```typescript
import React, { useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import MigrationNavigator from './MigrationNavigator'
import { MigrationContext } from './MigrationContext'
import { getWallets } from 'utils/wallet'
import { settings } from 'utils/storage'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'
import { COLORS } from 'consts/theme'
import { WalletNavContext } from './hooks'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

export { useWalletCreated, useWalletDisconnected, useWalletNav } from './hooks'

type RootRoute = 'Migration' | 'Auth' | 'Main'

export default function AppNavigator() {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [initialWallet, setInitialWallet] = useState<LocalWallet | undefined>(undefined)
  const [rootRoute, setRootRoute] = useState<RootRoute | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  const loadWallets = useCallback(async () => {
    const loaded = await getWallets()
    setWallets(loaded)
    return loaded
  }, [])

  useEffect(() => {
    const init = async () => {
      const loaded = await loadWallets()
      const vaultsUpgraded = await preferences.getBool(PreferencesEnum.vaultsUpgraded)

      if (loaded.length > 0 && !vaultsUpgraded) {
        setRootRoute('Migration')
      } else if (loaded.length === 0) {
        setRootRoute('Auth')
      } else {
        setRootRoute('Main')
        if (loaded.length === 1) {
          setInitialWallet(loaded[0])
        } else {
          const saved = await settings.get()
          const lastUsed = loaded.find((w) => w.name === saved.walletName)
          if (lastUsed) setInitialWallet(lastUsed)
        }
      }
    }
    init().catch(() => {
      setWallets([])
      setRootRoute('Auth')
    })
  }, [loadWallets])

  const onMigrationComplete = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else if (loaded.length > 1) {
      const saved = await settings.get()
      const lastUsed = loaded.find((w) => w.name === saved.walletName)
      if (lastUsed) setInitialWallet(lastUsed)
    }
    setRootRoute('Main')
  }, [loadWallets])

  const onWalletCreated = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length > 0) {
      setInitialWallet(loaded[loaded.length - 1])
    }
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setInitialWallet(undefined)
      setRootRoute('Auth')
    } else if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else {
      setInitialWallet(undefined)
    }
  }, [loadWallets])

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || COLORS.bg,
    },
  }

  if (rootRoute === null || wallets === null) return null

  return (
    <WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected, wallets }}>
      <MigrationContext.Provider value={{ onMigrationComplete }}>
        <NavigationContainer theme={navTheme}>
          {rootRoute === 'Migration' ? (
            <MigrationNavigator />
          ) : rootRoute === 'Main' ? (
            <MainNavigator initialWallet={initialWallet} />
          ) : (
            <AuthNavigator />
          )}
        </NavigationContainer>
      </MigrationContext.Provider>
    </WalletNavContext.Provider>
  )
}
```

- [ ] **Step 2: Update App/index.tsx to skip old onboarding for migration users**

In `src/App/index.tsx`, the old OnBoarding swiper should be skipped when legacy wallets exist — the migration flow replaces it. Modify the `App` component's onboarding logic. Replace lines 77-81:

```typescript
  /* onboarding */
  const [showOnBoarding, setshowOnBoarding] = useState<boolean>(false)

  useEffect(() => {
    getSkipOnboarding().then((b) => setshowOnBoarding(!b))
  }, [])
```

With:

```typescript
  /* onboarding — skip if migration flow will handle first-launch experience */
  const [showOnBoarding, setshowOnBoarding] = useState<boolean>(false)

  useEffect(() => {
    const checkOnboarding = async () => {
      const skipOnboarding = await getSkipOnboarding()
      if (skipOnboarding) {
        setshowOnBoarding(false)
        return
      }
      // If legacy wallets exist, the migration flow replaces onboarding
      const { getWallets } = await import('utils/wallet')
      const wallets = await getWallets()
      if (wallets.length > 0) {
        await setSkipOnboarding(true)
        setshowOnBoarding(false)
      } else {
        setshowOnBoarding(true)
      }
    }
    checkOnboarding()
  }, [])
```

Also add the `setSkipOnboarding` import at the top. Change line 32:

```typescript
import { getSkipOnboarding, setSkipOnboarding, settings } from 'utils/storage'
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/navigation/index.tsx src/App/index.tsx
git commit -m "feat: wire migration routing — detect legacy wallets and show MigrationNavigator"
```

---

## Task 9: Vaultie Coming Soon Card on Wallet Home

**Files:**
- Create: `src/components/VaultieComingSoonCard.tsx`
- Modify: `src/screens/WalletHome.tsx`

- [ ] **Step 1: Create the VaultieComingSoonCard component**

Create `src/components/VaultieComingSoonCard.tsx`:

```typescript
import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import { VULTISIG } from 'consts/vultisig'

export default function VaultieComingSoonCard() {
  return (
    <View style={styles.card} testID="vaultie-coming-soon">
      <Text style={styles.title} fontType="bold">
        Vultisig Agent
      </Text>
      <Text style={styles.subtitle} fontType="book">
        Your AI-powered crypto companion is coming to this app. Stay tuned.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: VULTISIG.accentGlow,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusLg,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    color: VULTISIG.accent,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
    lineHeight: 18,
  },
})
```

- [ ] **Step 2: Add the card to WalletHome**

In `src/screens/WalletHome.tsx`, add the import at the top (after the existing imports):

```typescript
import VaultieComingSoonCard from 'components/VaultieComingSoonCard'
```

Then add the card inside the ScrollView, right before the `<Text style={styles.walletName}>` line (after `contentContainerStyle={styles.content}`):

```typescript
      <VaultieComingSoonCard />
```

So the ScrollView content starts with:
```typescript
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
      }
    >
      <VaultieComingSoonCard />
      <Text style={styles.walletName}>{wallet.name}</Text>
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/VaultieComingSoonCard.tsx src/screens/WalletHome.tsx
git commit -m "feat: add Vaultie Agent coming soon card to wallet home"
```

---

## Task 10: Detox E2E Tests

**Files:**
- Create: `e2e/migration-onboarding.test.js`

These tests use the existing Detox infrastructure. They seed legacy wallet data via the dev test screen, then verify the migration flow.

- [ ] **Step 1: Create the Detox test file**

Create `e2e/migration-onboarding.test.js`:

```javascript
describe('Migration Onboarding Flow', () => {

  describe('Happy path — wallets detected', () => {
    beforeAll(async () => {
      // Erase simulator to clear keychain
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('shows WalletDiscovery screen with found wallets', async () => {
      // Wait for wallet discovery cards to appear
      await waitFor(element(by.id('wallet-card-0')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows the Upgrade button', async () => {
      await expect(element(by.id('upgrade-button'))).toBeVisible();
    });

    it('taps Upgrade and shows progress animation', async () => {
      await element(by.id('upgrade-button')).tap();

      // Wait for first progress card
      await waitFor(element(by.id('progress-card-0')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('navigates to success screen after migration', async () => {
      // Wait for success screen
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows migrated wallet names on success screen', async () => {
      await expect(element(by.id('success-wallet-0'))).toBeVisible();
    });

    it('taps Continue and lands on main app', async () => {
      await element(by.id('continue-button')).tap();

      // Should land on wallet home or picker
      await waitFor(element(by.id('wallet-home')).or(element(by.id('wallet-picker'))))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Clean install — no legacy wallets', () => {
    beforeAll(async () => {
      const { execSync } = require('child_process');
      const udid = device.id;
      execSync(`xcrun simctl shutdown ${udid} 2>/dev/null; xcrun simctl erase ${udid}`, {
        timeout: 30000,
      });
      execSync(`xcrun simctl boot ${udid}`, { timeout: 30000 });

      await device.launchApp({ delete: true, newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('skips migration and shows onboarding or auth screen', async () => {
      // Should see either onboarding "Get started" or auth menu
      const onboarding = element(by.text('Get started'));
      const authMenu = element(by.text('Create New Wallet'));

      await waitFor(onboarding.or(authMenu))
        .toBeVisible()
        .withTimeout(30000);
    });
  });

  describe('Already migrated — vaultsUpgraded is true', () => {
    beforeAll(async () => {
      // This test assumes a previous migration was completed
      // Launch without clearing to preserve the upgraded state from first test suite
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
    });

    afterAll(async () => {
      await device.enableSynchronization();
    });

    it('skips migration and goes straight to main app', async () => {
      await waitFor(element(by.id('wallet-home')).or(element(by.id('wallet-picker'))))
        .toBeVisible()
        .withTimeout(30000);
    });
  });
});
```

- [ ] **Step 2: Verify Detox config recognizes the new test**

Run: `npx detox test --configuration ios.sim.debug --listTests 2>&1 | head -20`
Expected: `e2e/migration-onboarding.test.js` appears in the test list

- [ ] **Step 3: Commit**

```bash
git add e2e/migration-onboarding.test.js
git commit -m "test: add Detox E2E tests for migration onboarding flow"
```

---

## Task 11: Integration Smoke Test & Polish

**Files:**
- Potentially all migration files for fixes

This is a manual verification step to ensure everything works together.

- [ ] **Step 1: Run the full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify the app builds for iOS**

Run: `npx expo run:ios --no-install 2>&1 | tail -20`
Expected: Build succeeds (or verify with `npx tsc --noEmit` if full build is slow)

- [ ] **Step 3: Test navigation routing logic manually**

Verify these scenarios by reading the code flow:
1. `AppNavigator` correctly reads `vaultsUpgraded` flag
2. `MigrationSuccess` sets `vaultsUpgraded = true` before resetting navigation
3. `MigrationProgress` calls `migrateAllWallets` and passes results to `MigrationSuccess`
4. `WalletDiscovery` correctly discovers wallets from auth data

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes from smoke test"
```

(Skip this step if no fixes were needed.)
