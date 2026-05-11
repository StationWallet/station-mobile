import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import { readAsStringAsync } from 'expo-file-system/legacy'

import { __reset as resetFileSystem } from '../__mocks__/expo-file-system-legacy'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'
import {
  buildVaultProto,
  derivePublicKeyHex,
} from 'services/vaultProto'
import {
  encryptWithPassword,
  decryptVaultBytes,
} from 'services/vaultCrypto'
import { storeFastVault } from 'services/migrateToVault'
import { exportVaultShare } from 'services/exportVaultShare'
import { getExportWarning } from 'utils/exportWarning'

const PK =
  '0000000000000000000000000000000000000000000000000000000000000001'
const EXPECTED_PUB =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const DETERMINISTIC_NONCE = new Uint8Array(12).fill(7)

beforeEach(() => {
  resetSecure()
  resetFileSystem()
})

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
    const vaultProto = buildVaultProto(
      'TestWallet1',
      EXPECTED_PUB,
      PK
    )
    const vaultBytes = toBinary(VaultSchema, vaultProto)

    const encrypted = encryptWithPassword(
      vaultBytes,
      'exportpass',
      DETERMINISTIC_NONCE
    )
    const container = create(VaultContainerSchema, {
      version: 1n,
      isEncrypted: true,
      vault: base64.encode(encrypted),
    })
    const containerBytes = toBinary(VaultContainerSchema, container)

    const parsedContainer = fromBinary(
      VaultContainerSchema,
      containerBytes
    )
    expect(parsedContainer.isEncrypted).toBe(true)
    expect(parsedContainer.version).toBe(1n)

    const decryptedVault = decryptVaultBytes(
      base64.decode(parsedContainer.vault),
      'exportpass'
    )
    const roundTripped = fromBinary(VaultSchema, decryptedVault)
    expect(roundTripped.name).toBe('TestWallet1')
    expect(roundTripped.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(roundTripped.libType).toBe(LibType.KEYIMPORT)
    expect(roundTripped.keyShares[0].keyshare).toBe(PK)
  })

  it('exports stored Terra KEYIMPORT MPC vaults directly without a raw private key', async () => {
    await storeFastVault('MigratedTerra', {
      publicKey: EXPECTED_PUB,
      keyshare: 'mpc-terra-share',
      chainCode: '0'.repeat(64),
      localPartyId: 'Device',
      serverPartyId: 'Server',
      terraAddress: 'terra1legacy',
    })

    const fileUri = await exportVaultShare('MigratedTerra', null)
    const containerBase64 = await readAsStringAsync(fileUri)
    const container = fromBinary(
      VaultContainerSchema,
      base64.decode(containerBase64)
    )
    const exportedVault = fromBinary(
      VaultSchema,
      base64.decode(container.vault)
    )

    expect(container.isEncrypted).toBe(false)
    expect(exportedVault.libType).toBe(LibType.KEYIMPORT)
    expect(exportedVault.publicKeyEcdsa).toBe(EXPECTED_PUB)
    expect(exportedVault.hexChainCode).toBe('')
    expect(exportedVault.keyShares[0].keyshare).toBe(
      'mpc-terra-share'
    )
    expect(
      exportedVault.chainPublicKeys.map(
        ({ chain, publicKey, isEddsa }) => ({
          chain,
          publicKey,
          isEddsa,
        })
      )
    ).toEqual([
      {
        chain: 'Terra',
        publicKey: EXPECTED_PUB,
        isEddsa: false,
      },
    ])
  })
})

describe('getExportWarning — 3-branch copy', () => {
  it('fast vault: warns that the share alone gives funds access (mirrors private-key copy)', () => {
    const w = getExportWarning('fast')
    expect(w).toContain(
      'Anyone with this key share can access your funds'
    )
    expect(w).toContain('Never share it')
  })

  it('multi-share vault: reassures that a single share cannot access the vault alone', () => {
    const w = getExportWarning('multi-share')
    expect(w).toContain('cannot access a Secure Vault by itself')
  })

  it('none (legacy private key): warns that anyone with the key has full access', () => {
    const w = getExportWarning('none')
    expect(w).toContain('Anyone with this key can access your funds')
  })

  it('loading state (null): defaults to the optimistic share-safe copy', () => {
    const w = getExportWarning(null)
    expect(w).toContain('cannot access a Secure Vault by itself')
  })
})
