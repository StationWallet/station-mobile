import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'
import type {
  KeyImportResult,
  KeyImportProgress,
} from './dklsKeyImport'

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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
    await sleep(50)
  }

  // Deterministic synthetic result so downstream code treats it like a
  // real DKLS vault share. keyshare is opaque base64 — any non-empty string
  // passes downstream validation.
  const pubBytes = secp256k1.getPublicKey(
    hex.decode(privateKeyHex),
    true
  )
  return {
    publicKey: hex.encode(pubBytes),
    keyshare: 'c3R1YmJlZC1rZXlzaGFyZS1ieXRlcw==', // "stubbed-keyshare-bytes"
    chainCode: '0'.repeat(64),
    localPartyId: 'sdk-stub0',
    serverPartyId: 'Server-stub',
  }
}
