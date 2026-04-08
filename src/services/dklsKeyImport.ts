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
import { setupBatchImport } from './fastVaultServer'
import { encryptAesGcm, decryptAesGcm, deriveCipherKey, md5HashAsync, randomHex, randomUUID, sleep } from '../utils/mpcCrypto'

export type KeyImportStep =
  | 'setup'
  | 'joining'
  | 'waiting'
  | 'ecdsa'
  | 'finalizing'
  | 'complete'

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
 * Run the DKLS MPC message exchange loop with a messageId for relay routing.
 * The batch endpoint uses "p-ecdsa" as the messageId for the ECDSA protocol.
 */
async function runMpcProtocol(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  cipherKey: Uint8Array,
  messageId: string,
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
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const outMsg = await ExpoDkls.getOutboundMessage(sessionHandle)
        if (!outMsg) { await sleep(100); continue }

        const encrypted = encryptAesGcm(outMsg, cipherKey)
        const hash = await md5HashAsync(outMsg)

        let idx = 0
        while (true) {
          const receiver = await ExpoDkls.getMessageReceiver(sessionHandle, outMsg, idx)
          if (!receiver) break
          await sendRelayMessage(sessionId, localPartyId, receiver, encrypted, hash, sequenceNo++, messageId)
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
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const messages = await getRelayMessages(sessionId, localPartyId, messageId)
        if (messages.length === 0) { await sleep(100); continue }

        for (const msg of messages) {
          const cacheKey = `${msg.from}-${msg.hash}`
          if (processedMessages.has(cacheKey)) continue

          const decrypted = decryptAesGcm(msg.body, cipherKey)
          const finished = await ExpoDkls.inputMessage(sessionHandle, decrypted)
          processedMessages.add(cacheKey)
          await deleteRelayMessage(sessionId, localPartyId, msg.hash, messageId).catch(() => {})

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
 * Uses the batch import endpoint (POST /vault/batch/import) with protocols: ["ecdsa"].
 * This runs only the ECDSA round — no EdDSA, no per-chain rounds.
 * The server handles completion signaling internally.
 */
export async function importKeyToFastVault(options: {
  name: string
  email: string
  password: string
  privateKeyHex: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<KeyImportResult> {
  const { name, email, password, privateKeyHex, onProgress, signal } = options

  const report = (p: KeyImportProgress) => {
    console.log(`[KeyImport] ${p.step}: ${p.message} (${p.progress}%)`)
    onProgress?.(p)
  }

  report({ step: 'setup', message: 'Generating session...', progress: 5 })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const localPartyId = `sdk-${randomHex(4)}`
  const hexChainCode = '0'.repeat(64)

  let serverHash = 0
  for (let i = 0; i < sessionId.length; i++) {
    serverHash = ((serverHash << 5) - serverHash) + sessionId.charCodeAt(i)
    serverHash = serverHash & serverHash
  }
  let serverPartyId = `Server-${Math.abs(serverHash).toString().slice(-5)}`

  report({ step: 'setup', message: 'Setting up vault...', progress: 12 })

  await Promise.all([
    setupBatchImport({
      name,
      session_id: sessionId,
      hex_encryption_key: hexEncryptionKey,
      hex_chain_code: hexChainCode,
      local_party_id: serverPartyId,
      encryption_password: password,
      email,
      protocols: ['ecdsa'],
    }),
    joinRelaySession(sessionId, localPartyId),
  ])

  report({ step: 'joining', message: 'Joining relay...', progress: 20 })
  report({ step: 'waiting', message: 'Waiting for server...', progress: 28 })
  const parties = await waitForParties(sessionId, 2, 120_000, signal)

  // Validate that the server joined with the expected party ID
  const actualServerPartyId = parties.find(p => p !== localPartyId)
  if (!actualServerPartyId) throw new Error('Could not identify server party from relay')
  if (actualServerPartyId !== serverPartyId) {
    console.warn(`[KeyImport] Server party ID mismatch: expected ${serverPartyId}, got ${actualServerPartyId}`)
    serverPartyId = actualServerPartyId
  }

  await startRelaySession(sessionId, parties)

  report({ step: 'ecdsa', message: 'Importing key...', progress: 35 })

  const importResult = await ExpoDkls.createDklsKeyImportSession(
    privateKeyHex,
    hexChainCode,
    2,
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  const cipherKey = deriveCipherKey(hexEncryptionKey)

  // Batch endpoint uses setupKey="" for ecdsa — upload to default setup-message endpoint (no messageId)
  const encryptedSetup = encryptAesGcm(importResult.setupMessage, cipherKey)
  await uploadSetupMessage(sessionId, encryptedSetup)

  report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: 48 })

  // Batch endpoint uses messageId "p-ecdsa" for the ECDSA protocol
  await runMpcProtocol(
    importResult.sessionHandle,
    sessionId,
    localPartyId,
    cipherKey,
    'p-ecdsa',
    (mpcProgress) => {
      const stepProgress = 48 + (mpcProgress * 38)
      report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: Math.round(stepProgress) })
    },
    signal
  )

  report({ step: 'finalizing', message: 'Extracting keyshare...', progress: 86 })

  const result = await ExpoDkls.finishKeygen(importResult.sessionHandle)

  // Signal completion — server also signals via its defer block
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
