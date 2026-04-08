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
 * Run the DKLS MPC message exchange loop.
 * Concurrent outbound (native → encrypt → relay) and inbound (relay → decrypt → native)
 * loops until the protocol completes or times out.
 */
async function runMpcProtocol(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  cipherKey: Uint8Array,
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
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const messages = await getRelayMessages(sessionId, localPartyId)
        if (messages.length === 0) { await sleep(100); continue }

        for (const msg of messages) {
          const cacheKey = `${msg.from}-${msg.hash}`
          if (processedMessages.has(cacheKey)) continue

          const decrypted = decryptAesGcm(msg.body, cipherKey)
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

/** ECDSA MPC protocol with a messageId for per-chain imports. */
async function runMpcProtocolWithMessageId(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  cipherKey: Uint8Array,
  messageId: string,
  signal?: AbortSignal
): Promise<void> {
  let isComplete = false
  let sequenceNo = 0
  const processedMessages = new Set<string>()
  const startTime = Date.now()
  const TIMEOUT_MS = 120_000

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
          if (finished) { isComplete = true; return }
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        await sleep(200)
      }
    }
  }

  await Promise.all([processOutbound(), processInbound()])
  if (!isComplete) throw new Error(`MPC protocol (${messageId}) did not complete`)
}

/** Schnorr (EdDSA) variant of runMpcProtocol. */
async function runMpcSchnorrProtocol(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  cipherKey: Uint8Array,
  onProgress?: (progressPercent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let isComplete = false
  let sequenceNo = 0
  const processedMessages = new Set<string>()
  const startTime = Date.now()
  const TIMEOUT_MS = 120_000

  const processOutbound = async () => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const outMsg = await ExpoDkls.getSchnorrOutboundMessage(sessionHandle)
        if (!outMsg) { await sleep(100); continue }

        const encrypted = encryptAesGcm(outMsg, cipherKey)
        const hash = await md5HashAsync(outMsg)

        let idx = 0
        while (true) {
          const receiver = await ExpoDkls.getSchnorrMessageReceiver(sessionHandle, outMsg, idx)
          if (!receiver) break
          await sendRelayMessage(sessionId, localPartyId, receiver, encrypted, hash, sequenceNo++, 'eddsa_key_import')
          idx++
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        await sleep(200)
      }
    }
  }

  const processInbound = async () => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const messages = await getRelayMessages(sessionId, localPartyId, 'eddsa_key_import')
        if (messages.length === 0) { await sleep(100); continue }

        for (const msg of messages) {
          const cacheKey = `${msg.from}-${msg.hash}`
          if (processedMessages.has(cacheKey)) continue

          const decrypted = decryptAesGcm(msg.body, cipherKey)
          const finished = await ExpoDkls.inputSchnorrMessage(sessionHandle, decrypted)
          processedMessages.add(cacheKey)
          await deleteRelayMessage(sessionId, localPartyId, msg.hash, 'eddsa_key_import').catch(() => {})

          if (finished) {
            isComplete = true
            onProgress?.(1.0)
            return
          }
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        await sleep(200)
      }
    }
  }

  await Promise.all([processOutbound(), processInbound()])
  if (!isComplete) throw new Error('Schnorr MPC protocol did not complete')
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

  report({ step: 'setup', message: 'Generating session...', progress: 5 })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const localPartyId = `sdk-${randomHex(4)}`
  const hexChainCode = '0'.repeat(64) // DKLS requires a chain code; zeros since this is a single-chain vault

  let serverHash = 0
  for (let i = 0; i < sessionId.length; i++) {
    serverHash = ((serverHash << 5) - serverHash) + sessionId.charCodeAt(i)
    serverHash = serverHash & serverHash
  }
  const serverPartyId = `Server-${Math.abs(serverHash).toString().slice(-5)}`

  report({ step: 'setup', message: 'Setting up vault...', progress: 12 })

  await Promise.all([
    setupVaultWithServer({
      name,
      session_id: sessionId,
      hex_encryption_key: hexEncryptionKey,
      hex_chain_code: hexChainCode,
      local_party_id: serverPartyId,
      encryption_password: password,
      email,
      lib_type: 2,
      chains: ['Terra'],
    }),
    joinRelaySession(sessionId, localPartyId),
  ])

  report({ step: 'joining', message: 'Joining relay...', progress: 20 })
  report({ step: 'waiting', message: 'Waiting for server...', progress: 28 })
  const parties = await waitForParties(sessionId, 2, 120_000, signal)
  await startRelaySession(sessionId, parties)

  report({ step: 'ecdsa', message: 'Importing key...', progress: 35 })

  const importResult = await ExpoDkls.createDklsKeyImportSession(
    privateKeyHex,
    hexChainCode,
    2, // threshold = 2 for 2-of-2
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  const cipherKey = deriveCipherKey(hexEncryptionKey)

  const encryptedSetup = encryptAesGcm(importResult.setupMessage, cipherKey)
  await uploadSetupMessage(sessionId, encryptedSetup)

  report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: 48 })

  await runMpcProtocol(
    importResult.sessionHandle,
    sessionId,
    localPartyId,
    cipherKey,
    (mpcProgress) => {
      const stepProgress = 48 + (mpcProgress * 38) // 48% → 86%
      report({ step: 'ecdsa', message: 'Running MPC protocol...', progress: Math.round(stepProgress) })
    },
    signal
  )

  report({ step: 'finalizing', message: 'Finalizing ECDSA...', progress: 80 })

  const ecdsaResult = await ExpoDkls.finishKeygen(importResult.sessionHandle)

  // Server expects an EdDSA (Schnorr) root key import after ECDSA (see vultiserver dkls.go:152).
  // Generate a random ed25519 key — Terra doesn't use EdDSA but the server requires this round.
  await sleep(500) // match server's 500ms gap between rounds
  report({ step: 'finalizing', message: 'Importing EdDSA key...', progress: 84 })

  const eddsaPrivateKey = randomHex(32)
  const eddsaImport = await ExpoDkls.createSchnorrKeyImportSession(
    eddsaPrivateKey,
    hexChainCode,
    2,
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  const encryptedEddsaSetup = encryptAesGcm(eddsaImport.setupMessage, cipherKey)
  await uploadSetupMessage(sessionId, encryptedEddsaSetup, 'eddsa_key_import')

  await runMpcSchnorrProtocol(
    eddsaImport.sessionHandle,
    sessionId,
    localPartyId,
    cipherKey,
    undefined,
    signal
  )

  await ExpoDkls.finishSchnorrKeygen(eddsaImport.sessionHandle)

  // Per-chain key import for Terra (server iterates req.Chains, see dkls.go:187)
  // Terra uses ECDSA (secp256k1) — import the same key with messageId='Terra'
  report({ step: 'finalizing', message: 'Importing Terra key...', progress: 88 })

  const terraImport = await ExpoDkls.createDklsKeyImportSession(
    privateKeyHex,
    hexChainCode,
    2,
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  const encryptedTerraSetup = encryptAesGcm(terraImport.setupMessage, cipherKey)
  await uploadSetupMessage(sessionId, encryptedTerraSetup, 'Terra')

  await runMpcProtocolWithMessageId(
    terraImport.sessionHandle,
    sessionId,
    localPartyId,
    cipherKey,
    'Terra',
    signal
  )

  await ExpoDkls.finishKeygen(terraImport.sessionHandle)

  report({ step: 'finalizing', message: 'Completing...', progress: 95 })

  await signalComplete(sessionId, localPartyId)
  await waitForComplete(sessionId, parties, 60, 1000, signal)

  report({ step: 'complete', message: 'Complete!', progress: 100 })

  return {
    publicKey: ecdsaResult.publicKey,
    keyshare: ecdsaResult.keyshare,
    chainCode: ecdsaResult.chainCode,
    localPartyId,
    serverPartyId,
  }
}
