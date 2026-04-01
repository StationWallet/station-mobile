# Multi-Wallet Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can view all stored wallets, switch between them, create additional wallets, and remove individual wallets.

**Architecture:** Lift wallet list into `AppNavigator` context so all screens share it. Add a `WalletPicker` screen for multi-wallet selection. Modify `WalletHome` to receive the selected wallet via route params. Reuse the existing AuthNavigator (create/recover) as an embedded stack in MainNavigator for "Add Wallet."

**Tech Stack:** React Navigation 6, Recoil (existing), react-query v3, expo-secure-store (existing wallet storage).

**Spec:** `docs/superpowers/specs/2026-04-02-multi-wallet-support-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/navigation/index.tsx` | Modify | Load wallet list, expose via context with `wallets` + `refreshWallets`. Auto-select logic: 1 wallet → skip picker, 2+ → check `settings.walletName`. |
| `src/navigation/MainNavigator.tsx` | Modify | Add `WalletPicker`, `AddWallet` routes. Accept `initialWallet` param to decide initial route. |
| `src/screens/WalletPicker.tsx` | Create | List all wallets, tap to select, "Add Wallet" button at bottom. |
| `src/screens/WalletHome.tsx` | Modify | Accept wallet via route params (not self-loading). Add Switch/Add/Remove options. Save selection to settings. |
| `src/screens/auth/NewWallet/WalletCreated.tsx` | Modify | Detect "add wallet" mode vs "first wallet" mode. In add mode, call `refreshWallets()` and navigate back instead of `onWalletCreated()`. |
| `src/screens/auth/RecoverWallet/WalletRecovered.tsx` | Modify | Same dual-mode handling as WalletCreated. |

---

## Task 1: Extend WalletNavContext with wallet list

**Files:**
- Modify: `src/navigation/index.tsx`

- [ ] **Step 1: Update the WalletNav interface and context**

Replace the entire content of `src/navigation/index.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import { getWallets } from 'utils/wallet'
import { settings } from 'utils/storage'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'

interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  wallets: LocalWallet[]
  refreshWallets: () => Promise<void>
}
const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: () => {},
  onWalletDisconnected: () => {},
  wallets: [],
  refreshWallets: async () => {},
})
export const useWalletCreated = () => useContext(WalletNavContext).onWalletCreated
export const useWalletDisconnected = () => useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = () => useContext(WalletNavContext)

export default function AppNavigator() {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [initialWallet, setInitialWallet] = useState<LocalWallet | undefined>(undefined)
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
      if (loaded.length === 1) {
        setInitialWallet(loaded[0])
      } else if (loaded.length > 1) {
        const saved = await settings.get()
        const lastUsed = loaded.find((w) => w.name === saved.walletName)
        if (lastUsed) {
          setInitialWallet(lastUsed)
        }
        // else: no initialWallet → MainNavigator will show WalletPicker
      }
    }
    init().catch(() => setWallets([]))
  }, [loadWallets])

  const refreshWallets = useCallback(async () => {
    await loadWallets()
  }, [loadWallets])

  const onWalletCreated = useCallback(async () => {
    const loaded = await loadWallets()
    // Auto-select the newest wallet (last in the list)
    if (loaded.length > 0) {
      setInitialWallet(loaded[loaded.length - 1])
    }
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setInitialWallet(undefined)
    } else if (loaded.length === 1) {
      setInitialWallet(loaded[0])
    } else {
      setInitialWallet(undefined) // will show picker
    }
  }, [loadWallets])

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes?.[currentTheme]?.backgroundColor || '#02122B',
    },
  }

  if (wallets === null) return null // Still loading

  const hasWallet = wallets.length > 0

  return (
    <WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected, wallets, refreshWallets }}>
      <NavigationContainer theme={navTheme}>
        {hasWallet ? (
          <MainNavigator initialWallet={initialWallet} />
        ) : (
          <AuthNavigator />
        )}
      </NavigationContainer>
    </WalletNavContext.Provider>
  )
}
```

- [ ] **Step 2: Verify app still compiles**

```bash
npx expo start --clear 2>&1 | head -5
```

Expected: Metro bundler starts (MainNavigator will error on missing `initialWallet` prop — that's fixed in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/navigation/index.tsx
git commit -m "refactor: extend WalletNavContext with wallet list, auto-select, and refreshWallets"
```

---

## Task 2: Update MainNavigator with WalletPicker and AddWallet routes

**Files:**
- Modify: `src/navigation/MainNavigator.tsx`

- [ ] **Step 1: Rewrite MainNavigator to accept initialWallet and add new routes**

Replace the entire content of `src/navigation/MainNavigator.tsx`:

```tsx
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import WalletPicker from '../screens/WalletPicker'
import WalletHome from '../screens/WalletHome'
import Receive from '../screens/Receive'
import History from '../screens/History'
import AuthMenu from '../screens/auth/AuthMenu'
import NewWalletStack from './NewWalletStack'
import RecoverWalletStack from './RecoverWalletStack'

export type MainStackParams = {
  WalletPicker: undefined
  WalletHome: { wallet: { name: string; address: string } }
  Receive: { address: string }
  History: { address: string }
  AddWalletMenu: undefined
  AddNewWallet: undefined
  AddRecoverWallet: undefined
}

const Stack = createStackNavigator<MainStackParams>()

interface Props {
  initialWallet?: LocalWallet
}

export default function MainNavigator({ initialWallet }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {initialWallet ? (
        // Auto-selected wallet: start on WalletHome
        <>
          <Stack.Screen
            name="WalletHome"
            component={WalletHome}
            initialParams={{ wallet: { name: initialWallet.name, address: initialWallet.address } }}
          />
          <Stack.Screen name="WalletPicker" component={WalletPicker} />
        </>
      ) : (
        // No wallet selected: start on WalletPicker
        <>
          <Stack.Screen name="WalletPicker" component={WalletPicker} />
          <Stack.Screen name="WalletHome" component={WalletHome} />
        </>
      )}
      <Stack.Screen name="Receive" component={Receive} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="AddWalletMenu" component={AuthMenu} />
      <Stack.Screen name="AddNewWallet" component={NewWalletStack} />
      <Stack.Screen name="AddRecoverWallet" component={RecoverWalletStack} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/MainNavigator.tsx
git commit -m "feat: add WalletPicker and AddWallet routes to MainNavigator"
```

---

## Task 3: Create WalletPicker screen

**Files:**
- Create: `src/screens/WalletPicker.tsx`

- [ ] **Step 1: Create the WalletPicker screen**

Create `src/screens/WalletPicker.tsx`:

```tsx
import React from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { NavigationProp, useNavigation } from '@react-navigation/native'

import { useWalletNav } from 'navigation'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletPicker() {
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const { wallets } = useWalletNav()

  const selectWallet = async (wallet: LocalWallet) => {
    await settings.set({ walletName: wallet.name })
    navigation.navigate('WalletHome', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const renderItem = ({ item }: { item: LocalWallet }) => (
    <TouchableOpacity style={styles.walletRow} onPress={() => selectWallet(item)}>
      <View style={styles.walletInfo}>
        <Text style={styles.walletName}>{item.name}</Text>
        <Text style={styles.walletAddress}>
          {UTIL.truncate(item.address, [10, 6])}
        </Text>
      </View>
      {item.ledger && (
        <View style={styles.ledgerBadge}>
          <Text style={styles.ledgerText}>Ledger</Text>
        </View>
      )}
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Wallet</Text>
      <Text style={styles.subtitle}>
        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} on this device
      </Text>

      <FlatList
        data={wallets}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <Button
          title="Add Wallet"
          onPress={() => navigation.navigate('AddWalletMenu')}
          containerStyle={styles.addButton}
          theme="sapphire"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', padding: 20 },
  title: { color: '#F0F4FC', fontSize: 24, fontWeight: '700', marginTop: 48 },
  subtitle: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  walletRow: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletInfo: { flex: 1 },
  walletName: { color: '#F0F4FC', fontSize: 16, fontWeight: '600' },
  walletAddress: { color: '#8295AE', fontSize: 13, marginTop: 4 },
  ledgerBadge: {
    backgroundColor: '#11284A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  ledgerText: { color: '#8295AE', fontSize: 11, fontWeight: '600' },
  footer: { paddingTop: 16 },
  addButton: { width: '100%' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/WalletPicker.tsx
git commit -m "feat: add WalletPicker screen for multi-wallet selection"
```

---

## Task 4: Update WalletHome for wallet switching

**Files:**
- Modify: `src/screens/WalletHome.tsx`

- [ ] **Step 1: Rewrite WalletHome to accept wallet from route params**

Replace the entire content of `src/screens/WalletHome.tsx`:

```tsx
import React, { useCallback } from 'react'
import {
  Alert,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useQuery } from 'react-query'
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native'

import useLCD from 'hooks/useLCD'
import { deleteWallet } from 'utils/wallet'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'
import Loading from 'components/Loading'
import { useWalletNav } from 'navigation'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletHome() {
  const lcd = useLCD()
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const route = useRoute<RouteProp<MainStackParams, 'WalletHome'>>()
  const { wallets, onWalletDisconnected, refreshWallets } = useWalletNav()

  const wallet = route.params?.wallet
  if (!wallet) return <Loading />

  // Save last-used wallet
  React.useEffect(() => {
    settings.set({ walletName: wallet.name })
  }, [wallet.name])

  const {
    data: balance,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery(
    ['balance', wallet.address],
    async () => {
      const [coins] = await lcd.bank.balance(wallet.address)
      const luna = coins.get('uluna')
      return luna ? UTIL.demicrofy(luna.amount as any) : '0'
    },
  )

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(wallet.address)
  }, [wallet.address])

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove Wallet',
      'This will remove the wallet from this device. Make sure you have your seed phrase backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteWallet({ walletName: wallet.name })
            await onWalletDisconnected()
          },
        },
      ]
    )
  }, [wallet.name, onWalletDisconnected])

  const truncated = UTIL.truncate(wallet.address, [10, 6])
  const hasMultipleWallets = wallets.length > 1

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
      }
    >
      <Text style={styles.walletName}>{wallet.name}</Text>
      <TouchableOpacity onPress={copyAddress}>
        <Text style={styles.address}>{truncated}</Text>
      </TouchableOpacity>

      <View style={styles.balanceCard}>
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <Text style={styles.balanceLabel}>LUNA</Text>
            <Text style={styles.balanceAmount}>{balance || '0'}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title="Receive"
          onPress={() => navigation.navigate('Receive', { address: wallet.address })}
          containerStyle={styles.actionButton}
          theme="sapphire"
        />
        <Button
          title="History"
          onPress={() => navigation.navigate('History', { address: wallet.address })}
          containerStyle={styles.actionButton}
          theme="transparent"
        />
      </View>

      <View style={styles.management}>
        {hasMultipleWallets && (
          <TouchableOpacity
            style={styles.managementRow}
            onPress={() => navigation.navigate('WalletPicker')}
          >
            <Text style={styles.managementText}>Switch Wallet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.managementRow}
          onPress={() => navigation.navigate('AddWalletMenu')}
        >
          <Text style={styles.managementText}>Add Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.managementRow} onPress={handleRemove}>
          <Text style={styles.removeText}>Remove Wallet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  walletName: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginTop: 24 },
  address: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  balanceCard: {
    backgroundColor: '#061B3A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: { color: '#8295AE', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#F0F4FC', fontSize: 32, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 32 },
  actionButton: { flex: 1 },
  management: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#11284A',
    paddingTop: 16,
  },
  managementRow: { paddingVertical: 14 },
  managementText: { color: '#8295AE', fontSize: 15 },
  removeText: { color: '#FF5C5C', fontSize: 15 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/WalletHome.tsx
git commit -m "feat: WalletHome accepts wallet via route params, adds switch/add/remove"
```

---

## Task 5: Update AuthMenu for "Add Wallet" mode

**Files:**
- Modify: `src/screens/auth/AuthMenu.tsx`

- [ ] **Step 1: Read the current AuthMenu**

Read `src/screens/auth/AuthMenu.tsx` to understand its current structure. It currently navigates to `'NewWallet'` and `'RecoverWallet'` routes.

When AuthMenu is shown inside MainNavigator as `AddWalletMenu`, those routes don't exist — instead they're `AddNewWallet` and `AddRecoverWallet`. We need to detect which context we're in and navigate accordingly.

- [ ] **Step 2: Add mode detection**

The simplest approach: check `navigation.getState()` for the route name. If the current route name is `AddWalletMenu`, we're in MainNavigator. Otherwise, we're in AuthNavigator.

At the top of the component function, add:

```tsx
const navState = navigation.getState()
const isAddMode = navState?.routes?.some((r: any) => r.name === 'AddWalletMenu')

// Then in the button handlers:
const handleCreateWallet = () => {
  navigation.navigate(isAddMode ? 'AddNewWallet' : 'NewWallet')
}
const handleRecoverWallet = () => {
  navigation.navigate(isAddMode ? 'AddRecoverWallet' : 'RecoverWallet')
}
```

Replace the existing `onPress` handlers for "Create New Wallet" and "Recover Wallet" buttons to use these functions.

Also add a back button when in add mode (the user should be able to cancel):

```tsx
{isAddMode && (
  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
    <Text style={styles.backText}>Cancel</Text>
  </TouchableOpacity>
)}
```

Add the styles:
```tsx
backButton: { position: 'absolute', top: 60, left: 20, padding: 8 },
backText: { color: '#8295AE', fontSize: 16 },
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/AuthMenu.tsx
git commit -m "feat: AuthMenu supports add-wallet mode with correct route names"
```

---

## Task 6: Update WalletCreated and WalletRecovered for dual mode

**Files:**
- Modify: `src/screens/auth/NewWallet/WalletCreated.tsx`
- Modify: `src/screens/auth/RecoverWallet/WalletRecovered.tsx`

Both success screens currently call `onWalletCreated()` which switches the entire navigator from Auth to Main. When in "Add Wallet" mode (already inside MainNavigator), they should instead call `refreshWallets()` and navigate back to WalletPicker.

- [ ] **Step 1: Update WalletCreated.tsx**

Read the full file first. Then make these changes:

Replace the import:
```tsx
import { useWalletCreated } from 'navigation'
```
with:
```tsx
import { useWalletCreated, useWalletNav } from 'navigation'
```

In the component body, add:
```tsx
const { refreshWallets } = useWalletNav()
```

Check if we're in add-wallet mode by examining the navigation state:
```tsx
const navState = navigation.getState()
const parentState = navigation.getParent()?.getState()
const isAddMode = parentState?.routes?.some((r: any) => r.name === 'AddWalletMenu')
```

Replace the `handleDone` function:
```tsx
const handleDone = async () => {
  if (isAddMode) {
    // Adding to existing wallets — refresh list and go back to picker
    await refreshWallets()
    navigation.getParent()?.navigate('WalletPicker')
  } else {
    // First wallet — switch from AuthNavigator to MainNavigator
    onWalletCreated()
  }
}
```

- [ ] **Step 2: Update WalletRecovered.tsx**

Apply the same pattern. Read the full file first. Then:

Replace the import:
```tsx
import { useWalletCreated } from 'navigation'
```
with:
```tsx
import { useWalletCreated, useWalletNav } from 'navigation'
```

Add to component body:
```tsx
const { refreshWallets } = useWalletNav()
const navState = navigation.getState()
const parentState = navigation.getParent()?.getState()
const isAddMode = parentState?.routes?.some((r: any) => r.name === 'AddWalletMenu')
```

Replace the `handleDone` function:
```tsx
const handleDone = async () => {
  if (isAddMode) {
    await refreshWallets()
    navigation.getParent()?.navigate('WalletPicker')
  } else {
    onWalletCreated()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/NewWallet/WalletCreated.tsx src/screens/auth/RecoverWallet/WalletRecovered.tsx
git commit -m "feat: wallet success screens support add-wallet mode (refresh + navigate to picker)"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Run polyfill tests**

```bash
npx jest __tests__/polyfills/
```

Expected: 42 tests pass (no regressions).

- [ ] **Step 2: Manual testing checklist**

Launch app on simulator and verify:

1. **Fresh install (0 wallets):** Shows AuthMenu → create wallet → lands on WalletHome
2. **1 wallet on launch:** Auto-selects, shows WalletHome directly (no picker)
3. **Add second wallet:** WalletHome → "Add Wallet" → AuthMenu → create → WalletPicker shows 2 wallets
4. **Switch wallet:** WalletHome → "Switch Wallet" → WalletPicker → tap other wallet → WalletHome updates
5. **Remove wallet (with others remaining):** WalletHome → "Remove Wallet" → confirm → WalletPicker (or auto-select if 1 left)
6. **Remove last wallet:** WalletHome → "Remove Wallet" → confirm → AuthMenu (create/recover)
7. **Remembers last wallet:** Select wallet B → kill app → relaunch → lands on WalletHome with wallet B
8. **Recover wallet:** WalletPicker → "Add Wallet" → Recover Wallet → enter seed → WalletPicker shows new wallet

- [ ] **Step 3: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: multi-wallet testing fixes"
```
