import type {
  CreatedFastVaultResult,
  ImportedSeedFastVaultResult,
  KeyImportResult,
  KeyImportProgress,
} from './dklsKeyImport'
import { derivePublicKeyHex } from './vaultProto'
import {
  deriveChainKeyForImport,
  deriveMasterKeys,
  SEED_IMPORT_DERIVATION_GROUPS,
} from './seedPhraseImport'

export async function createFastVault(options: {
  name: string
  email: string
  password: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<CreatedFastVaultResult> {
  const { onProgress, signal } = options

  const steps: KeyImportProgress[] = [
    { step: 'setup', message: 'Generating session...', progress: 10 },
    { step: 'joining', message: 'Joining relay...', progress: 25 },
    {
      step: 'ecdsa',
      message: 'Running ECDSA MPC protocol...',
      progress: 50,
    },
    {
      step: 'eddsa',
      message: 'Running EdDSA MPC protocol...',
      progress: 75,
    },
    { step: 'complete', message: 'Complete!', progress: 100 },
  ]
  for (const s of steps) {
    if (signal?.aborted) throw new Error('Aborted')
    onProgress?.(s)
    await Promise.resolve()
  }

  return {
    publicKey:
      '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    publicKeyEcdsa:
      '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    publicKeyEddsa:
      '3b6a27bcceb6a42d62a3a8d02a6f0d736f85ee7d74c87866438df8b9882c4b20',
    keyshareEcdsa: 'c3R1Yi1lY2RzYS1rZXlzaGFyZQ==',
    keyshareEddsa: 'c3R1Yi1lZGRzYS1rZXlzaGFyZQ==',
    chainCode:
      '7923408dadd3c7b56eed15567707ae5e5dca089de972e07f3b860450e2a3b70e',
    localPartyId: 'sdk-stub0',
    serverPartyId: 'Server-stub',
  }
}

export async function importKeyToFastVault(options: {
  name: string
  email: string
  password: string
  privateKeyHex: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<KeyImportResult> {
  const { privateKeyHex, onProgress, signal } = options

  const steps: KeyImportProgress[] = [
    { step: 'setup', message: 'Generating session...', progress: 10 },
    { step: 'joining', message: 'Joining relay...', progress: 30 },
    {
      step: 'ecdsa',
      message: 'Running MPC protocol...',
      progress: 60,
    },
    {
      step: 'finalizing',
      message: 'Extracting keyshare...',
      progress: 90,
    },
    { step: 'complete', message: 'Complete!', progress: 100 },
  ]
  for (const s of steps) {
    if (signal?.aborted) throw new Error('Aborted')
    onProgress?.(s)
    // Yield to the microtask queue so consumers observe each step in order.
    await Promise.resolve()
  }

  return {
    publicKey: derivePublicKeyHex(privateKeyHex),
    // Opaque base64 — any non-empty string passes downstream validation.
    keyshare: 'c3R1YmJlZC1rZXlzaGFyZS1ieXRlcw==',
    chainCode: '0'.repeat(64),
    localPartyId: 'sdk-stub0',
    serverPartyId: 'Server-stub',
  }
}

export async function importSeedPhraseToFastVault(options: {
  name: string
  email: string
  password: string
  mnemonic: string
  onProgress?: (p: KeyImportProgress) => void
  signal?: AbortSignal
}): Promise<ImportedSeedFastVaultResult> {
  const { mnemonic, onProgress, signal } = options
  const steps: KeyImportProgress[] = [
    { step: 'setup', message: 'Generating session...', progress: 10 },
    {
      step: 'ecdsa',
      message: 'Importing ECDSA keys...',
      progress: 45,
    },
    {
      step: 'eddsa',
      message: 'Importing EdDSA keys...',
      progress: 80,
    },
    { step: 'complete', message: 'Complete!', progress: 100 },
  ]
  for (const s of steps) {
    if (signal?.aborted) throw new Error('Aborted')
    onProgress?.(s)
    await Promise.resolve()
  }

  const master = deriveMasterKeys(mnemonic)
  const importedChains = await Promise.all(
    SEED_IMPORT_DERIVATION_GROUPS.map(async (group) => {
      const chainKey = await deriveChainKeyForImport(
        mnemonic,
        group.representativeChain
      )
      const publicKey = chainKey.isEddsa
        ? `ed-${group.representativeChain}`
        : derivePublicKeyHex(chainKey.privateKey)

      return {
        chain: group.representativeChain,
        publicKey,
        keyshare: `stub-${group.representativeChain}-share`,
        isEddsa: chainKey.isEddsa,
      }
    })
  )

  return {
    publicKey: derivePublicKeyHex(master.ecdsaPrivateKey),
    publicKeyEcdsa: derivePublicKeyHex(master.ecdsaPrivateKey),
    publicKeyEddsa:
      '3b6a27bcceb6a42d62a3a8d02a6f0d736f85ee7d74c87866438df8b9882c4b20',
    keyshareEcdsa: 'c3R1Yi1zZWVkLXJvb3QtZWNkc2E=',
    keyshareEddsa: 'c3R1Yi1zZWVkLXJvb3QtZWRkc2E=',
    chainCode: master.ecdsaChainCode,
    localPartyId: 'sdk-stub0',
    serverPartyId: 'Server-stub',
    importedChains,
  }
}
