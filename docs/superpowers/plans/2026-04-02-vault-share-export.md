# Vault Share Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a station-mobile wallet as an encrypted `.vult` vault share file importable by any Vultisig app.

**Architecture:** Derive secp256k1 public key from private key, construct a KeyImport Vault protobuf, encrypt with AES-256-GCM, wrap in VaultContainer, write to file, share via system sheet. Follows vultiagent-app's exact patterns and protobuf schemas.

**Tech Stack:** @bufbuild/protobuf, @noble/ciphers, @noble/curves, @scure/base, expo-crypto, expo-file-system, expo-sharing

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/proto/vultisig/vault/v1/vault_pb.ts` | Create (copy) | Vault protobuf schema |
| `src/proto/vultisig/vault/v1/vault_container_pb.ts` | Create (copy) | VaultContainer protobuf schema |
| `src/proto/vultisig/keygen/v1/lib_type_message_pb.ts` | Create (copy) | LibType enum |
| `src/services/exportVaultShare.ts` | Create | Vault construction + encryption + file export |
| `src/screens/ExportPrivateKey.tsx` | Modify | Add "Export as Vault Share" button + export password flow |
| `metro.config.js` | Modify | Add `unstable_enablePackageExports` for @noble/* |
| `package.json` | Modify | Add new dependencies |

---

### Task 1: Install dependencies and configure Metro

**Files:**
- Modify: `package.json`
- Modify: `metro.config.js`

- [ ] **Step 1: Install new npm packages**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile
npx expo install expo-file-system expo-sharing
npm install @bufbuild/protobuf@^2.11.0 @noble/ciphers@^2.1.1 @noble/curves@^2.0.1 @scure/base@^2.0.0
```

Note: `@noble/hashes` and `expo-crypto` are already installed. `@scure/base` provides canonical hex/base64 encoding matching vultiagent-app.

- [ ] **Step 2: Enable package exports in Metro config**

The `@noble/*` libraries use the `exports` field in package.json for ES module resolution. Metro needs `unstable_enablePackageExports` to resolve them. In `metro.config.js`, add this line after `const config = getDefaultConfig(__dirname)` (line 4) and before the `config.resolver.extraNodeModules` block:

```javascript
// Enable package.json "exports" field resolution for @noble/* and @scure/* libraries
config.resolver.unstable_enablePackageExports = true
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json metro.config.js
git commit -m "feat: add protobuf, noble crypto, and file sharing dependencies for vault export"
```

---

### Task 2: Copy protobuf schemas from vultiagent-app

**Files:**
- Create: `src/proto/vultisig/vault/v1/vault_pb.ts`
- Create: `src/proto/vultisig/vault/v1/vault_container_pb.ts`
- Create: `src/proto/vultisig/keygen/v1/lib_type_message_pb.ts`

- [ ] **Step 1: Create proto directory structure and copy files**

```bash
mkdir -p src/proto/vultisig/vault/v1 src/proto/vultisig/keygen/v1
cp /Users/apotheosis/git/vultisig/vultiagent-app/src/proto/vultisig/vault/v1/vault_pb.ts src/proto/vultisig/vault/v1/vault_pb.ts
cp /Users/apotheosis/git/vultisig/vultiagent-app/src/proto/vultisig/vault/v1/vault_container_pb.ts src/proto/vultisig/vault/v1/vault_container_pb.ts
cp /Users/apotheosis/git/vultisig/vultiagent-app/src/proto/vultisig/keygen/v1/lib_type_message_pb.ts src/proto/vultisig/keygen/v1/lib_type_message_pb.ts
```

These are generated protobuf files from CommonData. They use `@bufbuild/protobuf` which we installed in Task 1. The import paths within the files use relative paths (`../../keygen/v1/...`) so they work without modification.

- [ ] **Step 2: Verify the files import correctly**

Check that TypeScript can resolve the imports. The key thing is that `vault_pb.ts` imports from `../../keygen/v1/lib_type_message_pb` — since we preserved the directory structure, this should resolve.

- [ ] **Step 3: Commit**

```bash
git add src/proto/
git commit -m "feat: add Vultisig vault protobuf schemas from CommonData"
```

---

### Task 3: Create the exportVaultShare service

**Files:**
- Create: `src/services/exportVaultShare.ts`

- [ ] **Step 1: Create the vault share export service**

Create `src/services/exportVaultShare.ts`:

```typescript
import { create, toBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex, base64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'

function bytesToBase64(bytes: Uint8Array): string {
  return base64.encode(bytes)
}

/**
 * Encrypts binary data with AES-256-GCM using a password.
 * Key = SHA256(password), nonce = random 12 bytes.
 * Output: nonce (12) + ciphertext + authTag (16).
 * Matches vultiagent-app / vultisig-ios encryption format.
 */
function encryptWithPassword(data: Uint8Array, password: string): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  const nonce = ExpoCrypto.getRandomBytes(12)
  const ciphertext = gcm(key, nonce).encrypt(data)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return result
}

/**
 * Derives the compressed secp256k1 public key from a private key hex string.
 * Returns 33-byte compressed public key as hex (66 characters).
 */
function derivePublicKeyHex(privateKeyHex: string): string {
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyHex, true)
  return hex.encode(publicKeyBytes)
}

/**
 * Exports a wallet as an encrypted .vult vault share file.
 *
 * Constructs a KeyImport vault protobuf from a raw secp256k1 private key,
 * encrypts with AES-256-GCM, wraps in VaultContainer, and writes to a
 * shareable .vult file.
 *
 * The produced file is importable by any Vultisig app via "Import Vault Share".
 */
export async function exportVaultShare(
  privateKeyHex: string,
  walletName: string,
  exportPassword: string,
): Promise<string> {
  const publicKeyHex = derivePublicKeyHex(privateKeyHex)

  // 1. Build Vault protobuf
  const vaultProto = create(VaultSchema, {
    name: walletName,
    publicKeyEcdsa: publicKeyHex,
    publicKeyEddsa: '',
    signers: ['station-mobile'],
    localPartyId: 'station-mobile',
    hexChainCode: '',
    resharePrefix: '',
    libType: LibType.KEYIMPORT,
    keyShares: [
      { publicKey: publicKeyHex, keyshare: privateKeyHex },
    ],
    chainPublicKeys: [
      { chain: 'Terra', publicKey: publicKeyHex, isEddsa: false },
    ],
    createdAt: {
      seconds: BigInt(Math.floor(Date.now() / 1000)),
      nanos: 0,
    },
    publicKeyMldsa44: '',
  })

  // 2. Serialize to binary
  const vaultBytes = toBinary(VaultSchema, vaultProto)

  // 3. Encrypt with export password
  const encryptedBytes = encryptWithPassword(vaultBytes, exportPassword)

  // 4. Wrap in VaultContainer
  const container = create(VaultContainerSchema, {
    version: 1n,
    isEncrypted: true,
    vault: bytesToBase64(encryptedBytes),
  })

  // 5. Serialize container → base64
  const containerBytes = toBinary(VaultContainerSchema, container)
  const containerBase64 = bytesToBase64(containerBytes)

  // 6. Write to cache file
  const cleanName = walletName.replace(/[^a-zA-Z0-9-_]/g, '-')
  const fileName = `${cleanName}-station-mobile.vult`
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`
  await FileSystem.writeAsStringAsync(fileUri, containerBase64)

  return fileUri
}

/**
 * Opens the system share sheet for a .vult file.
 */
export async function shareVaultFile(fileUri: string): Promise<void> {
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Export Vault Share',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/exportVaultShare.ts
git commit -m "feat: add vault share export service with protobuf serialization and AES-GCM"
```

---

### Task 4: Add "Export as Vault Share" to ExportPrivateKey screen

**Files:**
- Modify: `src/screens/ExportPrivateKey.tsx`

- [ ] **Step 1: Add vault share export UI to ExportPrivateKey screen**

In `src/screens/ExportPrivateKey.tsx`, make these changes:

1. Add imports at the top:

```typescript
import { ActivityIndicator } from 'react-native'
import { exportVaultShare, shareVaultFile } from 'services/exportVaultShare'
```

Add `ActivityIndicator` to the existing `react-native` import block.

2. Add new state variables inside the component, after the existing state declarations (after `const [copied, setCopied] = useState(false)`):

```typescript
  const [exportPassword, setExportPassword] = useState('')
  const [showExportForm, setShowExportForm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
```

3. Add the export handler function, after `handleCopy`:

```typescript
  const handleExportVaultShare = useCallback(async () => {
    if (!privateKey || exportPassword.length === 0) return
    setExporting(true)
    setExportError('')
    try {
      const fileUri = await exportVaultShare(privateKey, wallet.name, exportPassword)
      await shareVaultFile(fileUri)
      setShowExportForm(false)
      setExportPassword('')
    } catch (e) {
      setExportError('Failed to export vault share')
    } finally {
      setExporting(false)
    }
  }, [privateKey, wallet.name, exportPassword])
```

4. In the JSX, add the vault share export section after the "Copy to Clipboard" button and before the closing `</>` of the revealed-key branch (after line 113, before line 114 `</>`). Insert:

```tsx
          {!showExportForm ? (
            <Button
              title="Export as Vault Share"
              onPress={() => setShowExportForm(true)}
              theme="dodgerBlue"
              containerStyle={styles.button}
            />
          ) : (
            <View style={styles.exportForm}>
              <Text style={styles.exportLabel}>
                Set a password to encrypt the vault file:
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Export password"
                placeholderTextColor="#8295AE"
                secureTextEntry
                value={exportPassword}
                onChangeText={setExportPassword}
                autoCapitalize="none"
              />
              {exportError !== '' && (
                <Text style={styles.errorText}>{exportError}</Text>
              )}
              <Button
                title={exporting ? 'Exporting...' : 'Export .vult File'}
                onPress={handleExportVaultShare}
                disabled={exportPassword.length === 0 || exporting}
                theme="sapphire"
                containerStyle={styles.button}
              />
            </View>
          )}
```

5. Add the new styles to the StyleSheet (inside the `StyleSheet.create()` call, after the `button` style):

```typescript
  exportForm: {
    width: '100%',
    marginBottom: 12,
  },
  exportLabel: {
    color: '#8295AE',
    fontSize: 13,
    marginBottom: 8,
  },
```

Note: The `input` and `errorText` styles already exist and are reused.

- [ ] **Step 2: Add module alias for services directory**

Check `babel.config.js` for the module resolver aliases. The import `from 'services/exportVaultShare'` needs the `services` path alias to resolve. Look at how `utils/wallet` is aliased and add `services` the same way. If the aliases use a base path like `src/`, it should already resolve. If not, add:

```javascript
services: './src/services',
```

to the alias list in the module-resolver plugin config.

- [ ] **Step 3: Manually test the full flow**

1. Open the app, navigate to a non-Ledger wallet's WalletHome
2. Tap "Export Private Key" → enter wallet password → reveal key
3. Tap "Export as Vault Share" → enter an export password → tap "Export .vult File"
4. Verify the share sheet opens with a .vult file
5. Save the file (e.g., to Files app)
6. In VultiAgent or another Vultisig app, import the .vult file via "Import Vault Share"
7. Enter the export password when prompted
8. Verify the imported vault shows Terra chain with the correct address

- [ ] **Step 4: Commit**

```bash
git add src/screens/ExportPrivateKey.tsx babel.config.js
git commit -m "feat: add Export as Vault Share button with password encryption and share sheet"
```
