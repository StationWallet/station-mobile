import { encrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import { __reset as resetSecure } from '../__mocks__/expo-secure-store'

const PK =
  '0000000000000000000000000000000000000000000000000000000000000001'

function buildSizeTestData(count: number): string {
  const wallets: Record<string, unknown> = {}
  for (let i = 0; i < count; i++) {
    wallets[`SizeTestWallet${i}`] = {
      ledger: false,
      address: `terra1sizetest${String(i).padStart(3, '0')}`,
      password: `sizeTestPass${i}`,
      encryptedKey: encrypt(PK, `sizeTestPass${i}`),
    }
  }
  return JSON.stringify(wallets)
}

beforeEach(() => {
  resetSecure()
})

describe('keystore 10-wallet size stress', () => {
  it('10-wallet payload exceeds historical 2KB limit', () => {
    const json = buildSizeTestData(10)
    const bytes = new TextEncoder().encode(json).length
    expect(bytes).toBeGreaterThan(2048)
  })

  it('writes and reads back the full payload byte-for-byte', async () => {
    const json = buildSizeTestData(10)
    const written = await keystore.write(KeystoreEnum.AuthData, json)
    expect(written).toBe(true)
    expect(await keystore.read(KeystoreEnum.AuthData)).toBe(json)
  })
})
