# Export Private Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reveal and copy their decrypted private key hex so they can import it into another wallet.

**Architecture:** New `ExportPrivateKey` screen behind password verification. Button added to WalletHome management section (hidden for Ledger wallets). Uses existing `getDecyrptedKey` and `getAuthDataValue` utilities.

**Tech Stack:** React Native, expo-clipboard, @react-navigation/stack, react-query

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/screens/ExportPrivateKey.tsx` | Create | Password entry, key decryption, reveal, copy |
| `src/navigation/MainNavigator.tsx` | Modify | Add route type + screen registration |
| `src/screens/WalletHome.tsx` | Modify | Add "Export Private Key" button, hide for Ledger |

---

### Task 1: Register ExportPrivateKey route in navigation

**Files:**
- Modify: `src/navigation/MainNavigator.tsx`

- [ ] **Step 1: Add ExportPrivateKey to MainStackParams type**

In `src/navigation/MainNavigator.tsx`, add the route type and import + register the screen:

```typescript
// Add to MainStackParams type (after AddRecoverWallet):
ExportPrivateKey: { wallet: { name: string; address: string } }
```

```typescript
// Add import at top with other screen imports:
import ExportPrivateKey from '../screens/ExportPrivateKey'
```

```typescript
// Add screen registration inside <Stack.Navigator>, after the AddRecoverWallet screen:
<Stack.Screen name="ExportPrivateKey" component={ExportPrivateKey} />
```

This will show a type error until we create the screen file in Task 2 — that's expected.

- [ ] **Step 2: Commit**

```bash
git add src/navigation/MainNavigator.tsx
git commit -m "feat: register ExportPrivateKey route in MainNavigator"
```

---

### Task 2: Create ExportPrivateKey screen

**Files:**
- Create: `src/screens/ExportPrivateKey.tsx`

- [ ] **Step 1: Create the ExportPrivateKey screen**

Create `src/screens/ExportPrivateKey.tsx` with the full implementation:

```tsx
import React, { useState, useCallback } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'

import { getDecyrptedKey } from 'utils/wallet'
import Text from 'components/Text'
import Button from 'components/Button'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function ExportPrivateKey() {
  const { params } = useRoute<RouteProp<MainStackParams, 'ExportPrivateKey'>>()
  const navigation = useNavigation()
  const { wallet } = params

  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleReveal = useCallback(async () => {
    setError('')
    try {
      const key = await getDecyrptedKey(wallet.name, password)
      setPrivateKey(key)
    } catch {
      setError('Incorrect password')
    }
  }, [wallet.name, password])

  const handleCopy = useCallback(async () => {
    if (!privateKey) return
    await Clipboard.setStringAsync(privateKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [privateKey])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Export Private Key</Text>
      <Text style={styles.address}>{wallet.name}</Text>

      <View style={styles.warningCard}>
        <Text style={styles.warningText}>
          Anyone with this key can access your funds. Never share it.
        </Text>
      </View>

      {privateKey === null ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter wallet password"
            placeholderTextColor="#8295AE"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          {error !== '' && <Text style={styles.errorText}>{error}</Text>}
          <Button
            title="Reveal Private Key"
            onPress={handleReveal}
            disabled={password.length === 0}
            theme="sapphire"
            containerStyle={styles.button}
          />
        </>
      ) : (
        <>
          <View style={styles.keyCard}>
            <Text style={styles.keyText} selectable>
              {privateKey}
            </Text>
          </View>
          <Button
            title={copied ? 'Copied!' : 'Copy to Clipboard'}
            onPress={handleCopy}
            theme="sapphire"
            containerStyle={styles.button}
          />
        </>
      )}

      <Button
        title="Done"
        onPress={() => navigation.goBack()}
        theme="transparent"
        containerStyle={styles.button}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginTop: 24 },
  address: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  warningCard: {
    backgroundColor: '#3D1A1A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  warningText: { color: '#FF5C5C', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    color: '#F0F4FC',
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: { color: '#FF5C5C', fontSize: 13, marginBottom: 12 },
  keyCard: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  keyText: {
    color: '#F0F4FC',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  button: { width: '100%', marginBottom: 12 },
})
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx expo start` (or the project's dev command) and confirm no compile errors. Navigate to any screen to verify the app loads.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ExportPrivateKey.tsx
git commit -m "feat: add ExportPrivateKey screen with password verification and copy"
```

---

### Task 3: Add Export button to WalletHome

**Files:**
- Modify: `src/screens/WalletHome.tsx`

- [ ] **Step 1: Add ledger check and export button to WalletHome**

In `src/screens/WalletHome.tsx`, make these changes:

1. Add imports at the top:

```typescript
import { useState, useEffect } from 'react'
import { getAuthDataValue } from 'utils/authData'
```

Update the existing `React` import — change `import React, { useCallback } from 'react'` to:

```typescript
import React, { useCallback, useState, useEffect } from 'react'
```

And add:

```typescript
import { getAuthDataValue } from 'utils/authData'
```

2. Inside the `WalletHome` component, after the `const wallet = route.params?.wallet` block and before the `React.useEffect` for settings, add the ledger check:

```typescript
  const [isLedger, setIsLedger] = useState(true) // default true to hide button until checked

  useEffect(() => {
    getAuthDataValue(wallet.name).then((data) => {
      setIsLedger(data?.ledger === true)
    })
  }, [wallet.name])
```

3. In the JSX management section, add the export button between "Add Wallet" and "Remove Wallet" (after the `<TouchableOpacity>` for "Add Wallet" and before the `<TouchableOpacity>` for `handleRemove`):

```tsx
        {!isLedger && (
          <TouchableOpacity
            style={styles.managementRow}
            onPress={() => navigation.navigate('ExportPrivateKey', { wallet })}
          >
            <Text style={styles.managementText}>Export Private Key</Text>
          </TouchableOpacity>
        )}
```

- [ ] **Step 2: Manually test the full flow**

1. Open the app, navigate to a non-Ledger wallet's WalletHome
2. Confirm "Export Private Key" button appears between "Add Wallet" and "Remove Wallet"
3. Tap it — confirm navigation to ExportPrivateKey screen
4. Enter wrong password — confirm "Incorrect password" error
5. Enter correct password — confirm private key hex is revealed (64 hex characters)
6. Tap "Copy to Clipboard" — confirm button text changes to "Copied!" for 2 seconds
7. Paste somewhere — confirm the copied string matches the displayed key
8. Tap "Done" — confirm navigation back to WalletHome
9. If a Ledger wallet exists: navigate to its WalletHome and confirm the export button is NOT shown

- [ ] **Step 3: Commit**

```bash
git add src/screens/WalletHome.tsx
git commit -m "feat: add Export Private Key button to WalletHome for non-Ledger wallets"
```
