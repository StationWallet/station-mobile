# Wallet List Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WalletPicker, WalletHome, and WalletsFound with a single WalletList screen that serves as the app's sole wallet management surface.

**Architecture:** A new `WalletList` screen becomes the initial (and only) wallet screen in `MainNavigator`. It uses a new `WalletCard` component that shows migration status, export, and delete actions. Tapping a legacy wallet starts migration; tapping a migrated wallet navigates to `MigrationSuccess`. The `MigrationNavigator` drops its `WalletsFound` screen and `MigrationSuccess` gets updated to return to `WalletList` via `onMigrationComplete`.

**Tech Stack:** React Native, React Navigation (stack navigator), TypeScript, Expo

---

## File Structure

**New files:**
- `src/components/WalletCard.tsx` — Individual wallet card with name, address, balance, terra-only badge, migration status, export button, delete button
- `src/screens/WalletList.tsx` — Scrollable wallet list screen with header, card list, and "Add Wallet" footer

**Deleted files:**
- `src/screens/WalletPicker.tsx`
- `src/screens/WalletHome.tsx`
- `src/screens/migration/WalletsFound.tsx`
- `src/components/migration/WalletMigrationCard.tsx`

**Modified files:**
- `src/navigation/MainNavigator.tsx` — Replace WalletPicker/WalletHome with WalletList, remove Receive/History
- `src/navigation/MigrationNavigator.tsx` — Remove WalletsFound screen and type
- `src/navigation/index.tsx` — Simplify pickInitialWallet, remove initialWallet prop
- `src/screens/migration/MigrationSuccess.tsx` — Replace WalletsFound navigation with onMigrationComplete
- `src/screens/migration/MigrationHome.tsx` — Replace WalletsFound navigation with WalletList-compatible flow
- `src/screens/auth/WalletSuccessScreen.tsx` — Replace WalletPicker navigation with WalletList
- `src/utils/migrationNav.ts` — Update comment referencing WalletsFound
- `e2e/fast-vault-migration.test.js` — Update WalletPicker/WalletHome references
- `e2e/fast-vault-partial-migration.test.js` — Update WalletsFound references
- `e2e/migration-onboarding.test.js` — Update WalletsFound references

---

### Task 1: Create WalletCard component

**Files:**
- Create: `src/components/WalletCard.tsx`

- [ ] **Step 1: Create the WalletCard component**

```tsx
import React from 'react'
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'

type Props = {
  name: string
  address: string
  terraOnly: boolean
  isFastVault: boolean
  onPress: () => void
  onExport: () => void
  onDelete: () => void
  testID?: string
}

export default function WalletCard({
  name,
  address,
  terraOnly,
  isFastVault,
  onPress,
  onExport,
  onDelete,
  testID,
}: Props): React.ReactElement {
  const handleDelete = (): void => {
    Alert.alert(
      'Remove Wallet',
      'This will remove the wallet from this device. Make sure you have your seed phrase backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    )
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={styles.nameRow}>
          <Text fontType="brockmann-medium" style={styles.name}>
            {name}
          </Text>
          {terraOnly && (
            <View style={styles.terraOnlyBadge}>
              <Text
                fontType="brockmann-medium"
                style={styles.terraOnlyText}
              >
                Terra only
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text fontType="brockmann" style={styles.address}>
        {UTIL.truncate(address, [14, 3])}
      </Text>

      <View style={styles.divider} />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={testID ? `${testID}-delete` : undefined}
        >
          <Text fontType="brockmann-medium" style={styles.deleteText}>
            Remove
          </Text>
        </TouchableOpacity>

        <View style={styles.rightButtons}>
          <Button
            title="Export"
            theme="secondaryDark"
            titleFontType="brockmann-medium"
            onPress={onExport}
            containerStyle={styles.exportButton}
            titleStyle={styles.actionButtonText}
            testID={testID ? `${testID}-export` : undefined}
          />
          {isFastVault ? (
            <View style={styles.migratedBadge}>
              <Text
                fontType="brockmann-medium"
                style={styles.migratedText}
              >
                {'\u2713'} Fast Vault
              </Text>
            </View>
          ) : (
            <Button
              title="Migrate to a vault"
              theme="ctaBlue"
              titleFontType="brockmann-medium"
              onPress={onPress}
              containerStyle={styles.migrateButton}
              titleStyle={styles.actionButtonText}
              testID={testID ? `${testID}-migrate` : undefined}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MIGRATION.surface1,
    borderColor: MIGRATION.borderLight,
    borderWidth: 1,
    borderRadius: MIGRATION.radiusCard,
    padding: MIGRATION.cardPadding,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    color: MIGRATION.textPrimary,
  },
  terraOnlyBadge: {
    backgroundColor: 'rgba(100, 160, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  terraOnlyText: {
    color: '#64A0FF',
    fontSize: 11,
  },
  address: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: MIGRATION.borderLight,
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  deleteText: {
    fontSize: 13,
    color: '#ff5c5c',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    height: MIGRATION.smallButtonHeight,
    borderRadius: MIGRATION.radiusSmallButton,
    paddingHorizontal: 16,
  },
  migrateButton: {
    height: MIGRATION.smallButtonHeight,
    borderRadius: MIGRATION.radiusSmallButton,
    paddingHorizontal: 20,
  },
  migratedBadge: {
    height: MIGRATION.smallButtonHeight,
    borderRadius: MIGRATION.radiusSmallButton,
    backgroundColor: MIGRATION.buttonSecondary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  migratedText: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
  },
  actionButtonText: {
    fontSize: 14,
  },
})
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors from `WalletCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/WalletCard.tsx
git commit -m "feat: add WalletCard component for consolidated wallet list"
```

---

### Task 2: Create WalletList screen

**Files:**
- Create: `src/screens/WalletList.tsx`

- [ ] **Step 1: Create the WalletList screen**

```tsx
import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { NavigationProp, useNavigation } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { deleteWallet } from 'utils/wallet'
import { isVaultFastVault } from 'services/migrateToVault'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'
import WalletCard from 'components/WalletCard'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletList(): React.ReactElement {
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const { wallets, onWalletDisconnected } = useWalletNav()
  const [fastVaultMap, setFastVaultMap] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    if (wallets.length === 0) return
    Promise.all(
      wallets.map((w) =>
        isVaultFastVault(w.name).then((isFast) => ({
          name: w.name,
          isFast,
        }))
      )
    ).then((results) => {
      const map: Record<string, boolean> = {}
      results.forEach(({ name, isFast }) => {
        map[name] = isFast
      })
      setFastVaultMap(map)
    })
  }, [wallets])

  const handlePress = async (wallet: LocalWallet): Promise<void> => {
    await settings.set({ walletName: wallet.name })
    const isFast = fastVaultMap[wallet.name]
    if (isFast) {
      navigation.navigate('Migration', {
        screen: 'MigrationSuccess',
        params: {
          migratedWalletName: wallet.name,
        },
      })
    } else {
      navigation.navigate('Migration', {
        screen: 'VaultEmail',
        params: {
          walletName: wallet.name,
          wallets: [
            {
              name: wallet.name,
              address: wallet.address,
              ledger: wallet.ledger,
            },
          ],
          mode: 'migrate' as const,
        },
      })
    }
  }

  const handleExport = (wallet: LocalWallet): void => {
    navigation.navigate('ExportPrivateKey', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const handleDelete = async (wallet: LocalWallet): Promise<void> => {
    await deleteWallet({ walletName: wallet.name })
    await onWalletDisconnected()
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text fontType="brockmann-medium" style={styles.title}>
        Your wallets
      </Text>
      <Text fontType="brockmann" style={styles.subtitle}>
        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} on
        this device
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wallets.map((wallet, index) => (
          <WalletCard
            key={wallet.name}
            name={wallet.name}
            address={wallet.address}
            terraOnly={wallet.terraOnly === true}
            isFastVault={fastVaultMap[wallet.name] === true}
            onPress={() => handlePress(wallet)}
            onExport={() => handleExport(wallet)}
            onDelete={() => handleDelete(wallet)}
            testID={`wallet-card-${index}`}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Add Wallet"
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          onPress={() => navigation.navigate('AddWalletMenu')}
          containerStyle={styles.addButton}
          testID="add-wallet-button"
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    lineHeight: 24,
    marginBottom: 4,
    paddingHorizontal: MIGRATION.screenPadding,
    marginTop: 48,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 20,
    paddingHorizontal: MIGRATION.screenPadding,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
    gap: MIGRATION.cardGap,
  },
  footer: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 16,
    paddingBottom: 24,
  },
  addButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: May have type errors until MainNavigator is updated (Task 3). That's expected.

- [ ] **Step 3: Commit**

```bash
git add src/screens/WalletList.tsx
git commit -m "feat: add WalletList screen as consolidated wallet management surface"
```

---

### Task 3: Update MainNavigator

**Files:**
- Modify: `src/navigation/MainNavigator.tsx`

- [ ] **Step 1: Replace the MainNavigator contents**

Replace the entire file with:

```tsx
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletList from '../screens/WalletList'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'
import ExportPrivateKey from '../screens/ExportPrivateKey'
import MigrationNavigator from './MigrationNavigator'
import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'
import type { MigrationMode } from './MigrationNavigator'

const CryptoTestScreen = __DEV__
  ? require('../components/CryptoTestScreen').default
  : null

const DevFullE2ETest = __DEV__
  ? require('../components/DevFullE2ETest').default
  : null

const DevSeedLegacyData = __DEV__
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = __DEV__
  ? require('../components/DevSeedCorruptData').default
  : null

const DevVerifyVault = __DEV__
  ? require('../components/DevVerifyVault').default
  : null

export type MainStackParams = {
  WalletList: undefined
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
  ExportPrivateKey: { wallet: { name: string; address: string } }
  CryptoTest: undefined
  FullE2ETest: undefined
  SeedLegacyData: undefined
  SeedCorruptData: undefined
  VerifyVault: undefined
  Migration: {
    screen: 'VaultEmail' | 'MigrationSuccess'
    params: {
      walletName?: string
      walletIndex?: number
      totalWallets?: number
      wallets?: MigrationWallet[]
      results?: MigrationResult[]
      mode?: MigrationMode
      migratedWalletName?: string
      importedVaultName?: string
    }
  }
}

const Stack = createStackNavigator<MainStackParams>()

export default function MainNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletList" component={WalletList} />
      <Stack.Screen name="AddWalletMenu" component={AuthMenu} />
      <Stack.Screen name="AddNewWallet" component={NewWalletStack} />
      <Stack.Screen
        name="AddRecoverWallet"
        component={RecoverWalletStack}
      />
      <Stack.Screen
        name="ExportPrivateKey"
        component={ExportPrivateKey}
      />
      {__DEV__ && CryptoTestScreen && (
        <Stack.Screen
          name="CryptoTest"
          component={CryptoTestScreen}
        />
      )}
      {__DEV__ && DevFullE2ETest && (
        <Stack.Screen name="FullE2ETest" component={DevFullE2ETest} />
      )}
      {__DEV__ && DevSeedLegacyData && (
        <Stack.Screen
          name="SeedLegacyData"
          component={DevSeedLegacyData}
        />
      )}
      {__DEV__ && DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
      {__DEV__ && DevVerifyVault && (
        <Stack.Screen name="VerifyVault" component={DevVerifyVault} />
      )}
      <Stack.Screen name="Migration" component={MigrationNavigator} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors from MainNavigator.tsx (may still have errors from other files referencing old types — those are fixed in subsequent tasks)

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MainNavigator.tsx
git commit -m "refactor: replace WalletPicker/WalletHome with WalletList in MainNavigator"
```

---

### Task 4: Update AppNavigator (index.tsx)

**Files:**
- Modify: `src/navigation/index.tsx`

- [ ] **Step 1: Simplify the AppNavigator**

Replace the entire file with:

```tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import MigrationNavigator from './MigrationNavigator'
import { MigrationContext } from './MigrationContext'
import { getWallets } from 'utils/wallet'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'
import { COLORS } from 'consts/theme'
import { WalletNavContext } from './hooks'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

export {
  useWalletCreated,
  useWalletDisconnected,
  useWalletNav,
} from './hooks'

type RootRoute = 'Migration' | 'Auth' | 'Main'

export default function AppNavigator(): React.ReactElement | null {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [rootRoute, setRootRoute] = useState<RootRoute | null>(null)
  const { theme } = useConfig()
  const currentTheme = theme.current

  const loadWallets = useCallback(async () => {
    const loaded = await getWallets()
    setWallets(loaded)
    return loaded
  }, [])

  useEffect(() => {
    const init = async (): Promise<void> => {
      const loaded = await loadWallets()
      const vaultsUpgraded = await preferences.getBool(
        PreferencesEnum.vaultsUpgraded
      )
      const legacyDataFound = await preferences.getBool(
        PreferencesEnum.legacyDataFound
      )

      if (loaded.length > 0 && !vaultsUpgraded && legacyDataFound) {
        setRootRoute('Migration')
      } else if (loaded.length === 0) {
        setRootRoute(__DEV__ ? 'Auth' : 'Migration')
      } else {
        setRootRoute('Main')
      }
    }
    init().catch(() => {
      setWallets([])
      setRootRoute('Auth')
    })
  }, [loadWallets])

  const onMigrationComplete = useCallback(async () => {
    await loadWallets()
    setRootRoute('Main')
  }, [loadWallets])

  const onWalletCreated = useCallback(async () => {
    await loadWallets()
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setRootRoute('Auth')
    }
  }, [loadWallets])

  const goToMigration = useCallback(() => {
    setRootRoute('Migration')
  }, [])

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background:
          themes?.[currentTheme]?.backgroundColor || COLORS.bg,
      },
    }),
    [currentTheme]
  )

  if (rootRoute === null || wallets === null) return null

  return (
    <WalletNavContext.Provider
      value={{
        onWalletCreated,
        onWalletDisconnected,
        goToMigration,
        wallets,
      }}
    >
      <MigrationContext.Provider value={{ onMigrationComplete }}>
        <NavigationContainer theme={navTheme}>
          {rootRoute === 'Migration' ? (
            <MigrationNavigator />
          ) : rootRoute === 'Main' ? (
            <MainNavigator />
          ) : (
            <AuthNavigator />
          )}
        </NavigationContainer>
      </MigrationContext.Provider>
    </WalletNavContext.Provider>
  )
}
```

Key changes:
- Removed `initialWallet` state and `pickInitialWallet` function
- `MainNavigator` no longer receives `initialWallet` prop
- `onMigrationComplete` simplified — just reloads wallets and sets route
- `onWalletCreated` simplified — just reloads wallets
- `onWalletDisconnected` simplified — reloads wallets, goes to Auth if empty
- Removed `settings` import (no longer needed for wallet name tracking here)

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "refactor: simplify AppNavigator - remove initialWallet logic"
```

---

### Task 5: Update MigrationNavigator — remove WalletsFound

**Files:**
- Modify: `src/navigation/MigrationNavigator.tsx`

- [ ] **Step 1: Remove WalletsFound from the navigator**

Replace the entire file with:

```tsx
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import RiveIntro from '../screens/migration/RiveIntro'
import MigrationHome from '../screens/migration/MigrationHome'
import VaultName from '../screens/migration/VaultName'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import VerifyEmail from '../screens/migration/VerifyEmail'
import ImportVault from '../screens/migration/ImportVault'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type {
  MigrationWallet,
  MigrationResult,
} from 'services/migrateToVault'

export type MigrationMode = 'migrate' | 'create'

const DevSeedLegacyData = __DEV__
  ? require('../components/DevSeedLegacyData').default
  : null

const DevSeedCorruptData = __DEV__
  ? require('../components/DevSeedCorruptData').default
  : null

export type MigrationStackParams = {
  RiveIntro: undefined
  MigrationHome: undefined
  VaultName: undefined
  VaultEmail: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: MigrationMode
    email?: string
  }
  VaultPassword: {
    walletName: string
    wallets?: MigrationWallet[]
    mode: MigrationMode
    email: string
  }
  KeygenProgress: {
    walletName: string
    walletIndex?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    mode: MigrationMode
    email: string
    password: string
  }
  VerifyEmail: {
    walletName: string
    walletIndex?: number
    wallets?: MigrationWallet[]
    results?: MigrationResult[]
    mode: MigrationMode
    email: string
    publicKey: string
  }
  ImportVault: undefined
  MigrationSuccess: {
    results?: MigrationResult[]
    wallets?: MigrationWallet[]
    migratedWalletName?: string
    importedVaultName?: string
  }
  SeedLegacyData: undefined
  SeedCorruptData: undefined
}

const Stack = createStackNavigator<MigrationStackParams>()

export default function MigrationNavigator(): React.ReactElement {
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
      <Stack.Screen
        name="MigrationHome"
        component={MigrationHome}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen name="VaultName" component={VaultName} />
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen
        name="KeygenProgress"
        component={KeygenProgress}
      />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="ImportVault" component={ImportVault} />
      <Stack.Screen
        name="MigrationSuccess"
        component={MigrationSuccess}
      />
      {__DEV__ && DevSeedLegacyData && (
        <Stack.Screen
          name="SeedLegacyData"
          component={DevSeedLegacyData}
        />
      )}
      {__DEV__ && DevSeedCorruptData && (
        <Stack.Screen
          name="SeedCorruptData"
          component={DevSeedCorruptData}
        />
      )}
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/navigation/MigrationNavigator.tsx
git commit -m "refactor: remove WalletsFound from MigrationNavigator"
```

---

### Task 6: Update MigrationSuccess — replace WalletsFound navigation

**Files:**
- Modify: `src/screens/migration/MigrationSuccess.tsx`

- [ ] **Step 1: Replace "Migrate another wallet" navigation**

In `MigrationSuccess.tsx`, the "Migrate another wallet" button currently navigates to `WalletsFound`. Change it to call `onMigrationComplete` instead, which returns the user to `WalletList` in the Main route.

Replace:

```tsx
        {hasUnmigrated && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('WalletsFound', {
                wallets,
                results,
              })
            }
            testID="migrate-another-wallet"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.migrateAnother}
            >
              Migrate another wallet
            </Text>
          </TouchableOpacity>
        )}
```

With:

```tsx
        <TouchableOpacity
          onPress={handleBack}
          testID="migrate-another-wallet"
        >
          <Text
            fontType="brockmann-medium"
            style={styles.migrateAnother}
          >
            Continue to wallets
          </Text>
        </TouchableOpacity>
```

Note: The button is now always shown (not conditional on `hasUnmigrated`) since the user always needs a way back to the wallet list. The label changes to "Continue to wallets" since it's no longer migration-specific.

Also update the MigrationToolbar's `onBack` prop to use `handleBack`:

Replace:
```tsx
      <MigrationToolbar
        onBack={onMigrationComplete}
        testID="success-back"
      />
```

With:
```tsx
      <MigrationToolbar
        onBack={handleBack}
        testID="success-back"
      />
```

- [ ] **Step 2: Clean up unused variables and fix back navigation**

Remove `wallets`, `results`, and `hasUnmigrated` variables. Keep `navigation` but change the back handler to handle both entry paths: when called from the root MigrationNavigator (first-time migration) `onMigrationComplete` switches the root route; when called from the nested Migration screen inside MainNavigator (tapping a migrated wallet) we also need to pop back to WalletList.

Replace:

```tsx
  const { params } =
    useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const navigation =
    useNavigation<
      StackNavigationProp<MigrationStackParams, 'MigrationSuccess'>
    >()
  const onMigrationComplete = useMigrationComplete()

  const wallets = params.wallets
  const results = params.results ?? []
  const hasUnmigrated = wallets != null && wallets.length > 0
```

With:

```tsx
  const { params } =
    useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const navigation = useNavigation()
  const onMigrationComplete = useMigrationComplete()

  const handleBack = (): void => {
    onMigrationComplete()
    // If nested inside MainNavigator (tapped a migrated wallet from WalletList),
    // pop the Migration screen to return to WalletList.
    const parent = navigation.getParent()
    if (parent?.canGoBack()) {
      parent.goBack()
    }
  }
```

Also simplify the imports:

Replace:

```tsx
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
```

With:

```tsx
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/screens/migration/MigrationSuccess.tsx
git commit -m "refactor: MigrationSuccess navigates back to WalletList via onMigrationComplete"
```

---

### Task 7: Update MigrationHome — replace WalletsFound navigation

**Files:**
- Modify: `src/screens/migration/MigrationHome.tsx`

- [ ] **Step 1: Replace WalletsFound navigation with direct VaultEmail navigation**

In `MigrationHome.tsx`, the "Start Migration" button navigates to `WalletsFound` when legacy wallets exist. Since `WalletsFound` is removed, this should call `onMigrationComplete` to go to `WalletList` (which now shows all wallets with migration actions).

Replace the `handleCta` function:

```tsx
  const handleCta = (): void => {
    if (hasLegacyWallets) {
      navigation.navigate('WalletsFound', { wallets })
    } else {
      navigation.navigate('VaultName')
    }
  }
```

With:

```tsx
  const handleCta = (): void => {
    if (hasLegacyWallets) {
      onMigrationComplete()
    } else {
      navigation.navigate('VaultName')
    }
  }
```

- [ ] **Step 2: Add onMigrationComplete import and hook**

Add the import at the top:

```tsx
import { useMigrationComplete } from 'navigation/MigrationContext'
```

Add the hook inside the component (after the `navigation` line):

```tsx
  const onMigrationComplete = useMigrationComplete()
```

- [ ] **Step 3: Remove unused WalletsFound import reference**

The `WalletsFound` type from `MigrationStackParams` is no longer used for navigation. The existing nav type `StackNavigationProp<MigrationStackParams, 'MigrationHome'>` is still fine since `MigrationHome` is still in the params.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/screens/migration/MigrationHome.tsx
git commit -m "refactor: MigrationHome navigates to WalletList instead of WalletsFound"
```

---

### Task 8: Update WalletSuccessScreen — replace WalletPicker reference

**Files:**
- Modify: `src/screens/auth/WalletSuccessScreen.tsx`

- [ ] **Step 1: Replace WalletPicker navigation with WalletList**

In `WalletSuccessScreen.tsx`, line 43, replace:

```tsx
      navigation.getParent()?.navigate('WalletPicker')
```

With:

```tsx
      navigation.getParent()?.navigate('WalletList')
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/WalletSuccessScreen.tsx
git commit -m "fix: WalletSuccessScreen navigates to WalletList instead of WalletPicker"
```

---

### Task 9: Update migrationNav.ts — fix comment

**Files:**
- Modify: `src/utils/migrationNav.ts`

- [ ] **Step 1: Update the comment**

Replace:

```tsx
 * "Migrate another wallet" to return to WalletsFound for the next one.
```

With:

```tsx
 * "Continue to wallets" to return to the wallet list.
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/migrationNav.ts
git commit -m "docs: update migrationNav comment to reflect WalletsFound removal"
```

---

### Task 10: Delete old files

**Files:**
- Delete: `src/screens/WalletPicker.tsx`
- Delete: `src/screens/WalletHome.tsx`
- Delete: `src/screens/migration/WalletsFound.tsx`
- Delete: `src/components/migration/WalletMigrationCard.tsx`

- [ ] **Step 1: Delete the old files**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
git rm src/screens/WalletPicker.tsx
git rm src/screens/WalletHome.tsx
git rm src/screens/migration/WalletsFound.tsx
git rm src/components/migration/WalletMigrationCard.tsx
```

- [ ] **Step 2: Verify no remaining imports reference deleted files**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && grep -rn "WalletPicker\|WalletHome\|WalletsFound\|WalletMigrationCard" src/ --include='*.ts' --include='*.tsx' | grep -v node_modules`

Expected: No results referencing imports of deleted files. The only matches should be type references in `MainStackParams` (which we already updated) or the navigation hook `WalletNavContext` (which is fine).

- [ ] **Step 3: Verify full project compiles**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete WalletPicker, WalletHome, WalletsFound, WalletMigrationCard"
```

---

### Task 11: Update E2E tests

**Files:**
- Modify: `e2e/fast-vault-migration.test.js`
- Modify: `e2e/fast-vault-partial-migration.test.js`
- Modify: `e2e/migration-onboarding.test.js`

- [ ] **Step 1: Update fast-vault-migration.test.js**

The "Export DKLS vault" section (lines 184-230) references WalletPicker and WalletHome. After this change, the app always lands on WalletList. Replace the export test's `beforeAll`:

Replace the section that waits for WalletPicker or WalletHome (approximately lines 186-202):

```js
      // Relaunch and navigate to WalletHome
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();

      // Wait for either WalletPicker or WalletHome
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(15000);

      // If we see "Select Wallet" title, we're on WalletPicker — tap the wallet
      try {
        await expect(element(by.text('Select Wallet'))).toBeVisible();
        await element(by.text('TestWallet1')).tap();
        await new Promise(r => setTimeout(r, 2000));
      } catch {
        // Already on WalletHome
      }
```

With:

```js
      // Relaunch — app lands on WalletList
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();

      // Wait for WalletList to show the wallet
      await waitFor(element(by.text('Your wallets')))
        .toBeVisible()
        .withTimeout(15000);
```

Also update the export test assertion (around line 210) — no more scrolling `wallet-home-scroll`. The Export button is directly visible on the wallet card:

Replace:

```js
      // WalletHome should show the wallet name
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Swipe up to reveal the export button (below the fold)
      await element(by.id('wallet-home-scroll')).swipe('up', 'slow', 0.7);
      await new Promise(r => setTimeout(r, 1000));

      // For DKLS vault, button text should say "Export Vault Share"
      await waitFor(element(by.text('Export Vault Share')))
        .toBeVisible()
        .withTimeout(10000);

      // Tap to navigate to export screen
      await element(by.text('Export Vault Share')).tap();
```

With:

```js
      // WalletList should show the wallet
      await waitFor(element(by.text('TestWallet1')))
        .toBeVisible()
        .withTimeout(10000);

      // Tap the Export button on the wallet card
      await waitFor(element(by.id('wallet-card-0-export')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('wallet-card-0-export')).tap();
```

- [ ] **Step 2: Update WalletsFound references in fast-vault-partial-migration.test.js**

Replace `WalletsFound` test descriptions and assertions. The "Start Migration" CTA now goes to WalletList via `onMigrationComplete`, so the test that checks for `WalletsFound` should now check for `Your wallets`:

Replace any assertion like:

```js
    it('navigates to WalletsFound', async () => {
```

With:

```js
    it('navigates to Your wallets', async () => {
```

And replace any `by.text` checks for screen elements that were WalletsFound-specific. Check what specific assertions exist and update to match WalletList UI (`'Your wallets'` title, `wallet-card-N` testIDs).

- [ ] **Step 3: Update WalletsFound references in migration-onboarding.test.js**

Same pattern — replace references to WalletsFound screen with WalletList assertions.

Replace:

```js
    it('taps CTA to reach WalletsFound', async () => {
```

With:

```js
    it('taps CTA to reach wallet list', async () => {
```

- [ ] **Step 4: Run E2E type check**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test: update E2E tests for WalletList consolidation"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full type check**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Lint check**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx eslint src/screens/WalletList.tsx src/components/WalletCard.tsx src/navigation/MainNavigator.tsx src/navigation/MigrationNavigator.tsx src/navigation/index.tsx src/screens/migration/MigrationSuccess.tsx src/screens/migration/MigrationHome.tsx src/screens/auth/WalletSuccessScreen.tsx --max-warnings=0 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 3: Verify no dangling references to deleted files**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && grep -rn "from.*WalletPicker\|from.*WalletHome\|from.*WalletsFound\|from.*WalletMigrationCard" src/ --include='*.ts' --include='*.tsx'`
Expected: No results

- [ ] **Step 4: Run Metro bundler to verify**

Run: `cd /Users/apotheosis/git/vultisig/station-mobile && npx expo export --platform ios --dump-sourcemap 2>&1 | tail -10`
Expected: Bundles successfully (or at minimum, no module-not-found errors for deleted files)

- [ ] **Step 5: Commit any final fixes if needed**
