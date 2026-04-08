# Fast Vault Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert station-mobile's migration flow to produce 2-of-2 DKLS fast vaults with vultiserver, replacing single-signer KEYIMPORT vaults.

**Architecture:** Port vultiagent-app's `expo-dkls` native module (DKLS + Schnorr cryptography), relay client, and vultiserver API client. Modify the existing migration screens to collect per-wallet email/password and run the DKLS key import ceremony. Store threshold keyshares instead of raw private keys.

**Tech Stack:** Expo 55, React Native 0.83, TypeScript, `@noble/ciphers` (AES-GCM), `expo-crypto`, `expo-secure-store`, `@bufbuild/protobuf`, native DKLS via `expo-dkls` module.

**Spec:** `docs/superpowers/specs/2026-04-08-fast-vault-migration-design.md`

---

### Task 1: Copy expo-dkls native module

**Files:**
- Create: `modules/expo-dkls/` (entire directory from vultiagent-app)

- [ ] **Step 1: Copy the expo-dkls module**

```bash
cp -r /Users/apotheosis/git/vultisig/vultiagent-app/modules/expo-dkls /Users/apotheosis/git/vultisig/station-mobile/modules/expo-dkls
```

- [ ] **Step 2: Verify module structure**

```bash
ls -la modules/expo-dkls/
ls -la modules/expo-dkls/ios/Frameworks/
ls -la modules/expo-dkls/android/libs/
cat modules/expo-dkls/expo-module.config.json
```

Expected: `expo-module.config.json` exists with apple/android module definitions. iOS has `godkls.xcframework` and `goschnorr.xcframework`. Android has `dkls-release.aar` and `goschnorr-release.aar`.

- [ ] **Step 3: Verify TypeScript module loads**

```bash
cd /Users/apotheosis/git/vultisig/station-mobile && npx tsc --noEmit modules/expo-dkls/src/ExpoDklsModule.ts
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add modules/expo-dkls/
git commit -m "feat: add expo-dkls native module from vultiagent-app"
```

---

### Task 2: Add environment config

**Files:**
- Create: `src/config/env.ts`

- [ ] **Step 1: Create env config**

Create `src/config/env.ts`:

```typescript
export const env = {
  relayUrl: 'https://api.vultisig.com/router',
  vultisigApiUrl: 'https://api.vultisig.com',
} as const
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/config/env.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/env.ts
git commit -m "feat: add environment config for relay and vultiserver URLs"
```

---

### Task 3: Add crypto utilities

**Files:**
- Create: `src/utils/mpcCrypto.ts`

These utilities handle AES-GCM encryption/decryption for relay messages, MD5 hashing for deduplication, and random generation. Ported from vultiagent-app's `src/utils/crypto.ts`.

- [ ] **Step 1: Write tests**

Create `src/utils/__tests__/mpcCrypto.test.ts`:

```typescript
import { encryptAesGcm, decryptAesGcm, randomHex, randomUUID } from '../mpcCrypto'

describe('mpcCrypto', () => {
  test('randomHex produces correct length', () => {
    const result = randomHex(32)
    expect(result).toHaveLength(64) // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(result)).toBe(true)
  })

  test('randomUUID produces valid UUID', () => {
    const result = randomUUID()
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  test('encrypt then decrypt round-trips', () => {
    const key = randomHex(32)
    const plaintext = 'hello world MPC message'
    const encrypted = encryptAesGcm(plaintext, key)
    expect(encrypted).not.toBe(plaintext)
    const decrypted = decryptAesGcm(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  test('decrypt with wrong key throws', () => {
    const key1 = randomHex(32)
    const key2 = randomHex(32)
    const encrypted = encryptAesGcm('secret', key1)
    expect(() => decryptAesGcm(encrypted, key2)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/utils/__tests__/mpcCrypto.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement mpcCrypto.ts**

Create `src/utils/mpcCrypto.ts`:

```typescript
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hex as scureHex, base64 as scureBase64 } from '@scure/base'
import * as ExpoCrypto from 'expo-crypto'

export function hexToBytes(h: string): Uint8Array {
  return scureHex.decode(h)
}

export function bytesToHex(bytes: Uint8Array): string {
  return scureHex.encode(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
  return scureBase64.encode(bytes)
}

export function base64ToBytes(b64: string): Uint8Array {
  return scureBase64.decode(b64)
}

export function randomHex(byteCount: number): string {
  const bytes = ExpoCrypto.getRandomBytes(byteCount)
  return bytesToHex(bytes)
}

export function randomUUID(): string {
  return ExpoCrypto.randomUUID()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * AES-256-GCM encryption for relay messages.
 * Key: SHA256(hexEncryptionKey bytes) → 32-byte cipher key.
 * Output: base64(nonce[12] + ciphertext + authTag[16]).
 */
export function encryptAesGcm(plaintext: string, hexEncryptionKey: string): string {
  const keyBytes = hexToBytes(hexEncryptionKey)
  const cipherKey = sha256(keyBytes)
  const nonce = ExpoCrypto.getRandomBytes(12)
  const aes = gcm(cipherKey, nonce)
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = aes.encrypt(plaintextBytes)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return bytesToBase64(result)
}

/**
 * AES-256-GCM decryption for relay messages.
 * Input: base64(nonce[12] + ciphertext + authTag[16]).
 */
export function decryptAesGcm(encryptedBase64: string, hexEncryptionKey: string): string {
  const encrypted = base64ToBytes(encryptedBase64)
  const keyBytes = hexToBytes(hexEncryptionKey)
  const cipherKey = sha256(keyBytes)
  const nonce = encrypted.slice(0, 12)
  const ciphertextWithTag = encrypted.slice(12)
  const aes = gcm(cipherKey, nonce)
  const plaintext = aes.decrypt(ciphertextWithTag)
  return new TextDecoder().decode(plaintext)
}

/** MD5 hash for relay message deduplication. */
export async function md5HashAsync(input: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.MD5,
    input
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/utils/__tests__/mpcCrypto.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mpcCrypto.ts src/utils/__tests__/mpcCrypto.test.ts
git commit -m "feat: add MPC crypto utilities for relay message encryption"
```

---

### Task 4: Add relay client

**Files:**
- Create: `src/services/relay.ts`

- [ ] **Step 1: Create relay client**

Create `src/services/relay.ts` — ported directly from vultiagent-app:

```typescript
import { env } from '../config/env'

/** Register this party on the relay server. */
export async function joinRelaySession(sessionId: string, localPartyId: string): Promise<void> {
  const res = await fetch(`${env.relayUrl}/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([localPartyId]),
  })
  if (!res.ok) {
    throw new Error(`Join relay failed: ${res.status} ${await res.text()}`)
  }
}

/** Poll relay until expected number of parties have joined. */
export async function waitForParties(
  sessionId: string,
  expectedCount: number,
  timeoutMs = 120_000,
  signal?: AbortSignal
): Promise<string[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    signal?.throwIfAborted()
    const res = await fetch(`${env.relayUrl}/${sessionId}`, { signal })
    if (res.ok) {
      const parties: string[] = await res.json()
      if (parties.length >= expectedCount) return parties
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Timeout waiting for parties to join relay')
}

/** Start the MPC session with all parties. */
export async function startRelaySession(sessionId: string, parties: string[]): Promise<void> {
  const res = await fetch(`${env.relayUrl}/start/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parties),
  })
  if (!res.ok) {
    throw new Error(`Start session failed: ${res.status}`)
  }
}

/** Send an encrypted message to a peer via relay. */
export async function sendRelayMessage(
  sessionId: string,
  from: string,
  to: string,
  body: string,
  hash: string,
  sequenceNo: number,
  messageId?: string
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (messageId) headers.message_id = messageId

  const res = await fetch(`${env.relayUrl}/message/${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      from,
      to: [to],
      body,
      hash,
      sequence_no: sequenceNo,
    }),
  })
  if (!res.ok) {
    throw new Error(`Send message failed: ${res.status}`)
  }
}

/** Get pending messages from relay for this party. */
export async function getRelayMessages(
  sessionId: string,
  localPartyId: string,
  messageId?: string
): Promise<Array<{ from: string; to: string[]; body: string; hash: string; sequence_no: number }>> {
  const headers: Record<string, string> = {}
  if (messageId) headers.message_id = messageId

  const res = await fetch(`${env.relayUrl}/message/${sessionId}/${localPartyId}`, { headers })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Get messages failed: ${res.status}`)
  }
  return res.json()
}

/** Upload encrypted setup message for the other party. */
export async function uploadSetupMessage(sessionId: string, encryptedMessage: string, messageId?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
  if (messageId) headers.message_id = messageId
  const res = await fetch(`${env.relayUrl}/setup-message/${sessionId}`, {
    method: 'POST',
    headers,
    body: encryptedMessage,
  })
  if (!res.ok) {
    throw new Error(`Upload setup message failed: ${res.status} ${await res.text()}`)
  }
}

/** Signal this party has completed the ceremony. */
export async function signalComplete(sessionId: string, localPartyId: string): Promise<void> {
  const res = await fetch(`${env.relayUrl}/complete/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([localPartyId]),
  })
  if (!res.ok) {
    throw new Error(`Signal complete failed: ${res.status}`)
  }
}

/** Wait for all parties to signal completion. */
export async function waitForComplete(
  sessionId: string,
  parties: string[],
  attempts = 60,
  delayMs = 1000,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    signal?.throwIfAborted()
    const res = await fetch(`${env.relayUrl}/complete/${sessionId}`, { signal })
    if (res.ok) {
      const completePeers: string[] = await res.json()
      if (parties.every((p) => completePeers.includes(p))) return
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error('Timeout waiting for all parties to complete')
}

/** Delete a processed message from relay. */
export async function deleteRelayMessage(
  sessionId: string,
  localPartyId: string,
  messageHash: string,
  messageId?: string
): Promise<void> {
  const headers: Record<string, string> = {}
  if (messageId) headers.message_id = messageId
  await fetch(`${env.relayUrl}/message/${sessionId}/${localPartyId}/${messageHash}`, {
    method: 'DELETE',
    headers,
  })
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/services/relay.ts
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/relay.ts
git commit -m "feat: add relay client for MPC session coordination"
```

---

### Task 5: Add vultiserver API client

**Files:**
- Create: `src/services/fastVaultServer.ts`

- [ ] **Step 1: Create fastVaultServer.ts**

Create `src/services/fastVaultServer.ts`:

```typescript
import { env } from '../config/env'

/** Register a vault with vultiserver for DKLS key import. */
export async function setupVaultWithServer(input: {
  name: string
  session_id: string
  hex_encryption_key: string
  hex_chain_code: string
  local_party_id: string
  encryption_password: string
  email: string
  lib_type: number
  chains?: string[]
}): Promise<void> {
  const endpoint = input.lib_type === 2 ? '/vault/import' : '/vault/create'
  const url = `${env.vultisigApiUrl}${endpoint}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`setupVaultWithServer failed: ${res.status} ${text}`)
  }
}

/** Verify vault email with a code sent by vultiserver. */
export async function verifyVaultEmail(input: {
  public_key: string
  code: string
}): Promise<void> {
  const res = await fetch(
    `${env.vultisigApiUrl}/vault/verify/${input.public_key}/${input.code}`,
    { method: 'GET' }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`verifyVaultEmail failed: ${res.status} ${text}`)
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/services/fastVaultServer.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/fastVaultServer.ts
git commit -m "feat: add vultiserver API client for fast vault creation"
```

---

### Task 6: Add DKLS key import service

**Files:**
- Create: `src/services/dklsKeyImport.ts`

This is the core ceremony orchestrator — adapted from vultiagent-app's `importFastVault.ts`, stripped down to single ECDSA key import only (no EdDSA, no mnemonic, no per-chain derivation).

- [ ] **Step 1: Create dklsKeyImport.ts**

Create `src/services/dklsKeyImport.ts`:

```typescript
import ExpoDkls from '../../modules/expo-dkls/src/ExpoDklsModule'
import {
  joinRelaySession,
  waitForParties,
  startRelaySession,
  sendRelayMessage,
  getRelayMessages,
  deleteRelayMessage,
  uploadSetupMessage,
  signalComplete,
  waitForComplete,
} from './relay'
import { setupVaultWithServer } from './fastVaultServer'
import { encryptAesGcm, decryptAesGcm, md5HashAsync, randomHex, randomUUID, sleep } from '../utils/mpcCrypto'

export type KeyImportStep =
  | 'setup'
  | 'joining'
  | 'waiting'
  | 'ecdsa'
  | 'finalizing'
  | 'complete'
  | 'error'

export type KeyImportProgress = {
  step: KeyImportStep
  message: string
  progress: number // 0-100
}

export type KeyImportResult = {
  publicKey: string
  keyshare: string // base64 DKLS keyshare (opaque)
  chainCode: string // hex
  localPartyId: string
  serverPartyId: string
}

/**
 * Run the DKLS MPC message exchange loop.
 * Concurrent outbound (native → encrypt → relay) and inbound (relay → decrypt → native)
 * loops until the protocol completes or times out.
 */
async function runMpcProtocol(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  hexEncryptionKey: string,
  onProgress?: (progressPercent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let isComplete = false
  let sequenceNo = 0
  const processedMessages = new Set<string>()
  const startTime = Date.now()
  const TIMEOUT_MS = 120_000
  let lastProgressTime = startTime

  const processOutbound = async () => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      signal?.throwIfAborted()
      try {
        const outMsg = await ExpoDkls.getOutboundMessage(sessionHandle)
        if (!outMsg) { await sleep(100); continue }

        const encrypted = encryptAesGcm(outMsg, hexEncryptionKey)
        const hash = await md5HashAsync(outMsg)

        let idx = 0
        while (true) {
          const receiver = await ExpoDkls.getMessageReceiver(sessionHandle, outMsg, idx)
          if (!receiver) break
          await sendRelayMessage(sessionId, localPartyId, receiver, encrypted, hash, sequenceNo++)
          idx++
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        console.warn('[MPC] Outbound error:', err instanceof Error ? err.message : err)
        await sleep(200)
      }
    }
  }

  const processInbound = async () => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      signal?.throwIfAborted()
      try {
        const messages = await getRelayMessages(sessionId, localPartyId)
        if (messages.length === 0) { await sleep(100); continue }

        for (const msg of messages) {
          const cacheKey = `${msg.from}-${msg.hash}`
          if (processedMessages.has(cacheKey)) continue

          const decrypted = decryptAesGcm(msg.body, hexEncryptionKey)
          const finished = await ExpoDkls.inputMessage(sessionHandle, decrypted)
          processedMessages.add(cacheKey)
          await deleteRelayMessage(sessionId, localPartyId, msg.hash).catch(() => {})

          if (finished) {
            isComplete = true
            onProgress?.(1.0)
            return
          }

          const now = Date.now()
          if (onProgress && now - lastProgressTime > 1000) {
            const elapsed = now - startTime
            onProgress(Math.min(elapsed / (TIMEOUT_MS * 0.5), 0.95))
            lastProgressTime = now
          }
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        console.warn('[MPC] Inbound error:', err instanceof Error ? err.message : err)
        await sleep(200)
      }
    }
  }

  await Promise.all([processOutbound(), processInbound()])
  if (!isComplete) throw new Error('MPC protocol did not complete')
  onProgress?.(1.0)
}

/**
 * Import a single secp256k1 private key into a 2-of-2 DKLS fast vault.
 *
 * Runs the DKLS key import ceremony with vultiserver via relay.
 * Returns the device's DKLS keyshare (the raw private key no longer exists).
 */
export async function importKeyToFastVault(options: {
  name: string
  email: string
  password: string
  privateKeyHex: string // secp256k1 leaf key (64 hex chars)
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<KeyImportResult> {
  const { name, email, password, privateKeyHex, onProgress, signal } = options

  const report = (p: KeyImportProgress) => {
    console.log(`[KeyImport] ${p.step}: ${p.message} (${p.progress}%)`)
    onProgress?.(p)
  }

  // Step 1: Generate session parameters
  report({ step: 'setup', message: 'Generating session...', progress: 5 })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const localPartyId = `sdk-${randomHex(4)}`
  // 32 zero bytes as chain code — DKLS requires the parameter but it won't be
  // used for HD derivation since this is a single-chain (Terra) vault
  const hexChainCode = '0'.repeat(64)

  // Derive server party ID from session hash (matches vultiagent-app convention)
  let serverHash = 0
  for (let i = 0; i < sessionId.length; i++) {
    serverHash = ((serverHash << 5) - serverHash) + sessionId.charCodeAt(i)
    serverHash = serverHash & serverHash
  }
  const serverPartyId = `Server-${Math.abs(serverHash).toString().slice(-5)}`

  // Step 2: Register vault with vultiserver
  report({ step: 'setup', message: 'Setting up vault...', progress: 12 })

  await setupVaultWithServer({
    name,
    session_id: sessionId,
    hex_encryption_key: hexEncryptionKey,
    hex_chain_code: hexChainCode,
    local_party_id: serverPartyId,
    encryption_password: password,
    email,
    lib_type: 2, // KeyImport
    chains: ['Terra'],
  })

  // Step 3: Join relay and wait for server
  report({ step: 'joining', message: 'Joining relay...', progress: 20 })

  await joinRelaySession(sessionId, localPartyId)
  report({ step: 'waiting', message: 'Waiting for server...', progress: 28 })
  const parties = await waitForParties(sessionId, 2, 120_000, signal)
  await startRelaySession(sessionId, parties)

  // Step 4: Create DKLS key import session
  report({ step: 'ecdsa', message: 'Importing key...', progress: 35 })

  const importResult = await ExpoDkls.createDklsKeyImportSession(
    privateKeyHex,
    hexChainCode,
    2, // threshold = 2 for 2-of-2
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  // Upload encrypted setup message for server
  const encryptedSetup = encryptAesGcm(importResult.setupMessage, hexEncryptionKey)
  await uploadSetupMessage(sessionId, encryptedSetup)

  // Step 5: Run MPC protocol
  report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: 48 })

  await runMpcProtocol(
    importResult.sessionHandle,
    sessionId,
    localPartyId,
    hexEncryptionKey,
    (mpcProgress) => {
      const stepProgress = 48 + (mpcProgress * 38) // 48% → 86%
      report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: Math.round(stepProgress) })
    },
    signal
  )

  // Step 6: Finish and extract keyshare
  report({ step: 'finalizing', message: 'Extracting keyshare...', progress: 86 })

  const result = await ExpoDkls.finishKeygen(importResult.sessionHandle)

  // Step 7: Signal completion and wait for server
  await signalComplete(sessionId, localPartyId)
  await waitForComplete(sessionId, parties, 60, 1000, signal)

  report({ step: 'complete', message: 'Complete!', progress: 100 })

  return {
    publicKey: result.publicKey,
    keyshare: result.keyshare,
    chainCode: result.chainCode,
    localPartyId,
    serverPartyId,
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/services/dklsKeyImport.ts
```

Expected: No type errors (may need to adjust the import path for ExpoDkls depending on module resolution — see step 3).

- [ ] **Step 3: Fix ExpoDkls import path if needed**

If the import path `../../modules/expo-dkls/src/ExpoDklsModule` doesn't resolve, check how vultiagent-app imports it:

```bash
grep -r "from.*expo-dkls" /Users/apotheosis/git/vultisig/vultiagent-app/src/services/ | head -5
```

Adjust the import to match whatever pattern works (may be `../../modules/expo-dkls` if the module has a package.json with a `main` field).

- [ ] **Step 4: Commit**

```bash
git add src/services/dklsKeyImport.ts
git commit -m "feat: add DKLS key import ceremony orchestrator"
```

---

### Task 7: Add VaultEmail screen

**Files:**
- Create: `src/screens/migration/VaultEmail.tsx`

Matches vultiagent-app's `VaultEmailScreen.tsx` — dark navy background, email input with validation, step indicator.

- [ ] **Step 1: Create VaultEmail screen**

Create `src/screens/migration/VaultEmail.tsx`:

```typescript
import React, { useState } from 'react'
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInRight } from 'react-native-reanimated'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultEmail'>

function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  const atIdx = trimmed.indexOf('@')
  if (atIdx < 1) return false
  const domain = trimmed.slice(atIdx + 1)
  return domain.includes('.') && domain.indexOf('.') < domain.length - 1
}

export default function VaultEmail() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteProp<MigrationStackParams, 'VaultEmail'>>()
  const { walletName, walletIndex, totalWallets, wallets, results } = route.params

  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)

  const valid = isValidEmail(email)
  const showError = touched && !valid && email.length > 0

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View entering={FadeInRight.duration(250)} style={styles.content}>
          <View style={styles.stepRow}>
            <Text style={styles.stepText} fontType="medium">
              Step 1 of 2
            </Text>
            <Text style={styles.walletLabel} fontType="book">
              Wallet {walletIndex + 1}/{totalWallets}: {walletName}
            </Text>
          </View>

          <Text style={styles.title} fontType="bold">
            Enter your email
          </Text>
          <Text style={styles.subtitle} fontType="book">
            This email is used to help recover your vault.
          </Text>

          <View style={[styles.inputContainer, showError && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={VULTISIG.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              testID="vault-email-input"
            />
          </View>

          {showError && (
            <Text style={styles.errorText} fontType="book">
              Incorrect e-mail, please check
            </Text>
          )}
        </Animated.View>

        <View style={styles.buttonContainer}>
          <Button
            title="Next"
            theme="sapphire"
            disabled={!valid}
            onPress={() =>
              navigation.navigate('VaultPassword', {
                walletName,
                walletIndex,
                totalWallets,
                wallets,
                results,
                email: email.trim(),
              })
            }
            containerStyle={styles.button}
            testID="vault-email-next"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VULTISIG.bg },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  stepRow: { marginBottom: 24 },
  stepText: { fontSize: 13, color: VULTISIG.accent, marginBottom: 4 },
  walletLabel: { fontSize: 13, color: VULTISIG.textSecondary },
  title: { fontSize: 28, color: VULTISIG.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: VULTISIG.textSecondary, lineHeight: 22, marginBottom: 32 },
  inputContainer: {
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusMd,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  inputError: { borderColor: VULTISIG.error },
  input: { fontSize: 16, color: VULTISIG.textPrimary },
  errorText: { fontSize: 13, color: VULTISIG.error, marginTop: 8 },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24 },
  button: { width: '100%' },
})
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/screens/migration/VaultEmail.tsx
```

Expected: Will fail because `MigrationStackParams` doesn't have `VaultEmail` yet. That's expected — we'll update the navigator in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/VaultEmail.tsx
git commit -m "feat: add VaultEmail migration screen"
```

---

### Task 8: Add VaultPassword screen

**Files:**
- Create: `src/screens/migration/VaultPassword.tsx`

- [ ] **Step 1: Create VaultPassword screen**

Create `src/screens/migration/VaultPassword.tsx`:

```typescript
import React, { useState } from 'react'
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInRight } from 'react-native-reanimated'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultPassword'>

export default function VaultPassword() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteProp<MigrationStackParams, 'VaultPassword'>>()
  const { walletName, walletIndex, totalWallets, wallets, results, email } = route.params

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const isLongEnough = password.length >= 6
  const passwordsMatch = password === confirm
  const valid = isLongEnough && passwordsMatch

  const showLengthError = touched && !isLongEnough && password.length > 0
  const showMatchError = touched && isLongEnough && confirm.length > 0 && !passwordsMatch

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View entering={FadeInRight.duration(250)} style={styles.content}>
          <View style={styles.stepRow}>
            <Text style={styles.stepText} fontType="medium">
              Step 2 of 2
            </Text>
            <Text style={styles.walletLabel} fontType="book">
              Wallet {walletIndex + 1}/{totalWallets}: {walletName}
            </Text>
          </View>

          <Text style={styles.title} fontType="bold">
            Choose a password
          </Text>
          <Text style={styles.subtitle} fontType="book">
            This password encrypts your vault. Make it strong.
          </Text>

          <View style={[styles.inputContainer, showLengthError && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={VULTISIG.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched(true)}
              testID="vault-password-input"
            />
          </View>
          {showLengthError && (
            <Text style={styles.errorText} fontType="book">
              Password must be at least 6 characters
            </Text>
          )}

          <View style={[styles.inputContainer, styles.secondInput, showMatchError && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={VULTISIG.textSecondary}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setTouched(true)}
              testID="vault-password-confirm"
            />
          </View>
          {showMatchError && (
            <Text style={styles.errorText} fontType="book">
              Passwords do not match
            </Text>
          )}
        </Animated.View>

        <View style={styles.buttonContainer}>
          <Button
            title="Continue"
            theme="sapphire"
            disabled={!valid}
            onPress={() =>
              navigation.navigate('KeygenProgress', {
                walletName,
                walletIndex,
                totalWallets,
                wallets,
                results,
                email,
                password,
              })
            }
            containerStyle={styles.button}
            testID="vault-password-continue"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VULTISIG.bg },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  stepRow: { marginBottom: 24 },
  stepText: { fontSize: 13, color: VULTISIG.accent, marginBottom: 4 },
  walletLabel: { fontSize: 13, color: VULTISIG.textSecondary },
  title: { fontSize: 28, color: VULTISIG.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: VULTISIG.textSecondary, lineHeight: 22, marginBottom: 32 },
  inputContainer: {
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusMd,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  secondInput: { marginTop: 16 },
  inputError: { borderColor: VULTISIG.error },
  input: { fontSize: 16, color: VULTISIG.textPrimary },
  errorText: { fontSize: 13, color: VULTISIG.error, marginTop: 8 },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24 },
  button: { width: '100%' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/VaultPassword.tsx
git commit -m "feat: add VaultPassword migration screen"
```

---

### Task 9: Add KeygenProgress screen

**Files:**
- Create: `src/screens/migration/KeygenProgress.tsx`

This replaces the old `MigrationProgress.tsx`. Shows a full-screen progress animation during the DKLS ceremony, with skip/retry on failure.

- [ ] **Step 1: Create KeygenProgress screen**

Create `src/screens/migration/KeygenProgress.tsx`:

```typescript
import React, { useEffect, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import { importKeyToFastVault, KeyImportProgress } from 'services/dklsKeyImport'
import { getAuthDataValue } from 'utils/authData'
import { decrypt } from 'utils/crypto'
import type { AuthDataValueType } from 'utils/authData'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationResult } from 'services/migrateToVault'
import { storeFastVault } from 'services/migrateToVault'

type Nav = StackNavigationProp<MigrationStackParams, 'KeygenProgress'>

export default function KeygenProgress() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteProp<MigrationStackParams, 'KeygenProgress'>>()
  const { walletName, walletIndex, totalWallets, wallets, results, email, password } = route.params

  const [phase, setPhase] = useState<string>('Connecting...')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const progressValue = useSharedValue(0)

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }))

  const runCeremony = async () => {
    setError(null)
    setDone(false)
    progressValue.value = 0
    const ac = new AbortController()
    abortRef.current = ac

    try {
      // Decrypt the legacy private key
      const authEntry = await getAuthDataValue(walletName) as AuthDataValueType | undefined
      if (!authEntry || authEntry.ledger) {
        throw new Error('Wallet data not found or is a Ledger wallet')
      }
      const privateKeyHex = decrypt(authEntry.encryptedKey, authEntry.password)
      if (!privateKeyHex) throw new Error('Failed to decrypt private key')

      // Run DKLS key import ceremony
      const result = await importKeyToFastVault({
        name: walletName,
        email,
        password,
        privateKeyHex,
        signal: ac.signal,
        onProgress: (p: KeyImportProgress) => {
          setPhase(p.progress < 35 ? 'Connecting...' : 'Generating...')
          progressValue.value = withTiming(p.progress / 100, {
            duration: 800,
            easing: Easing.out(Easing.cubic),
          })
        },
      })

      // Store the DKLS vault and delete legacy data
      await storeFastVault(walletName, result)

      setDone(true)
      advanceToNext({ wallet: wallets[walletIndex], success: true })
    } catch (err) {
      if (ac.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }

  const advanceToNext = (thisResult: MigrationResult) => {
    const updatedResults = [...results, thisResult]
    const nextIndex = walletIndex + 1

    // Find next non-Ledger wallet
    let nextWalletIndex = nextIndex
    while (nextWalletIndex < wallets.length && wallets[nextWalletIndex].ledger) {
      updatedResults.push({ wallet: wallets[nextWalletIndex], success: true }) // Ledger wallets pass through
      nextWalletIndex++
    }

    if (nextWalletIndex >= wallets.length) {
      navigation.navigate('MigrationSuccess', { results: updatedResults })
    } else {
      navigation.navigate('VaultEmail', {
        walletName: wallets[nextWalletIndex].name,
        walletIndex: nextWalletIndex,
        totalWallets,
        wallets,
        results: updatedResults,
      })
    }
  }

  const handleSkip = () => {
    abortRef.current?.abort()
    advanceToNext({ wallet: wallets[walletIndex], success: false, error: 'Skipped' })
  }

  useEffect(() => {
    runCeremony()
    return () => { abortRef.current?.abort() }
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <Text style={styles.walletLabel} fontType="book">
          Wallet {walletIndex + 1}/{totalWallets}: {walletName}
        </Text>

        {!error ? (
          <>
            <View style={styles.progressContainer}>
              <Text style={styles.phaseText} fontType="medium">{phase}</Text>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, progressStyle]} />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle} fontType="medium">Failed</Text>
            <Text style={styles.errorMessage} fontType="book">{error}</Text>
            <View style={styles.errorButtons}>
              <Button
                title="Skip"
                theme="ghost"
                onPress={handleSkip}
                containerStyle={styles.errorButton}
                testID="keygen-skip"
              />
              <Button
                title="Retry"
                theme="sapphire"
                onPress={runCeremony}
                containerStyle={styles.errorButton}
                testID="keygen-retry"
              />
            </View>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VULTISIG.bg, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  walletLabel: { fontSize: 13, color: VULTISIG.textSecondary, marginBottom: 32 },
  progressContainer: { width: '100%', alignItems: 'center' },
  phaseText: { fontSize: 18, color: VULTISIG.textPrimary, marginBottom: 24 },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: VULTISIG.card,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: VULTISIG.accent,
    borderRadius: 2,
  },
  errorContainer: { alignItems: 'center', paddingHorizontal: 16 },
  errorTitle: { fontSize: 22, color: VULTISIG.error, marginBottom: 12 },
  errorMessage: { fontSize: 14, color: VULTISIG.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  errorButtons: { flexDirection: 'row', gap: 12 },
  errorButton: { flex: 1 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/KeygenProgress.tsx
git commit -m "feat: add KeygenProgress screen for DKLS ceremony"
```

---

### Task 10: Update MigrationNavigator and migrateToVault

**Files:**
- Modify: `src/navigation/MigrationNavigator.tsx`
- Modify: `src/services/migrateToVault.ts`

- [ ] **Step 1: Update MigrationNavigator with new screens and route params**

Replace `src/navigation/MigrationNavigator.tsx` with:

```typescript
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import WalletDiscovery from '../screens/migration/WalletDiscovery'
import VaultEmail from '../screens/migration/VaultEmail'
import VaultPassword from '../screens/migration/VaultPassword'
import KeygenProgress from '../screens/migration/KeygenProgress'
import MigrationSuccess from '../screens/migration/MigrationSuccess'

import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

export type MigrationStackParams = {
  WalletDiscovery: undefined
  VaultEmail: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
  }
  VaultPassword: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email: string
  }
  KeygenProgress: {
    walletName: string
    walletIndex: number
    totalWallets: number
    wallets: MigrationWallet[]
    results: MigrationResult[]
    email: string
    password: string
  }
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
      <Stack.Screen name="VaultEmail" component={VaultEmail} />
      <Stack.Screen name="VaultPassword" component={VaultPassword} />
      <Stack.Screen name="KeygenProgress" component={KeygenProgress} />
      <Stack.Screen name="MigrationSuccess" component={MigrationSuccess} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Add storeFastVault and deleteLegacyWallet to migrateToVault.ts**

Add to `src/services/migrateToVault.ts` (keep existing functions, add new ones):

```typescript
import { toBinary, fromBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { getAuthData, getAuthDataValue, AuthDataValueType, LedgerDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'
import { derivePublicKeyHex, buildVaultProto } from './vaultProto'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { create } from '@bufbuild/protobuf'
import type { KeyImportResult } from './dklsKeyImport'
import { removeAuthData } from 'utils/authData'

const VAULT_KEY_PREFIX = 'VAULT-'

const VAULT_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

// ... keep existing discoverLegacyWallets, migrateWalletToVault, migrateAllWallets, getStoredVault ...

/**
 * Stores a DKLS fast vault and deletes the legacy auth data entry.
 * Only deletes legacy data after verifying the vault reads back correctly.
 */
export async function storeFastVault(
  walletName: string,
  result: KeyImportResult,
): Promise<void> {
  // Build vault protobuf with DKLS lib type
  const vault = create(VaultSchema, {
    name: walletName,
    publicKeyEcdsa: result.publicKey,
    publicKeyEddsa: '',
    signers: [result.localPartyId, result.serverPartyId],
    localPartyId: result.localPartyId,
    hexChainCode: result.chainCode,
    resharePrefix: '',
    libType: LibType.DKLS,
    keyShares: [{ publicKey: result.publicKey, keyshare: result.keyshare }],
    chainPublicKeys: [{ chain: 'Terra', publicKey: result.publicKey, isEddsa: false }],
    createdAt: {
      seconds: BigInt(Math.floor(Date.now() / 1000)),
      nanos: 0,
    },
    publicKeyMldsa44: '',
  })

  const vaultBytes = toBinary(VaultSchema, vault)
  const encoded = base64.encode(vaultBytes)

  // Store the DKLS vault
  await SecureStore.setItemAsync(
    `${VAULT_KEY_PREFIX}${walletName}`,
    encoded,
    VAULT_STORE_OPTS,
  )

  // Verify it reads back correctly
  const readBack = await SecureStore.getItemAsync(
    `${VAULT_KEY_PREFIX}${walletName}`,
    VAULT_STORE_OPTS,
  )
  if (!readBack) {
    throw new Error('Vault verification failed: could not read back stored vault')
  }
  const decoded = fromBinary(VaultSchema, base64.decode(readBack))
  if (decoded.publicKeyEcdsa !== result.publicKey) {
    throw new Error('Vault verification failed: public key mismatch')
  }

  // Delete legacy auth data now that vault is verified
  await removeAuthData({ walletName })
}

/**
 * Check if a stored vault is a DKLS fast vault (vs legacy KEYIMPORT).
 */
export async function isVaultFastVault(walletName: string): Promise<boolean> {
  const stored = await getStoredVault(walletName)
  if (!stored) return false
  try {
    const decoded = fromBinary(VaultSchema, base64.decode(stored))
    return decoded.libType === LibType.DKLS
  } catch {
    return false
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit src/services/migrateToVault.ts src/navigation/MigrationNavigator.tsx
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/MigrationNavigator.tsx src/services/migrateToVault.ts
git commit -m "feat: update navigator and vault storage for DKLS fast vaults"
```

---

### Task 11: Update WalletDiscovery to start per-wallet flow

**Files:**
- Modify: `src/screens/migration/WalletDiscovery.tsx`

- [ ] **Step 1: Update WalletDiscovery navigation**

In `src/screens/migration/WalletDiscovery.tsx`, change the "Upgrade" button's `onPress` to navigate to the first non-Ledger wallet's `VaultEmail` screen:

Replace:
```typescript
onPress={() => navigation.navigate('MigrationProgress', { wallets })}
```

With:
```typescript
onPress={() => {
  // Find first non-Ledger wallet
  const firstStandard = wallets.findIndex((w) => !w.ledger)
  if (firstStandard === -1) {
    // All Ledger wallets — skip straight to success
    navigation.navigate('MigrationSuccess', {
      results: wallets.map((w) => ({ wallet: w, success: true })),
    })
    return
  }
  navigation.navigate('VaultEmail', {
    walletName: wallets[firstStandard].name,
    walletIndex: firstStandard,
    totalWallets: wallets.length,
    wallets,
    results: wallets.slice(0, firstStandard).map((w) => ({ wallet: w, success: true })),
  })
}}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit src/screens/migration/WalletDiscovery.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/migration/WalletDiscovery.tsx
git commit -m "feat: update WalletDiscovery to start per-wallet DKLS flow"
```

---

### Task 12: Update MigrationSuccess for per-wallet results

**Files:**
- Modify: `src/screens/migration/MigrationSuccess.tsx`

- [ ] **Step 1: Update MigrationSuccess to show mixed results**

The screen already receives `results: MigrationResult[]` and displays per-wallet success/failure. Update it to distinguish between fast vault (success) and skipped/failed (warning). Read the current file and modify the wallet result rendering to show a warning icon for `success: false` results with appropriate messaging like "Legacy — tap to upgrade in wallet list".

The key change: ensure the `vaultsUpgraded` flag is set regardless of partial failure (this is already the behavior).

- [ ] **Step 2: Commit**

```bash
git add src/screens/migration/MigrationSuccess.tsx
git commit -m "feat: update MigrationSuccess for mixed fast vault / legacy results"
```

---

### Task 13: Update vault export for DKLS vaults

**Files:**
- Modify: `src/services/exportVaultShare.ts`

- [ ] **Step 1: Update exportVaultShare to read stored DKLS vault directly**

The current `exportVaultShare` rebuilds the vault from the raw private key. For DKLS vaults, we should read the stored vault protobuf directly (it already contains the DKLS keyshare).

Read `src/services/exportVaultShare.ts` and modify `exportVaultShare()`:

```typescript
import { getStoredVault, isVaultFastVault } from './migrateToVault'

export async function exportVaultShare(
  walletName: string,
  exportPassword: string,
  // Only needed for legacy vaults — DKLS vaults read from storage
  privateKeyHex?: string,
): Promise<string> {
  let vaultBytes: Uint8Array

  if (await isVaultFastVault(walletName)) {
    // DKLS vault: read stored vault protobuf directly
    const stored = await getStoredVault(walletName)
    if (!stored) throw new Error('Vault not found')
    vaultBytes = base64.decode(stored)
  } else {
    // Legacy vault: build from raw key (existing behavior)
    if (!privateKeyHex) throw new Error('Private key required for legacy vault export')
    const publicKeyHex = derivePublicKeyHex(privateKeyHex)
    const vault = buildVaultProto(walletName, publicKeyHex, privateKeyHex)
    vaultBytes = toBinary(VaultSchema, vault)
  }

  // Encrypt and wrap in VaultContainer (same for both paths)
  // ... rest of existing encryption logic unchanged ...
}
```

- [ ] **Step 2: Update ExportPrivateKey screen**

In `src/screens/ExportPrivateKey.tsx`, check if the vault is a DKLS fast vault. If so, hide the "Reveal Private Key" section and only show the "Export Vault Share" button. Read the current file and add a check:

```typescript
const [isFastVault, setIsFastVault] = useState(false)

useEffect(() => {
  isVaultFastVault(walletName).then(setIsFastVault)
}, [])

// In render: conditionally hide raw key section if isFastVault
```

- [ ] **Step 3: Commit**

```bash
git add src/services/exportVaultShare.ts src/screens/ExportPrivateKey.tsx
git commit -m "feat: update vault export for DKLS fast vaults"
```

---

### Task 14: Delete old MigrationProgress screen

**Files:**
- Delete: `src/screens/migration/MigrationProgress.tsx`

- [ ] **Step 1: Remove old MigrationProgress**

```bash
rm src/screens/migration/MigrationProgress.tsx
```

- [ ] **Step 2: Remove any remaining imports**

Search for and remove any imports of `MigrationProgress`:

```bash
grep -r "MigrationProgress" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references. The navigator no longer includes this screen (updated in Task 10).

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old MigrationProgress screen (replaced by KeygenProgress)"
```

---

### Task 15: Add "Legacy" badge and upgrade action to wallet list

**Files:**
- Modify: wallet list screen (likely `src/screens/WalletHome.tsx` or `src/screens/WalletPicker.tsx`)

- [ ] **Step 1: Identify the wallet list screen**

```bash
grep -r "VAULT-" src/screens/ --include="*.tsx" -l
```

Read the wallet list/picker screen to understand how wallets are displayed.

- [ ] **Step 2: Add legacy badge and upgrade button**

For each wallet in the list, check `isVaultFastVault(walletName)`. If false, show a "Legacy" badge (matching the Ledger badge style from WalletDiscovery) and an "Upgrade to Fast Vault" button that navigates to `VaultEmail` for that single wallet.

The navigation for single-wallet upgrade:
```typescript
navigation.navigate('Migration', {
  screen: 'VaultEmail',
  params: {
    walletName: wallet.name,
    walletIndex: 0,
    totalWallets: 1,
    wallets: [wallet],
    results: [],
  },
})
```

- [ ] **Step 3: Verify compilation and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: add Legacy badge and upgrade action to wallet list"
```

---

### Task 16: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: iOS build check**

```bash
cd ios && pod install && cd ..
npx expo run:ios --no-install
```

Expected: Builds successfully with expo-dkls native module linked.

- [ ] **Step 3: Android build check**

```bash
npx expo run:android
```

Expected: Builds successfully with DKLS AAR libraries linked.

- [ ] **Step 4: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from fast vault integration"
```

---

### Task 17: E2E tests — full migration

**Files:**
- Create: `e2e/fast-vault-migration.test.js`

- [ ] **Step 1: Write full migration E2E test**

Create `e2e/fast-vault-migration.test.js`:

```javascript
const { device, element, by, expect } = require('detox')

describe('Fast Vault Migration', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  it('should discover wallets and show upgrade button', async () => {
    await expect(element(by.text('Wallets Found'))).toBeVisible()
    await expect(element(by.id('wallet-card-0'))).toBeVisible()
    await expect(element(by.id('upgrade-button'))).toBeVisible()
  })

  it('should navigate to email screen on upgrade', async () => {
    await element(by.id('upgrade-button')).tap()
    await expect(element(by.text('Enter your email'))).toBeVisible()
    await expect(element(by.text('Step 1 of 2'))).toBeVisible()
  })

  it('should validate email and navigate to password', async () => {
    await element(by.id('vault-email-input')).typeText('test@example.com')
    await element(by.id('vault-email-next')).tap()
    await expect(element(by.text('Choose a password'))).toBeVisible()
    await expect(element(by.text('Step 2 of 2'))).toBeVisible()
  })

  it('should validate password and start keygen', async () => {
    await element(by.id('vault-password-input')).typeText('testpass123')
    await element(by.id('vault-password-confirm')).typeText('testpass123')
    await element(by.id('vault-password-continue')).tap()
    // Keygen progress screen should appear
    await expect(element(by.text('Connecting...'))).toBeVisible()
  })

  it('should complete migration and show success', async () => {
    // Wait for DKLS ceremony to complete (up to 120s)
    await waitFor(element(by.text('Wallets Upgraded!')))
      .toBeVisible()
      .withTimeout(120000)
  })
})
```

- [ ] **Step 2: Run the test**

```bash
npx detox test -c ios.sim.debug e2e/fast-vault-migration.test.js
```

Expected: All tests pass (requires vultiserver to be reachable).

- [ ] **Step 3: Commit**

```bash
git add e2e/fast-vault-migration.test.js
git commit -m "test: add E2E test for full fast vault migration flow"
```

---

### Task 18: E2E tests — partial migration and retry

**Files:**
- Create: `e2e/fast-vault-partial-migration.test.js`

- [ ] **Step 1: Write partial migration test**

Create `e2e/fast-vault-partial-migration.test.js`:

```javascript
const { device, element, by, expect } = require('detox')

describe('Partial Fast Vault Migration', () => {
  beforeAll(async () => {
    // Seed with multiple wallets for testing
    await device.launchApp({ newInstance: true })
  })

  it('should allow skipping a wallet during keygen', async () => {
    await element(by.id('upgrade-button')).tap()
    // Fill email and password for first wallet
    await element(by.id('vault-email-input')).typeText('test@example.com')
    await element(by.id('vault-email-next')).tap()
    await element(by.id('vault-password-input')).typeText('testpass123')
    await element(by.id('vault-password-confirm')).typeText('testpass123')
    await element(by.id('vault-password-continue')).tap()

    // If keygen fails, skip button should appear
    // (This test depends on network conditions — may need mocking)
    // For now, verify the skip button exists on the keygen screen
    await waitFor(element(by.id('keygen-skip')))
      .toBeVisible()
      .withTimeout(130000) // Wait past the 120s timeout
    await element(by.id('keygen-skip')).tap()
  })

  it('should show mixed results on success screen', async () => {
    // After skipping, should eventually reach success screen
    await waitFor(element(by.text('Wallets Upgraded!')))
      .toBeVisible()
      .withTimeout(10000)
    // Skipped wallet should show warning indicator
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fast-vault-partial-migration.test.js
git commit -m "test: add E2E test for partial migration with skip"
```
