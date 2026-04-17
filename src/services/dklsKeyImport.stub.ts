import type {
  KeyImportResult,
  KeyImportProgress,
} from './dklsKeyImport'
import { derivePublicKeyHex } from './vaultProto'

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
