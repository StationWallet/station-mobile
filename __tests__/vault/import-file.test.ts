import * as fs from 'fs'
import * as path from 'path'

import {
  importVaultBackup,
  type ImportVaultBackupResult,
} from 'services/importVaultBackup'

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
