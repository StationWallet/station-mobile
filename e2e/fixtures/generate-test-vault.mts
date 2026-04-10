/**
 * Generate a test .vult fixture for the import-vault E2E test.
 *
 * Creates a minimal Vault protobuf (LibType.KEYIMPORT) with a random
 * secp256k1 key pair, encrypts it with AES-256-GCM, wraps in a
 * VaultContainer, base64-encodes, and writes to test-vault.vult.
 *
 * The encryption password matches FIXTURE_PASSWORD in import-vault.test.js.
 *
 * Usage:
 *   npx tsx e2e/fixtures/generate-test-vault.mts
 */

import { create, toBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { base64, hex } from '@scure/base'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb.js'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb.js'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb.js'

// Must match FIXTURE_PASSWORD in e2e/import-vault.test.js
const FIXTURE_PASSWORD = 'testpassword123'
const VAULT_NAME = 'Test Import Vault'
const LOCAL_PARTY_ID = 'station-mobile'

// Generate a deterministic key pair for reproducibility.
// Using a fixed seed so the fixture is stable across regenerations.
const FIXED_PRIVATE_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
const privateKeyBytes = hex.decode(FIXED_PRIVATE_KEY)
const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
const publicKeyHex = hex.encode(publicKeyBytes)

console.log(`Public key (compressed): ${publicKeyHex}`)

// Build the Vault protobuf
const vault = create(VaultSchema, {
  name: VAULT_NAME,
  publicKeyEcdsa: publicKeyHex,
  publicKeyEddsa: '',
  signers: [LOCAL_PARTY_ID],
  localPartyId: LOCAL_PARTY_ID,
  hexChainCode: '',
  resharePrefix: '',
  libType: LibType.KEYIMPORT,
  keyShares: [
    {
      publicKey: publicKeyHex,
      keyshare: FIXED_PRIVATE_KEY,
    },
  ],
  chainPublicKeys: [
    {
      chain: 'Terra',
      publicKey: publicKeyHex,
      isEddsa: false,
    },
  ],
  createdAt: {
    seconds: BigInt(Math.floor(Date.now() / 1000)),
    nanos: 0,
  },
  publicKeyMldsa44: '',
})

const vaultBytes = toBinary(VaultSchema, vault)
console.log(`Vault protobuf size: ${vaultBytes.length} bytes`)

// Encrypt with AES-256-GCM (same as exportVaultShare.ts)
const key = sha256(new TextEncoder().encode(FIXTURE_PASSWORD))
const nonce = randomBytes(12)
const ciphertext = gcm(key, nonce).encrypt(vaultBytes)

// nonce (12) + ciphertext + authTag (16)
const encrypted = new Uint8Array(nonce.length + ciphertext.length)
encrypted.set(nonce, 0)
encrypted.set(ciphertext, nonce.length)

console.log(`Encrypted size: ${encrypted.length} bytes (12 nonce + ${ciphertext.length} ct+tag)`)

// Wrap in VaultContainer
const container = create(VaultContainerSchema, {
  version: 1n,
  isEncrypted: true,
  vault: base64.encode(encrypted),
})

const containerBytes = toBinary(VaultContainerSchema, container)
const containerBase64 = base64.encode(containerBytes)

console.log(`VaultContainer protobuf size: ${containerBytes.length} bytes`)
console.log(`Final base64 size: ${containerBase64.length} chars`)

// Write the fixture file
const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(__dirname, 'test-vault.vult')
writeFileSync(outputPath, containerBase64, 'utf8')

console.log(`\nFixture written to: ${outputPath}`)
console.log(`Password: ${FIXTURE_PASSWORD}`)
console.log(`Vault name: ${VAULT_NAME}`)
console.log(`Public key ECDSA: ${publicKeyHex}`)
