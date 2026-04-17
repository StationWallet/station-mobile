import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64 } from '@scure/base'

import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'
import { buildVaultProto, derivePublicKeyHex } from 'services/vaultProto'

// This file verifies the .vult container shape + protobuf round-trip.
// encrypt/decrypt helpers below are test-scoped with a deterministic
// nonce — they mirror the production AES-GCM scheme but are NOT the
// production encryptor. Correctness of the production encrypt/decrypt
// path is covered by __tests__/vault/import-file.test.ts, which runs
// importVaultBackup against fixtures that were encrypted by production
// code (test-vault.vult, test-vault.bak).

const PK = '0000000000000000000000000000000000000000000000000000000000000001'
const EXPECTED_PUB =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

function encryptWithPassword(data: Uint8Array, password: string): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  const nonce = new Uint8Array(12).fill(7) // deterministic nonce for test
  const ciphertext = gcm(key, nonce).encrypt(data)
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce, 0)
  out.set(ciphertext, nonce.length)
  return out
}

function decryptWithPassword(
  encrypted: Uint8Array,
  password: string,
): Uint8Array {
  const nonce = encrypted.slice(0, 12)
  const ciphertext = encrypted.slice(12)
  const key = sha256(new TextEncoder().encode(password))
  return gcm(key, nonce).decrypt(ciphertext)
}

describe('vault share export — .vult round-trip', () => {
  it('derives the correct pubkey from the test private key', () => {
    expect(derivePublicKeyHex(PK)).toBe(EXPECTED_PUB)
  })

  it('builds a Vault protobuf with expected fields', () => {
    const vault = buildVaultProto('TestWallet1', EXPECTED_PUB, PK)
    expect(vault.name).toBe('TestWallet1')
    expect(vault.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(vault.libType).toBe(LibType.KEYIMPORT)
    expect(vault.keyShares.length).toBeGreaterThan(0)
    expect(vault.keyShares[0].keyshare).toBe(PK)
  })

  it('serializes + encrypts + decrypts + parses back to identical fields', () => {
    const vaultProto = buildVaultProto('TestWallet1', EXPECTED_PUB, PK)
    const vaultBytes = toBinary(VaultSchema, vaultProto)

    const encrypted = encryptWithPassword(vaultBytes, 'exportpass')
    const container = create(VaultContainerSchema, {
      version: 1n,
      isEncrypted: true,
      vault: base64.encode(encrypted),
    })
    const containerBytes = toBinary(VaultContainerSchema, container)

    const parsedContainer = fromBinary(VaultContainerSchema, containerBytes)
    expect(parsedContainer.isEncrypted).toBe(true)
    expect(parsedContainer.version).toBe(1n)

    const decryptedVault = decryptWithPassword(
      base64.decode(parsedContainer.vault),
      'exportpass',
    )
    const roundTripped = fromBinary(VaultSchema, decryptedVault)
    expect(roundTripped.name).toBe('TestWallet1')
    expect(roundTripped.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(roundTripped.libType).toBe(LibType.KEYIMPORT)
    expect(roundTripped.keyShares[0].keyshare).toBe(PK)
  })
})
