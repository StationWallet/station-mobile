import * as fs from 'node:fs'
import * as path from 'node:path'

import { importVaultBackup } from '../../src/services/importVaultBackup'

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
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.vult',
      password: FIXTURE_PASSWORD,
    })
    expect(result.needsPassword).toBe(false)
    if (result.needsPassword) throw new Error('unreachable')
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
    const result = importVaultBackup({
      content,
      fileName: 'test-vault.bak',
      password: FIXTURE_PASSWORD,
    })
    expect(result.needsPassword).toBe(false)
    if (result.needsPassword) throw new Error('unreachable')
    expect(result.vaultName).toBeTruthy()
    expect(result.publicKeyEcdsa).toBeTruthy()
  })
})
