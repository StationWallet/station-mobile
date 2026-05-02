import * as fs from 'fs'
import * as path from 'path'

import { create, toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'

import {
  importVaultBackup,
  type ImportVaultBackupResult,
} from 'services/importVaultBackup'
import { encryptWithPassword } from 'services/vaultCrypto'
import { VaultContainerSchema } from '../../src/proto/vultisig/vault/v1/vault_container_pb'

type Decrypted = Extract<ImportVaultBackupResult, { needsPassword: false }>
function assertDecrypted(r: ImportVaultBackupResult): Decrypted {
  if (r.needsPassword) throw new Error('expected decrypted result')
  return r as Decrypted
}

const FIXTURE_PASSWORD = 'testpassword123'
const WRONG_PASSWORD = 'wrongpassword999'

const vultPath = path.resolve(
  __dirname,
  '..',
  '..',
  'e2e',
  'fixtures',
  'test-vault.vult',
)
const bakPath = path.resolve(
  __dirname,
  '..',
  '..',
  'e2e',
  'fixtures',
  'test-vault.bak',
)

function readFixture(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

describe('importVaultBackup — .vult', () => {
  it('returns needsPassword when encrypted and no password provided', () => {
    const content = readFixture(vultPath)
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.vult',
    })
    expect(result).toEqual({ needsPassword: true })
  })

  it('decrypts and parses with the correct password', () => {
    const content = readFixture(vultPath)
    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault.vult',
        password: FIXTURE_PASSWORD,
      }),
    )
    expect(result.vaultName).toBe('Test Import Vault')
    expect(result.publicKeyEcdsa).toBeTruthy()
    expect(result.vaultBytes.length).toBeGreaterThan(0)
  })

  it('throws on wrong password', () => {
    const content = readFixture(vultPath)
    expect(() =>
      importVaultBackup({
        content,
        fileName: 'test-vault.vult',
        password: WRONG_PASSWORD,
      }),
    ).toThrow()
  })
})

describe('importVaultBackup — .bak', () => {
  it('decrypts and parses .bak files the same as .vult', () => {
    const content = readFixture(bakPath)
    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault.bak',
        password: FIXTURE_PASSWORD,
      }),
    )
    expect(result.vaultName).toBeTruthy()
    expect(result.publicKeyEcdsa).toBeTruthy()
  })
})

// Mirrors the export semantic so we can test imports of "no password"
// containers without spinning up expo-file-system in jest.
function buildContainerBase64(
  vaultBytes: Uint8Array,
  password: string | null,
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

describe('importVaultBackup — no-password export roundtrip', () => {
  // Recover the raw vault bytes from the encrypted fixture so we can
  // re-pack them as a plain (no-password) container.
  const decrypted = assertDecrypted(
    importVaultBackup({
      content: readFixture(vultPath),
      fileName: 'test-vault.vult',
      password: FIXTURE_PASSWORD,
    }),
  )
  const innerVaultBytes = decrypted.vaultBytes

  it('imports a no-password container without prompting', () => {
    const content = buildContainerBase64(innerVaultBytes, null)
    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
      }),
    )
    expect(result.vaultName).toBe(decrypted.vaultName)
    expect(result.publicKeyEcdsa).toBe(decrypted.publicKeyEcdsa)
  })

  it('imports a password-protected container only with the password', () => {
    const customPassword = 'custompass-456'
    const content = buildContainerBase64(innerVaultBytes, customPassword)

    expect(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
      }),
    ).toEqual({ needsPassword: true })

    const result = assertDecrypted(
      importVaultBackup({
        content,
        fileName: 'test-vault-station-mobile.vult',
        password: customPassword,
      }),
    )
    expect(result.vaultName).toBe(decrypted.vaultName)
  })
})
