import ExpoDkls from '../../modules/expo-dkls'
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
