# Code Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address remaining code quality, deduplication, and dependency cleanup items identified during the simplify review of the `feat/expo-migration` branch.

**Architecture:** Seven independent tasks that can be executed in any order. Each produces a self-contained commit. Tasks cover shared component extraction, shared style extraction, dependency cleanup, navigation cleanup, and a broken onboarding swiper fix.

**Tech Stack:** React Native, Expo, TypeScript, @noble/curves, @react-navigation/stack

---

### Task 1: Extract shared `WalletSuccessScreen` component

WalletCreated and WalletRecovered are ~85% identical. Extract the shared success UI, `isAddMode` detection, and `handleDone` logic into a single reusable component.

**Files:**
- Create: `src/screens/auth/WalletSuccessScreen.tsx`
- Modify: `src/screens/auth/NewWallet/WalletCreated.tsx`
- Modify: `src/screens/auth/RecoverWallet/WalletRecovered.tsx`

- [ ] **Step 1: Create `WalletSuccessScreen` component**

```tsx
// src/screens/auth/WalletSuccessScreen.tsx
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useWalletCreated, useWalletNav } from 'navigation'
import { COLORS, MONO_FONT } from 'consts/theme'

interface Props {
  title: string
  wallet: LocalWallet
  navigation: any
}

const WalletSuccessScreen = ({ title, wallet, navigation }: Props) => {
  const onWalletCreated = useWalletCreated()
  const { refreshWallets } = useWalletNav()
  const parentState = navigation.getParent()?.getState()
  const isAddMode = parentState?.routes?.some((r: any) =>
    r.name === 'AddWalletMenu' || r.name === 'AddNewWallet' || r.name === 'AddRecoverWallet'
  )

  const handleDone = async () => {
    if (isAddMode) {
      await refreshWallets()
      navigation.getParent()?.navigate('WalletPicker')
    } else {
      onWalletCreated()
    }
  }

  return (
    <View style={[styles.container, styles.centered]}>
      <View style={styles.successCircle}>
        <Text style={styles.checkmark}>&#10003;</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.walletName}>{wallet.name}</Text>
      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>Address</Text>
        <Text style={styles.address} selectable>
          {wallet.address}
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: { color: '#fff', fontSize: 36, fontWeight: '700' },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  walletName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 24,
  },
  addressBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 40,
  },
  addressLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  address: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: MONO_FONT,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default WalletSuccessScreen
```

- [ ] **Step 2: Rewrite `WalletCreated` to use `WalletSuccessScreen`**

`WalletCreated` keeps its async wallet-creation logic (loading/error states) and delegates the success UI to the shared component.

```tsx
// src/screens/auth/NewWallet/WalletCreated.tsx
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { createWallet } from 'utils/wallet'
import { COLORS } from 'consts/theme'
import WalletSuccessScreen from '../WalletSuccessScreen'

const WalletCreated = ({ navigation, route }: any) => {
  const { mnemonic, name, password } = route.params
  const [wallet, setWallet] = useState<LocalWallet | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(true)

  useEffect(() => {
    const persist = async () => {
      try {
        const result = await createWallet({
          seed: mnemonic,
          name,
          password,
        })
        if (result.success) {
          setWallet(result.wallet)
        } else {
          setError('Failed to create wallet')
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to create wallet')
      } finally {
        setSaving(false)
      }
    }
    persist()
  }, [])

  if (saving) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.savingText}>Creating wallet...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <WalletSuccessScreen
      title="Wallet Created!"
      wallet={wallet!}
      navigation={navigation}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  savingText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
  errorIcon: {
    color: COLORS.error,
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorTitle: {
    color: COLORS.error,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default WalletCreated
```

- [ ] **Step 3: Rewrite `WalletRecovered` to use `WalletSuccessScreen`**

```tsx
// src/screens/auth/RecoverWallet/WalletRecovered.tsx
import React from 'react'
import WalletSuccessScreen from '../WalletSuccessScreen'

const WalletRecovered = ({ navigation, route }: any) => {
  const { wallet } = route.params
  return (
    <WalletSuccessScreen
      title="Wallet Recovered!"
      wallet={wallet}
      navigation={navigation}
    />
  )
}

export default WalletRecovered
```

- [ ] **Step 4: Verify the app builds**

Run: `npx tsc --noEmit 2>&1 | grep -E '(WalletCreated|WalletRecovered|WalletSuccessScreen)' || echo "No new errors"`
Expected: No new errors from these files.

- [ ] **Step 5: Commit**

```bash
git add src/screens/auth/WalletSuccessScreen.tsx src/screens/auth/NewWallet/WalletCreated.tsx src/screens/auth/RecoverWallet/WalletRecovered.tsx
git commit -m "refactor: extract shared WalletSuccessScreen from WalletCreated/WalletRecovered"
```

---

### Task 2: Extract shared auth screen styles

Seven auth screens duplicate the same container, title, subtitle, input, button, and error styles. Extract a shared stylesheet.

**Files:**
- Create: `src/screens/auth/authStyles.ts`
- Modify: `src/screens/auth/NewWallet/Step1.tsx`
- Modify: `src/screens/auth/NewWallet/Step2.tsx`
- Modify: `src/screens/auth/NewWallet/Step3.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step1.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step2Seed.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step4Seed.tsx`
- Modify: `src/screens/auth/AuthMenu.tsx`

- [ ] **Step 1: Create `authStyles.ts`**

```typescript
// src/screens/auth/authStyles.ts
import { StyleSheet } from 'react-native'
import { COLORS } from 'consts/theme'

const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto' as any,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerStyle: {
    backgroundColor: COLORS.bg,
    shadowColor: 'transparent',
  },
})

export const HEADER_TINT_COLOR = COLORS.textPrimary

export default authStyles
```

- [ ] **Step 2: Update each auth screen to import shared styles**

For each of the 7 screens listed above:
1. Add `import authStyles, { HEADER_TINT_COLOR } from '../authStyles'` (adjust relative path for depth)
2. Replace duplicated style keys with `authStyles.keyName` references
3. Keep only screen-specific styles in the local `StyleSheet.create`
4. Update `navigationOptions` to use `headerStyle: authStyles.headerStyle` and `headerTintColor: HEADER_TINT_COLOR`

The local stylesheet in each file should only contain styles unique to that screen (e.g., `warningBox` in Step3, `seedInput` in Step2Seed, `grid`/`wordCell` in Step3). Where a shared style needs a minor override (e.g., `inputGroup: { marginBottom: 20 }` vs the default 24), use `[authStyles.inputGroup, { marginBottom: 20 }]`.

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc --noEmit 2>&1 | grep -E 'auth/' || echo "No new errors in auth screens"`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/auth/
git commit -m "refactor: extract shared authStyles from duplicated auth screen stylesheets"
```

---

### Task 3: Replace `elliptic` with `@noble/curves` in `polyfills/terra.js`

`elliptic` (~130KB) is used only in `polyfills/terra.js` for secp256k1. `@noble/curves` is already a direct dependency used in `src/services/exportVaultShare.ts`. Consolidate onto one library.

**Files:**
- Modify: `polyfills/terra.js`
- Modify: `package.json` (remove `elliptic` from dependencies)

- [ ] **Step 1: Run existing crypto parity tests to establish baseline**

Run: `npx jest __tests__/polyfills/crypto.test.js --verbose`
Expected: All tests pass (these test the terra.js polyfill's key derivation and address generation).

- [ ] **Step 2: Replace `elliptic` with `@noble/curves` in `terra.js`**

Replace lines 17-18 of `polyfills/terra.js`:

```javascript
// REMOVE:
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// ADD:
const { secp256k1 } = require('@noble/curves/secp256k1');
```

Replace the `RawKey` constructor (around line 95):

```javascript
// REMOVE:
class RawKey extends Key {
  constructor(privateKey) {
    const privBuf = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
    const kp = ec.keyFromPrivate(privBuf);
    const compressedPub = Buffer.from(kp.getPublic(true, 'array'));
    const pubKeyBase64 = compressedPub.toString('base64');
    super(new SimplePublicKey(pubKeyBase64));
    this.privateKey = privBuf;
  }

// ADD:
class RawKey extends Key {
  constructor(privateKey) {
    const privBuf = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
    const compressedPub = Buffer.from(secp256k1.getPublicKey(privBuf, true));
    const pubKeyBase64 = compressedPub.toString('base64');
    super(new SimplePublicKey(pubKeyBase64));
    this.privateKey = privBuf;
  }
```

Replace the `ecdsaSign` method (around line 105):

```javascript
// REMOVE:
  ecdsaSign(payload) {
    const hash = Buffer.from(sha256(payload));
    const sig = ec.sign(hash, this.privateKey, { canonical: true });
    const r = sig.r.toArray('be', 32);
    const s = sig.s.toArray('be', 32);
    const signature = new Uint8Array(64);
    signature.set(r, 0);
    signature.set(s, 32);
    return { signature, recid: sig.recoveryParam };
  }

// ADD:
  ecdsaSign(payload) {
    const hash = Buffer.from(sha256(payload));
    const sig = secp256k1.sign(hash, this.privateKey);
    const compactBytes = sig.toCompactRawBytes();
    return { signature: compactBytes, recid: sig.recovery };
  }
```

- [ ] **Step 3: Run crypto parity tests to verify**

Run: `npx jest __tests__/polyfills/crypto.test.js --verbose`
Expected: All tests still pass — same addresses derived, same crypto behavior.

- [ ] **Step 4: Remove `elliptic` from package.json**

Remove the `"elliptic": "^6.6.1"` line from `dependencies` in `package.json`, then run `npm install` to update the lockfile.

- [ ] **Step 5: Verify `elliptic` is no longer directly required**

Run: `grep -r "require.*elliptic" --include='*.js' --include='*.ts' --include='*.tsx' . --exclude-dir=node_modules || echo "No direct elliptic imports"`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add polyfills/terra.js package.json package-lock.json
git commit -m "refactor: replace elliptic with @noble/curves in terra.js polyfill"
```

---

### Task 4: Remove dead dependencies (`crypto-browserify`, `react-native-crypto`)

Both packages are listed in `package.json` but have zero direct imports. The metro config now routes `crypto` to `polyfills/crypto.js`, making these dead weight.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Confirm no direct imports exist**

Run: `grep -r "crypto-browserify\|react-native-crypto" --include='*.js' --include='*.ts' --include='*.tsx' . --exclude-dir=node_modules || echo "No direct imports"`
Expected: No matches.

- [ ] **Step 2: Remove from package.json**

Remove these lines from `dependencies` in `package.json`:
- `"crypto-browserify": "^3.12.1"`
- `"react-native-crypto": "^2.2.1"`

- [ ] **Step 3: Reinstall to update lockfile**

Run: `npm install`
Expected: Clean install with no errors.

- [ ] **Step 4: Run crypto tests**

Run: `npx jest __tests__/polyfills/crypto.test.js --verbose`
Expected: All pass — these packages were not being used.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove dead crypto-browserify and react-native-crypto dependencies"
```

---

### Task 5: Fix broken OnBoarding swiper

The old `react-native-swiper` was removed during the Expo migration but the replacement is a stub that only shows the first slide. `currentIndex` is never updated. Replace with a simple `ScrollView`-based horizontal pager.

**Files:**
- Modify: `src/App/OnBoarding.tsx`

- [ ] **Step 1: Rewrite `RenderSwiper` with a horizontal `ScrollView`**

```tsx
// src/App/OnBoarding.tsx
import React, { ReactElement, useCallback, useRef, useState } from 'react'
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  TouchableOpacity,
  LogBox,
  StyleSheet,
} from 'react-native'

import { COLOR } from 'consts'

import { setSkipOnboarding } from '../utils/storage'

import { Text } from 'components'
import images from 'assets/images'

LogBox.ignoreLogs([
  'Warning: Cannot update a component from inside the function body of a different component.',
  'Setting a timer',
])

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const PagerContents = [
  {
    image: images.on_boarding_0,
    title: 'Welcome Aboard',
    description:
      'Terra Station is your gateway\nto the Terra ecosystem.',
  },
  {
    image: images.on_boarding_1,
    title: 'Manage Assets',
    description:
      'Transact, and stake assets\non the Terra blockchain.',
  },
  {
    image: images.on_boarding_2,
    title: 'Get Rewards',
    description:
      'Delegate LUNA and earn yield from\ntransactions on the Terra network.',
  },
  {
    image: images.on_boarding_4,
    title: 'Start Exploring',
    description: '',
  },
]

const RenderSwiper = (): ReactElement => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x
      const index = Math.round(offsetX / SCREEN_WIDTH)
      setCurrentIndex(index)
    },
    []
  )

  return (
    <View style={{ flex: 1, marginBottom: 60 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {PagerContents.map((item, i) => (
          <View key={i} style={[styles.SwiperContent, { width: SCREEN_WIDTH }]}>
            <View
              style={{
                height: '60%',
                paddingVertical: 20,
                alignContent: 'center',
                justifyContent: 'center',
              }}
            >
              <Image source={item.image} style={styles.SwiperContentImage} />
            </View>
            <View style={{ minHeight: 160, paddingTop: 20 }}>
              <Text style={styles.SwiperContentTitle} fontType="bold">
                {item.title}
              </Text>
              <Text
                style={styles.SwiperContentDesc}
                adjustsFontSizeToFit
                numberOfLines={2}
              >
                {item.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {PagerContents.map((_, i) => (
          <View key={i} style={i === currentIndex ? styles.SwiperDotActive : styles.SwiperDot} />
        ))}
      </View>
    </View>
  )
}

const RenderButton = ({
  closeOnBoarding,
}: {
  closeOnBoarding: () => void
}): ReactElement => {
  const enterTabs = (): void => {
    setSkipOnboarding(true)
    closeOnBoarding()
  }

  return (
    <View style={styles.SwiperButtonContainer}>
      <TouchableOpacity
        style={styles.SwiperButtonStart}
        onPress={enterTabs}
      >
        <Text
          style={{
            fontSize: 16,
            lineHeight: 24,
            color: 'rgb(255,255,255)',
          }}
          fontType={'medium'}
        >
          Get started
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const OnBoarding = ({
  closeOnBoarding,
}: {
  closeOnBoarding: () => void
}): ReactElement => {
  return (
    <View style={{ flex: 1 }}>
      <RenderSwiper />
      <RenderButton closeOnBoarding={closeOnBoarding} />
    </View>
  )
}

// (keep existing styles unchanged)
```

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit 2>&1 | grep OnBoarding || echo "No errors"`
Expected: No new errors.

- [ ] **Step 3: Manual test**

Launch the app with onboarding not yet skipped (clear AsyncStorage `skipOnboarding` key). Verify:
- All 4 slides are visible by swiping left
- Dot indicators update as you swipe
- "Get started" button works from any slide

- [ ] **Step 4: Commit**

```bash
git add src/App/OnBoarding.tsx
git commit -m "fix: restore onboarding swiper functionality with ScrollView pager"
```

---

### Task 6: Simplify `refreshWallets` / `onWalletCreated` / `onWalletDisconnected`

`refreshWallets` is a strict subset of `onWalletCreated` — both call `loadWallets()`. The add-wallet flow calls `refreshWallets()` then manually navigates to WalletPicker. This can be simplified: the success screens don't need `refreshWallets` at all if they navigate directly.

**Files:**
- Modify: `src/navigation/index.tsx`

- [ ] **Step 1: Remove `refreshWallets` from the context**

In `src/navigation/index.tsx`:

1. Remove `refreshWallets` from the `WalletNav` interface
2. Remove `refreshWallets` from the `WalletNavContext` default value
3. Remove the `refreshWallets` callback definition (lines 56-58)
4. Remove `refreshWallets` from the `WalletNavContext.Provider` value prop

```typescript
// Updated interface
interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  wallets: LocalWallet[]
}

// Updated default
const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: () => {},
  onWalletDisconnected: () => {},
  wallets: [],
})

// Updated provider value
<WalletNavContext.Provider value={{ onWalletCreated, onWalletDisconnected, wallets }}>
```

- [ ] **Step 2: Update `WalletSuccessScreen` (or WalletCreated/WalletRecovered if Task 1 not done)**

In the `handleDone` for add-mode, replace `await refreshWallets()` with `await onWalletCreated()` — this reloads wallets AND auto-selects the newest. But since add-mode wants to go to WalletPicker instead of auto-selecting, we need a different approach.

The simplest fix: in add-mode, just call `loadWallets` indirectly by navigating — the WalletPicker screen reads `wallets` from context, and the navigation index's `onWalletCreated` already reloads them. So:

```typescript
const handleDone = async () => {
  if (isAddMode) {
    // onWalletCreated reloads wallets, then navigate to picker
    await onWalletCreated()
    navigation.getParent()?.navigate('WalletPicker')
  } else {
    onWalletCreated()
  }
}
```

This eliminates the need for `refreshWallets` entirely. The `onWalletCreated` call reloads wallets and sets `initialWallet`, but the immediate navigation to WalletPicker overrides that.

- [ ] **Step 3: Remove all `refreshWallets` imports**

Search for and remove all uses:
Run: `grep -rn "refreshWallets" --include='*.ts' --include='*.tsx' src/`

Update each file that destructures `refreshWallets` from `useWalletNav()` to remove it.

- [ ] **Step 4: Verify the app builds**

Run: `npx tsc --noEmit 2>&1 | grep -E '(refreshWallets|navigation/index)' || echo "No errors"`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/index.tsx src/screens/auth/
git commit -m "refactor: remove redundant refreshWallets, use onWalletCreated for all wallet-reload paths"
```

---

### Task 7: Replace hardcoded colors in `navigationOptions` across auth screens

Six auth screens have `navigationOptions` with hardcoded `backgroundColor: '#02122B'` and `headerTintColor: '#F0F4FC'`. These should use `COLORS` constants (or the shared `authStyles.headerStyle` from Task 2).

**Files:**
- Modify: `src/screens/auth/NewWallet/Step1.tsx`
- Modify: `src/screens/auth/NewWallet/Step2.tsx`
- Modify: `src/screens/auth/NewWallet/Step3.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step1.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step2Seed.tsx`
- Modify: `src/screens/auth/RecoverWallet/Step4Seed.tsx`

- [ ] **Step 1: Update each screen's `navigationOptions`**

For each file, replace:

```typescript
StepN.navigationOptions = {
  title: '...',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}
```

With (if Task 2 is done):

```typescript
import authStyles, { HEADER_TINT_COLOR } from '../authStyles'
// ...
StepN.navigationOptions = {
  title: '...',
  headerStyle: authStyles.headerStyle,
  headerTintColor: HEADER_TINT_COLOR,
}
```

Or if Task 2 is not done, import `COLORS` directly:

```typescript
import { COLORS } from 'consts/theme'
// ...
StepN.navigationOptions = {
  title: '...',
  headerStyle: { backgroundColor: COLORS.bg, shadowColor: 'transparent' },
  headerTintColor: COLORS.textPrimary,
}
```

Note: `Step3Seed.tsx` was already fixed in the previous commit. Skip that file.

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit 2>&1 | grep -E 'auth/' || echo "No new errors"`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/
git commit -m "refactor: replace hardcoded header colors with COLORS constants in auth screens"
```
