import { ExpoMpcNative as ExpoDkls } from '@vultisig/mpc-native'
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
import {
  setupBatchImport,
  setupBatchKeygen,
  setupKeyImport,
} from './fastVaultServer'
import {
  encryptAesGcm,
  decryptAesGcm,
  deriveCipherKey,
  md5HashAsync,
  randomHex,
  randomUUID,
  sleep,
} from '../utils/mpcCrypto'
import { STUB_VULTISERVER } from '../config/env'
import * as stubDkls from './dklsKeyImport.stub'
import {
  deriveChainPublicKeyForImport,
  deriveChainKey,
  deriveChainKeyForImport,
  deriveMasterKeys,
  SEED_IMPORT_DERIVATION_GROUPS,
  SeedImportChain,
} from './seedPhraseImport'

export type KeyImportStep =
  | 'setup'
  | 'joining'
  | 'waiting'
  | 'ecdsa'
  | 'eddsa'
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

export type CreatedFastVaultResult = {
  publicKey: string
  publicKeyEcdsa: string
  publicKeyEddsa: string
  keyshareEcdsa: string
  keyshareEddsa: string
  chainCode: string
  localPartyId: string
  serverPartyId: string
}

export type ImportedSeedChainResult = {
  chain: SeedImportChain
  publicKey: string
  keyshare: string
  isEddsa: boolean
}

export type ImportedSeedFastVaultResult = CreatedFastVaultResult & {
  importedChains: ImportedSeedChainResult[]
}

type NativeKeygenResult = {
  publicKey: string
  keyshare: string
  chainCode: string
}

type MpcKeyType = 'ecdsa' | 'eddsa'

/**
 * Run the DKLS MPC message exchange loop with a messageId for relay routing.
 * The batch endpoint uses "p-ecdsa" as the messageId for the ECDSA protocol.
 */
async function runMpcProtocol(
  sessionHandle: number,
  sessionId: string,
  localPartyId: string,
  cipherKey: Uint8Array,
  keyType: MpcKeyType,
  messageId: string | undefined,
  onProgress?: (progressPercent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  let isComplete = false
  let sequenceNo = 0
  const processedMessages = new Set<string>()
  const startTime = Date.now()
  const TIMEOUT_MS = 120_000
  let lastProgressTime = startTime

  const processOutbound = async (): Promise<void> => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const outMsg =
          keyType === 'ecdsa'
            ? ExpoDkls.keygenSessionOutputMessage(sessionHandle)
            : ExpoDkls.schnorrKeygenSessionOutputMessage(
                sessionHandle
              )
        if (!outMsg) {
          await sleep(100)
          continue
        }

        const encrypted = encryptAesGcm(outMsg, cipherKey)
        const hash = await md5HashAsync(outMsg)

        let idx = 0
        while (true) {
          const receiver =
            keyType === 'ecdsa'
              ? ExpoDkls.keygenSessionMessageReceiver(
                  sessionHandle,
                  outMsg,
                  idx
                )
              : ExpoDkls.schnorrKeygenSessionMessageReceiver(
                  sessionHandle,
                  outMsg,
                  idx
                )
          if (!receiver) break
          await sendRelayMessage(
            sessionId,
            localPartyId,
            receiver,
            encrypted,
            hash,
            sequenceNo++,
            messageId
          )
          idx++
        }
        await sleep(100)
      } catch (err) {
        if (signal?.aborted) throw err
        // eslint-disable-next-line no-console -- MPC protocol diagnostics
        console.warn(
          '[MPC] Outbound error:',
          err instanceof Error ? err.message : err
        )
        await sleep(200)
      }
    }
  }

  const processInbound = async (): Promise<void> => {
    while (!isComplete && Date.now() - startTime < TIMEOUT_MS) {
      if (signal?.aborted) throw new Error('Aborted')
      try {
        const messages = await getRelayMessages(
          sessionId,
          localPartyId,
          messageId
        )
        if (messages.length === 0) {
          await sleep(100)
          continue
        }

        for (const msg of messages) {
          const cacheKey = `${msg.from}-${msg.hash}`
          if (processedMessages.has(cacheKey)) continue

          const decrypted = decryptAesGcm(msg.body, cipherKey)
          const finished =
            keyType === 'ecdsa'
              ? ExpoDkls.keygenSessionInputMessage(
                  sessionHandle,
                  decrypted
                )
              : ExpoDkls.schnorrKeygenSessionInputMessage(
                  sessionHandle,
                  decrypted
                )
          processedMessages.add(cacheKey)
          await deleteRelayMessage(
            sessionId,
            localPartyId,
            msg.hash,
            messageId
          ).catch(() => {})

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
        // eslint-disable-next-line no-console -- MPC protocol diagnostics
        console.warn(
          '[MPC] Inbound error:',
          err instanceof Error ? err.message : err
        )
        await sleep(200)
      }
    }
  }

  await Promise.all([processOutbound(), processInbound()])
  if (!isComplete) throw new Error('MPC protocol did not complete')
  onProgress?.(1.0)
}

function serverPartyIdFromSession(sessionId: string): string {
  let serverHash = 0
  for (let i = 0; i < sessionId.length; i++) {
    serverHash =
      (serverHash << 5) - serverHash + sessionId.charCodeAt(i)
    serverHash = serverHash & serverHash
  }
  return `Server-${Math.abs(serverHash).toString().slice(-5)}`
}

async function finishNativeKeygen(
  keyType: MpcKeyType,
  sessionHandle: number
): Promise<NativeKeygenResult> {
  return keyType === 'ecdsa'
    ? ExpoDkls.finishKeygen(sessionHandle)
    : ExpoDkls.finishSchnorrKeygen(sessionHandle)
}

function freeNativeKeygen(
  keyType: MpcKeyType,
  sessionHandle: number
): void {
  if (keyType === 'ecdsa') {
    ExpoDkls.freeKeygenSession(sessionHandle)
  } else {
    ExpoDkls.freeSchnorrKeygenSession(sessionHandle)
  }
}

async function prepareKeyImportSession(options: {
  privateKeyHex: string
  chainCodeHex: string
  keyType: MpcKeyType
  parties: string[]
  sessionId: string
  cipherKey: Uint8Array
  setupMessageId?: string
}): Promise<number> {
  const {
    privateKeyHex,
    chainCodeHex,
    keyType,
    parties,
    sessionId,
    cipherKey,
    setupMessageId,
  } = options
  const importResult =
    keyType === 'ecdsa'
      ? (ExpoDkls.createDklsKeyImportInitiator(
          privateKeyHex,
          chainCodeHex,
          2,
          parties
        ) as { setupMessage: string; sessionHandle: number })
      : (ExpoDkls.createSchnorrKeyImportInitiator(
          privateKeyHex,
          chainCodeHex,
          2,
          parties
        ) as { setupMessage: string; sessionHandle: number })

  await uploadSetupMessage(
    sessionId,
    encryptAesGcm(importResult.setupMessage, cipherKey),
    setupMessageId
  )

  return importResult.sessionHandle
}

async function runPreparedImport(options: {
  sessionHandle: number
  sessionId: string
  localPartyId: string
  cipherKey: Uint8Array
  keyType: MpcKeyType
  messageId?: string
  signal?: AbortSignal
  onProgress?: (progressPercent: number) => void
}): Promise<NativeKeygenResult> {
  const {
    sessionHandle,
    sessionId,
    localPartyId,
    cipherKey,
    keyType,
    messageId,
    signal,
    onProgress,
  } = options

  try {
    await runMpcProtocol(
      sessionHandle,
      sessionId,
      localPartyId,
      cipherKey,
      keyType,
      messageId,
      onProgress,
      signal
    )
    return finishNativeKeygen(keyType, sessionHandle)
  } finally {
    try {
      freeNativeKeygen(keyType, sessionHandle)
    } catch {}
  }
}

/**
 * Create a real Vultisig-style DKLS fast vault.
 *
 * Created vaults use root ECDSA + root EdDSA + a real chain code. They do not
 * store per-chain child keys; other Vultisig wallets derive those addresses
 * from the root keys exactly like any vault created in Vultisig iOS/Android.
 */
export async function createFastVault(options: {
  name: string
  email: string
  password: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<CreatedFastVaultResult> {
  const { name, email, password, onProgress, signal } = options

  if (STUB_VULTISERVER) return stubDkls.createFastVault(options)

  const report = (p: KeyImportProgress): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[Keygen] ${p.step}: ${p.message} (${p.progress}%)`)
    }
    onProgress?.(p)
  }

  report({
    step: 'setup',
    message: 'Generating session...',
    progress: 5,
  })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const hexChainCode = randomHex(32)
  const localPartyId = `sdk-${randomHex(4)}`
  let serverPartyId = serverPartyIdFromSession(sessionId)

  report({
    step: 'setup',
    message: 'Setting up vault...',
    progress: 12,
  })

  await Promise.all([
    setupBatchKeygen({
      name,
      session_id: sessionId,
      hex_encryption_key: hexEncryptionKey,
      hex_chain_code: hexChainCode,
      local_party_id: serverPartyId,
      encryption_password: password,
      email,
      lib_type: 1,
      protocols: ['ecdsa', 'eddsa'],
    }),
    joinRelaySession(sessionId, localPartyId),
  ])

  report({
    step: 'waiting',
    message: 'Waiting for server...',
    progress: 20,
  })

  const parties = await waitForParties(sessionId, 2, 120_000, signal)
  const actualServerPartyId = parties.find((p) => p !== localPartyId)
  if (!actualServerPartyId)
    throw new Error('Could not identify server party from relay')
  serverPartyId = actualServerPartyId

  await startRelaySession(sessionId, parties)

  const cipherKey = deriveCipherKey(hexEncryptionKey)
  const setupMessage = ExpoDkls.dklsKeygenSetup(2, null, parties)
  await uploadSetupMessage(
    sessionId,
    encryptAesGcm(setupMessage, cipherKey)
  )

  report({
    step: 'ecdsa',
    message: 'Running MPC protocols...',
    progress: 35,
  })

  const ecdsaHandle = await ExpoDkls.createKeygenSession(
    setupMessage,
    localPartyId
  )
  const eddsaHandle = await ExpoDkls.createSchnorrKeygenSession(
    setupMessage,
    localPartyId
  )

  try {
    await Promise.all([
      runMpcProtocol(
        ecdsaHandle,
        sessionId,
        localPartyId,
        cipherKey,
        'ecdsa',
        'p-ecdsa',
        (mpcProgress) => {
          report({
            step: 'ecdsa',
            message: 'Running ECDSA MPC protocol...',
            progress: Math.round(35 + mpcProgress * 30),
          })
        },
        signal
      ),
      runMpcProtocol(
        eddsaHandle,
        sessionId,
        localPartyId,
        cipherKey,
        'eddsa',
        'p-eddsa',
        (mpcProgress) => {
          report({
            step: 'eddsa',
            message: 'Running EdDSA MPC protocol...',
            progress: Math.round(35 + mpcProgress * 30),
          })
        },
        signal
      ),
    ])

    report({
      step: 'finalizing',
      message: 'Extracting keyshares...',
      progress: 82,
    })

    const [ecdsaResult, eddsaResult] = await Promise.all([
      finishNativeKeygen('ecdsa', ecdsaHandle),
      finishNativeKeygen('eddsa', eddsaHandle),
    ])

    await signalComplete(sessionId, localPartyId)
    await waitForComplete(sessionId, parties, 60, 1000, signal)

    report({ step: 'complete', message: 'Complete!', progress: 100 })

    return {
      publicKey: ecdsaResult.publicKey,
      publicKeyEcdsa: ecdsaResult.publicKey,
      publicKeyEddsa: eddsaResult.publicKey,
      keyshareEcdsa: ecdsaResult.keyshare,
      keyshareEddsa: eddsaResult.keyshare,
      chainCode: ecdsaResult.chainCode || hexChainCode,
      localPartyId,
      serverPartyId,
    }
  } finally {
    try {
      freeNativeKeygen('ecdsa', ecdsaHandle)
    } catch {}
    try {
      freeNativeKeygen('eddsa', eddsaHandle)
    } catch {}
  }
}

/**
 * Import a BIP39 seed phrase using Vultisig's KeyImport shape.
 *
 * The root keys identify the vault. Chain-specific keys are imported for every
 * representative derivation path Station currently needs to be portable across
 * Vultisig wallets, including Terra's hardened 330 path.
 */
export async function importSeedPhraseToFastVault(options: {
  name: string
  email: string
  password: string
  mnemonic: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<ImportedSeedFastVaultResult> {
  const { name, email, password, mnemonic, onProgress, signal } =
    options

  if (STUB_VULTISERVER)
    return stubDkls.importSeedPhraseToFastVault(options)

  const masterKeys = deriveMasterKeys(mnemonic)
  const report = (p: KeyImportProgress): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        `[SeedImport] ${p.step}: ${p.message} (${p.progress}%)`
      )
    }
    onProgress?.(p)
  }

  report({
    step: 'setup',
    message: 'Generating session...',
    progress: 5,
  })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const importChainCode = masterKeys.ecdsaChainCode
  const localPartyId = `sdk-${randomHex(4)}`
  let serverPartyId = serverPartyIdFromSession(sessionId)

  await Promise.all([
    setupKeyImport({
      name,
      session_id: sessionId,
      hex_encryption_key: hexEncryptionKey,
      hex_chain_code: importChainCode,
      local_party_id: serverPartyId,
      encryption_password: password,
      email,
      lib_type: 2,
      chains: ['Terra'],
    }),
    joinRelaySession(sessionId, localPartyId),
  ])

  report({
    step: 'waiting',
    message: 'Waiting for server...',
    progress: 15,
  })

  const parties = await waitForParties(sessionId, 2, 120_000, signal)
  const actualServerPartyId = parties.find((p) => p !== localPartyId)
  if (!actualServerPartyId)
    throw new Error('Could not identify server party from relay')
  serverPartyId = actualServerPartyId

  await startRelaySession(sessionId, parties)

  const cipherKey = deriveCipherKey(hexEncryptionKey)

  report({
    step: 'setup',
    message: 'Preparing key imports...',
    progress: 20,
  })

  const rootEcdsaHandle = await prepareKeyImportSession({
    privateKeyHex: masterKeys.ecdsaPrivateKey,
    chainCodeHex: importChainCode,
    keyType: 'ecdsa',
    parties,
    sessionId,
    cipherKey,
  })
  const rootEddsaHandle = await prepareKeyImportSession({
    privateKeyHex: masterKeys.eddsaPrivateKey,
    chainCodeHex: importChainCode,
    keyType: 'eddsa',
    parties,
    sessionId,
    cipherKey,
    setupMessageId: 'eddsa_key_import',
  })
  const terraKey = await deriveChainKeyForImport(mnemonic, 'Terra')
  const terraChainCode = deriveChainKey(mnemonic, 'Terra').chainCode
  const terraHandle = await prepareKeyImportSession({
    privateKeyHex: terraKey.privateKey,
    chainCodeHex: terraChainCode,
    keyType: 'ecdsa',
    parties,
    sessionId,
    cipherKey,
    setupMessageId: 'Terra',
  })

  const runRootEcdsa = async (): Promise<NativeKeygenResult> => {
    report({
      step: 'ecdsa',
      message: 'Importing ECDSA root key...',
      progress: 30,
    })
    return runPreparedImport({
      sessionHandle: rootEcdsaHandle,
      sessionId,
      localPartyId,
      cipherKey,
      keyType: 'ecdsa',
      signal,
      onProgress: (mpcProgress) => {
        report({
          step: 'ecdsa',
          message: 'Importing ECDSA root key...',
          progress: Math.round(30 + mpcProgress * 20),
        })
      },
    })
  }

  const runRootEddsa = async (): Promise<NativeKeygenResult> => {
    report({
      step: 'eddsa',
      message: 'Importing EdDSA root key...',
      progress: 30,
    })
    try {
      return await runPreparedImport({
        sessionHandle: rootEddsaHandle,
        sessionId,
        localPartyId,
        cipherKey,
        keyType: 'eddsa',
        signal,
        onProgress: (mpcProgress) => {
          report({
            step: 'eddsa',
            message: 'Importing EdDSA root key...',
            progress: Math.round(30 + mpcProgress * 20),
          })
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      throw new Error(`root eddsa import failed: ${message}`)
    }
  }

  const runRootEcdsaWrapped =
    async (): Promise<NativeKeygenResult> => {
      try {
        return await runRootEcdsa()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        throw new Error(`root ecdsa import failed: ${message}`)
      }
    }

  const rootEcdsa = await runRootEcdsaWrapped()
  const rootEddsa = await runRootEddsa()
  const terraResult = await runPreparedImport({
    sessionHandle: terraHandle,
    sessionId,
    localPartyId,
    cipherKey,
    keyType: 'ecdsa',
    signal,
    onProgress: (mpcProgress) => {
      report({
        step: 'ecdsa',
        message: 'Importing Terra key...',
        progress: Math.round(55 + mpcProgress * 30),
      })
    },
  })

  const chainPublicKeys = (
    await Promise.all(
      SEED_IMPORT_DERIVATION_GROUPS.map(
        async (group): Promise<ImportedSeedChainResult[]> => {
          const publicKey = await deriveChainPublicKeyForImport(
            mnemonic,
            group.representativeChain
          )
          return group.chains.map((chain) => ({
            chain,
            publicKey,
            keyshare:
              chain === 'Terra' || chain === 'TerraClassic'
                ? terraResult.keyshare
                : '',
            isEddsa: group.isEddsa,
          }))
        }
      )
    )
  ).flat()

  report({
    step: 'finalizing',
    message: 'Finalizing vault...',
    progress: 92,
  })

  await signalComplete(sessionId, localPartyId)
  await waitForComplete(sessionId, parties, 60, 1000, signal)

  report({ step: 'complete', message: 'Complete!', progress: 100 })

  return {
    publicKey: rootEcdsa.publicKey,
    publicKeyEcdsa: rootEcdsa.publicKey,
    publicKeyEddsa: rootEddsa.publicKey,
    keyshareEcdsa: rootEcdsa.keyshare,
    keyshareEddsa: rootEddsa.keyshare,
    chainCode: rootEcdsa.chainCode || importChainCode,
    localPartyId,
    serverPartyId,
    importedChains: chainPublicKeys,
  }
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
  const { name, email, password, privateKeyHex, onProgress, signal } =
    options

  if (STUB_VULTISERVER) return stubDkls.importKeyToFastVault(options)

  const report = (p: KeyImportProgress): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        `[KeyImport] ${p.step}: ${p.message} (${p.progress}%)`
      )
    }
    onProgress?.(p)
  }

  report({
    step: 'setup',
    message: 'Generating session...',
    progress: 5,
  })

  const sessionId = randomUUID()
  const hexEncryptionKey = randomHex(32)
  const localPartyId = `sdk-${randomHex(4)}`
  const hexChainCode = '0'.repeat(64)

  let serverHash = 0
  for (let i = 0; i < sessionId.length; i++) {
    serverHash =
      (serverHash << 5) - serverHash + sessionId.charCodeAt(i)
    serverHash = serverHash & serverHash
  }
  let serverPartyId = `Server-${Math.abs(serverHash)
    .toString()
    .slice(-5)}`

  report({
    step: 'setup',
    message: 'Setting up vault...',
    progress: 12,
  })

  await Promise.all([
    setupBatchImport({
      name,
      session_id: sessionId,
      hex_encryption_key: hexEncryptionKey,
      local_party_id: serverPartyId,
      encryption_password: password,
      email,
      lib_type: 2,
      protocols: ['ecdsa'],
    }),
    joinRelaySession(sessionId, localPartyId),
  ])

  report({
    step: 'joining',
    message: 'Joining relay...',
    progress: 20,
  })
  report({
    step: 'waiting',
    message: 'Waiting for server...',
    progress: 28,
  })
  const parties = await waitForParties(sessionId, 2, 120_000, signal)

  // Validate that the server joined with the expected party ID
  const actualServerPartyId = parties.find((p) => p !== localPartyId)
  if (!actualServerPartyId)
    throw new Error('Could not identify server party from relay')
  if (actualServerPartyId !== serverPartyId) {
    // eslint-disable-next-line no-console -- useful diagnostic for server party mismatch
    console.warn(
      `[KeyImport] Server party ID mismatch: expected ${serverPartyId}, got ${actualServerPartyId}`
    )
    serverPartyId = actualServerPartyId
  }

  await startRelaySession(sessionId, parties)

  report({ step: 'ecdsa', message: 'Importing key...', progress: 35 })

  const importResult = ExpoDkls.createDklsKeyImportInitiator(
    privateKeyHex,
    hexChainCode,
    2,
    [localPartyId, serverPartyId]
  ) as { setupMessage: string; sessionHandle: number }

  const sessionHandle = importResult.sessionHandle

  try {
    const cipherKey = deriveCipherKey(hexEncryptionKey)

    // Batch endpoint uses setupKey="" for ecdsa — upload to default setup-message endpoint (no messageId)
    const encryptedSetup = encryptAesGcm(
      importResult.setupMessage,
      cipherKey
    )
    await uploadSetupMessage(sessionId, encryptedSetup)

    report({
      step: 'ecdsa',
      message: 'Running MPC protocol...',
      progress: 48,
    })

    // Batch endpoint uses messageId "p-ecdsa" for the ECDSA protocol
    await runMpcProtocol(
      sessionHandle,
      sessionId,
      localPartyId,
      cipherKey,
      'ecdsa',
      'p-ecdsa',
      (mpcProgress) => {
        const stepProgress = 48 + mpcProgress * 38
        report({
          step: 'ecdsa',
          message: 'Running MPC protocol...',
          progress: Math.round(stepProgress),
        })
      },
      signal
    )

    report({
      step: 'finalizing',
      message: 'Extracting keyshare...',
      progress: 86,
    })

    const result = await ExpoDkls.finishKeygen(sessionHandle)

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
  } finally {
    // Always free the native session handle to prevent memory leaks
    // and clear private key material from native memory
    try {
      ExpoDkls.freeKeygenSession(sessionHandle)
    } catch {}
  }
}
