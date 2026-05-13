import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'

import {
  importVaultBackup,
  type ImportVaultBackupResult,
} from 'services/importVaultBackup'
import {
  encryptWithPassword,
  WrongPasswordError,
} from 'services/vaultCrypto'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

type Decrypted = Extract<
  ImportVaultBackupResult,
  { needsPassword: false }
>
function assertDecrypted(r: ImportVaultBackupResult): Decrypted {
  if (r.needsPassword) throw new Error('expected decrypted result')
  return r as Decrypted
}

const FIXTURE_PASSWORD = 'testpassword123'
const WRONG_PASSWORD = 'wrongpassword999'

describe('importVaultBackup — .vult', () => {
  it('returns needsPassword when encrypted and no password provided', () => {
    const content = buildVaultContainer({
      password: FIXTURE_PASSWORD,
    })
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.vult',
    })
    expect(result).toEqual({ needsPassword: true })
  })

  it('decrypts and parses with the correct password', () => {
    const content = buildVaultContainer({
      password: FIXTURE_PASSWORD,
    })
    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault.vult',
        password: FIXTURE_PASSWORD,
      })
    )
    expect(result.vaultName).toBe('Import Candidate')
    expect(result.publicKeyEcdsa).toBeTruthy()
    expect(result.vaultBytes.length).toBeGreaterThan(0)
  })

  it('throws on wrong password', () => {
    const content = buildVaultContainer({
      password: FIXTURE_PASSWORD,
    })
    expect(() =>
      importVaultBackup({
        content,
        fileName: 'test-vault.vult',
        password: WRONG_PASSWORD,
      })
    ).toThrow(WrongPasswordError)
  })
})

describe('importVaultBackup — unsupported extensions', () => {
  it('rejects .bak files', () => {
    expect(() =>
      importVaultBackup({
        content: '',
        fileName: 'test-vault.bak',
      })
    ).toThrow('Unsupported file type')
  })
})

// Mirrors the export semantic so we can test imports of "no password"
// containers without spinning up expo-file-system in jest.
function buildContainerBase64(
  vaultBytes: Uint8Array,
  password: string | null
): string {
  const hasPassword =
    typeof password === 'string' && password.length > 0
  const containerVaultBytes = hasPassword
    ? encryptWithPassword(vaultBytes, password)
    : vaultBytes
  const container = create(VaultContainerSchema, {
    version: 1n,
    isEncrypted: hasPassword,
    vault: base64.encode(containerVaultBytes),
  })
  return base64.encode(toBinary(VaultContainerSchema, container))
}

function buildVaultContainer(input: {
  libType?: LibType
  signers?: string[]
  localPartyId?: string
  password?: string | null
}): string {
  const publicKey = '02fast'
  const vault = create(VaultSchema, {
    name: 'Import Candidate',
    publicKeyEcdsa: publicKey,
    publicKeyEddsa: '',
    signers: input.signers ?? ['Device-1', 'Server-1'],
    localPartyId: input.localPartyId ?? 'Device-1',
    hexChainCode: '0'.repeat(64),
    resharePrefix: '',
    libType: input.libType ?? LibType.DKLS,
    keyShares: [
      {
        publicKey,
        keyshare: 'device-share',
      },
    ],
  })
  return buildContainerBase64(
    toBinary(VaultSchema, vault),
    input.password ?? null
  )
}

describe('importVaultBackup — no-password export roundtrip', () => {
  // Recover the raw vault bytes from the encrypted fixture so we can
  // re-pack them as a plain (no-password) container.
  const decrypted = assertDecrypted(
    importVaultBackup({
      content: buildVaultContainer({
        password: FIXTURE_PASSWORD,
      }),
      fileName: 'test-vault.vult',
      password: FIXTURE_PASSWORD,
    })
  )
  const innerVaultBytes = decrypted.vaultBytes

  it('imports a no-password container without prompting', () => {
    const content = buildContainerBase64(innerVaultBytes, null)
    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
      })
    )
    expect(result.vaultName).toBe(decrypted.vaultName)
    expect(result.publicKeyEcdsa).toBe(decrypted.publicKeyEcdsa)
  })

  it('imports a password-protected container only with the password', () => {
    const customPassword = 'custompass-456'
    const content = buildContainerBase64(
      innerVaultBytes,
      customPassword
    )

    expect(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
      })
    ).toEqual({ needsPassword: true })

    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
        password: customPassword,
      })
    )
    expect(result.vaultName).toBe(decrypted.vaultName)
  })
})

describe('importVaultBackup — eligibility', () => {
  it('imports a device-side fast vault with a server signer', () => {
    const content = buildVaultContainer({
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Device-1',
    })

    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'fast-vault.vult',
      })
    )

    const restored = fromBinary(VaultSchema, result.vaultBytes)
    expect(restored.libType).toBe(LibType.DKLS)
    expect(restored.signers).toEqual(['Device-1', 'Server-1'])
  })

  it('rejects multi-share DKLS vaults with no server signer', () => {
    const content = buildVaultContainer({
      signers: ['iPhone', 'MacBook', 'iPad'],
      localPartyId: 'iPhone',
    })

    expect(() =>
      importVaultBackup({
        content,
        fileName: 'multi-share.vult',
      })
    ).toThrow(/only Fast Vaults are supported/i)
  })

  it('rejects server-side vault shares', () => {
    const content = buildVaultContainer({
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Server-1',
    })

    expect(() =>
      importVaultBackup({
        content,
        fileName: 'server-share.vult',
      })
    ).toThrow(/server-side vault share/i)
  })

  it('imports KeyImport vault files (Fast Vault topology built from a seed)', () => {
    // KeyImport vaults are Fast Vaults whose root keys were derived from a
    // seed phrase rather than generated by random keygen. They use the same
    // 2-of-2 device+server topology and the same DKLS/Schnorr signing math,
    // so they must be importable from a .vult backup the same way DKLS
    // Fast Vaults are.
    const content = buildVaultContainer({
      libType: LibType.KEYIMPORT,
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Device-1',
    })

    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'seed-key-import.vult',
      })
    )

    const restored = fromBinary(VaultSchema, result.vaultBytes)
    expect(restored.libType).toBe(LibType.KEYIMPORT)
    expect(restored.signers).toEqual(['Device-1', 'Server-1'])
  })

  it('rejects GG20 legacy vault backups', () => {
    const content = buildVaultContainer({
      libType: LibType.GG20,
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Device-1',
    })

    expect(() =>
      importVaultBackup({
        content,
        fileName: 'gg20.vult',
      })
    ).toThrow(/only Fast Vaults are supported/i)
  })
})
