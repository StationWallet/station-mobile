import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { upsertAuthData } from 'utils/authData'
import { discoverLegacyWallets } from 'services/migrateToVault'
import { setCachedSpaWallets } from 'services/spaWalletCache'

beforeEach(() => {
  resetSecure()
})

describe('discoverLegacyWallets filter', () => {
  it('returns wallets that still have an encryptedKey', async () => {
    await upsertAuthData({
      authData: {
        UnmigratedWallet: {
          ledger: false,
          address: 'terra1abc',
          encryptedKey: 'someEncryptedKeyData',
          password: 'pwd',
        },
      },
    })
    const found = await discoverLegacyWallets()
    expect(found.map((w) => w.name)).toContain('UnmigratedWallet')
  })

  it('filters out entries with empty encryptedKey (already-migrated stub)', async () => {
    await upsertAuthData({
      authData: {
        MigratedStub: {
          ledger: false,
          address: 'terra1xyz',
          encryptedKey: '', // zeroed by storeFastVault / persistImportedVault
          password: '',
          terraOnly: true,
        },
      },
    })
    const found = await discoverLegacyWallets()
    expect(found.map((w) => w.name)).not.toContain('MigratedStub')
  })

  it('always returns ledger wallets (no encryptedKey to check)', async () => {
    await upsertAuthData({
      authData: {
        MyLedger: {
          ledger: true,
          address: 'terra1ledger',
          path: 0,
        },
      },
    })
    const found = await discoverLegacyWallets()
    expect(found.map((w) => w.name)).toContain('MyLedger')
    expect(found.find((w) => w.name === 'MyLedger')?.ledger).toBe(true)
  })

  it('returns only unmigrated entries when mixed state', async () => {
    await upsertAuthData({
      authData: {
        Migrated: {
          ledger: false,
          address: 'terra1m',
          encryptedKey: '',
          password: '',
          terraOnly: true,
        },
        Unmigrated: {
          ledger: false,
          address: 'terra1u',
          encryptedKey: 'encryptedKeyMaterial',
          password: 'pwd',
        },
        LedgerWallet: {
          ledger: true,
          address: 'terra1l',
          path: 1,
        },
      },
    })
    const found = await discoverLegacyWallets()
    const names = found.map((w) => w.name)
    expect(names).not.toContain('Migrated')
    expect(names).toContain('Unmigrated')
    expect(names).toContain('LedgerWallet')
    expect(found).toHaveLength(2)
  })

  it('returns empty array when all entries are migrated stubs', async () => {
    await upsertAuthData({
      authData: {
        Stub1: {
          ledger: false,
          address: 'terra1s1',
          encryptedKey: '',
          password: '',
          terraOnly: true,
        },
        Stub2: {
          ledger: false,
          address: 'terra1s2',
          encryptedKey: '',
          password: '',
          terraOnly: true,
        },
      },
    })
    const found = await discoverLegacyWallets()
    expect(found).toHaveLength(0)
  })

  it('keeps SPA wallet names unique when native wallets share the same name', async () => {
    await upsertAuthData({
      authData: {
        Wallet: {
          ledger: false,
          address: 'terra1native',
          encryptedKey: 'encryptedKeyMaterial',
          password: 'pwd',
        },
      },
    })
    await setCachedSpaWallets([
      {
        name: 'Wallet',
        address: 'terra1spa',
        encrypted: `${'a'.repeat(32)}${'b'.repeat(32)}ciphertext`,
      },
    ])

    const found = await discoverLegacyWallets()
    expect(found.map((w) => w.name)).toEqual([
      'Wallet',
      'Wallet (Legacy)',
    ])
    expect(found.find((w) => w.name === 'Wallet (Legacy)')).toMatchObject(
      {
        address: 'terra1spa',
        spaLegacy: true,
      }
    )
  })
})
