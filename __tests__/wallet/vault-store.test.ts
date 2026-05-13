import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { persistImportedVault } from 'services/importVaultBackup'
import {
  getStoredVault,
  storeFastVault,
  StoreFastVaultNameTakenError,
} from 'services/migrateToVault'
import { getAuthData, upsertAuthData } from 'utils/authData'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

beforeEach(() => {
  resetSecure()
})

describe('persistImportedVault → getStoredVault', () => {
  it('round-trips a vault blob through SecureStore', async () => {
    const vault = create(VaultSchema, {
      name: 'RoundtripVault',
      publicKeyEcdsa: 'abc123',
      libType: LibType.DKLS,
      keyShares: [{ publicKey: 'abc123', keyshare: 'deadbeef' }],
      signers: ['Device', 'Server'],
      localPartyId: 'Device',
      hexChainCode: '0'.repeat(64),
      publicKeyEddsa: '',
      resharePrefix: '',
    })
    const bytes = toBinary(VaultSchema, vault)

    await persistImportedVault(bytes, 'RoundtripVault')

    const stored = await getStoredVault('RoundtripVault')
    expect(stored).toBeTruthy()

    // Full persist → read → deserialize pipeline: proves the stored bytes
    // are a valid vault, not just any non-null string.
    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.name).toBe('RoundtripVault')
    expect(restored.publicKeyEcdsa).toBe('abc123')
    expect(restored.libType).toBe(LibType.DKLS)
    expect(restored.keyShares[0].keyshare).toBe('deadbeef')
  })

  it('stores under a sanitized key for names with special chars', async () => {
    const vault = create(VaultSchema, {
      name: 'My Weird/Vault!',
      publicKeyEcdsa: 'abc',
      libType: LibType.DKLS,
      keyShares: [{ publicKey: 'abc', keyshare: 'share' }],
      signers: ['Device'],
      localPartyId: 'Device',
      hexChainCode: '0'.repeat(64),
      publicKeyEddsa: '',
      resharePrefix: '',
    })
    const bytes = toBinary(VaultSchema, vault)

    await persistImportedVault(bytes, 'My Weird/Vault!')
    const stored = await getStoredVault('My Weird/Vault!')
    expect(stored).toBeTruthy()
    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.name).toBe('My Weird/Vault!')
  })
})

describe('storeFastVault', () => {
  it('stores legacy/private-key migrations as Terra KEYIMPORT vaults', async () => {
    await storeFastVault('TerraOnly', {
      publicKey: '02terra',
      keyshare: 'opaque-terra-share',
      chainCode: '0'.repeat(64),
      localPartyId: 'Device',
      serverPartyId: 'Server',
      terraAddress: 'terra1legacy',
    })

    const stored = await getStoredVault('TerraOnly')
    expect(stored).toBeTruthy()

    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.libType).toBe(LibType.KEYIMPORT)
    expect(restored.publicKeyEcdsa).toBe('02terra')
    expect(restored.publicKeyEddsa).toBe('')
    expect(restored.hexChainCode).toBe('')
    expect(
      restored.keyShares.map(({ publicKey, keyshare }) => ({
        publicKey,
        keyshare,
      }))
    ).toEqual([
      { publicKey: '02terra', keyshare: 'opaque-terra-share' },
    ])
    expect(
      restored.chainPublicKeys.map(
        ({ chain, publicKey, isEddsa }) => ({
          chain,
          publicKey,
          isEddsa,
        })
      )
    ).toEqual([
      { chain: 'Terra', publicKey: '02terra', isEddsa: false },
    ])

    const authData = await getAuthData()
    expect(authData?.TerraOnly).toMatchObject({
      address: 'terra1legacy',
      ledger: false,
      terraOnly: true,
    })
  })

  it('stores newly created fast vaults as DKLS root ECDSA plus EdDSA vaults', async () => {
    await storeFastVault('CreatedFastVault', {
      publicKey: '02root',
      publicKeyEcdsa: '02root',
      publicKeyEddsa: 'edroot',
      keyshareEcdsa: 'ecdsa-share',
      keyshareEddsa: 'eddsa-share',
      chainCode: '1'.repeat(64),
      localPartyId: 'Device',
      serverPartyId: 'Server',
    })

    const stored = await getStoredVault('CreatedFastVault')
    expect(stored).toBeTruthy()

    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.libType).toBe(LibType.DKLS)
    expect(restored.publicKeyEcdsa).toBe('02root')
    expect(restored.publicKeyEddsa).toBe('edroot')
    expect(restored.hexChainCode).toBe('1'.repeat(64))
    expect(restored.chainPublicKeys).toEqual([])
    expect(
      restored.keyShares.map(({ publicKey, keyshare }) => ({
        publicKey,
        keyshare,
      }))
    ).toEqual([
      { publicKey: '02root', keyshare: 'ecdsa-share' },
      { publicKey: 'edroot', keyshare: 'eddsa-share' },
    ])
  })

  it('stores seed phrase imports as KeyImport root keys plus per-chain keys', async () => {
    await storeFastVault('SeedImport', {
      publicKey: '02root',
      publicKeyEcdsa: '02root',
      publicKeyEddsa: 'edroot',
      keyshareEcdsa: 'root-ecdsa-share',
      keyshareEddsa: 'root-eddsa-share',
      chainCode: '2'.repeat(64),
      localPartyId: 'Device',
      serverPartyId: 'Server',
      importedChains: [
        {
          chain: 'Ethereum',
          publicKey: '02eth',
          keyshare: 'eth-share',
          isEddsa: false,
        },
        {
          chain: 'Terra',
          publicKey: '02terra',
          keyshare: 'terra-share',
          isEddsa: false,
        },
        {
          chain: 'TerraClassic',
          publicKey: '02terra',
          keyshare: 'terra-share',
          isEddsa: false,
        },
      ],
    })

    const stored = await getStoredVault('SeedImport')
    expect(stored).toBeTruthy()

    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.libType).toBe(LibType.KEYIMPORT)
    expect(restored.publicKeyEcdsa).toBe('02root')
    expect(restored.publicKeyEddsa).toBe('edroot')
    expect(restored.hexChainCode).toBe('2'.repeat(64))
    expect(
      restored.chainPublicKeys.map(
        ({ chain, publicKey, isEddsa }) => ({
          chain,
          publicKey,
          isEddsa,
        })
      )
    ).toEqual([
      { chain: 'Ethereum', publicKey: '02eth', isEddsa: false },
      { chain: 'Terra', publicKey: '02terra', isEddsa: false },
      {
        chain: 'TerraClassic',
        publicKey: '02terra',
        isEddsa: false,
      },
    ])
    expect(
      restored.keyShares.map(({ publicKey, keyshare }) => ({
        publicKey,
        keyshare,
      }))
    ).toEqual([
      { publicKey: '02root', keyshare: 'root-ecdsa-share' },
      { publicKey: 'edroot', keyshare: 'root-eddsa-share' },
      { publicKey: '02eth', keyshare: 'eth-share' },
      { publicKey: '02terra', keyshare: 'terra-share' },
    ])
  })
})

describe('storeFastVault — name-collision policy', () => {
  // Seed-import result fixtures shared across tests; declared inline rather
  // than helper-functioned so each test reads top-to-bottom independently.
  const firstSeedImport = {
    publicKey: '02first',
    publicKeyEcdsa: '02first',
    publicKeyEddsa: 'edfirst',
    keyshareEcdsa: 'first-ecdsa',
    keyshareEddsa: 'first-eddsa',
    chainCode: '2'.repeat(64),
    localPartyId: 'Device',
    serverPartyId: 'Server',
    importedChains: [
      {
        chain: 'Terra' as const,
        publicKey: '02terra-first',
        keyshare: 'terra-first',
        isEddsa: false,
      },
    ],
  }

  const secondSeedImport = {
    publicKey: '03second',
    publicKeyEcdsa: '03second',
    publicKeyEddsa: 'edsecond',
    keyshareEcdsa: 'second-ecdsa',
    keyshareEddsa: 'second-eddsa',
    chainCode: '3'.repeat(64),
    localPartyId: 'Device',
    serverPartyId: 'Server',
    importedChains: [
      {
        chain: 'Terra' as const,
        publicKey: '02terra-second',
        keyshare: 'terra-second',
        isEddsa: false,
      },
    ],
  }

  it('overwrites an orphan proto (no authData entry) without throwing', async () => {
    // Repro of the bug we hit in QA: a previous storeFastVault call
    // wrote a vault proto into SecureStore but crashed before authData
    // was updated, leaving an orphan that's invisible in WalletList but
    // used to permanently block re-imports of the same name.
    await storeFastVault('Mm', firstSeedImport)
    // Strip the authData entry to simulate the orphan state.
    const auth = (await getAuthData()) ?? {}
    delete auth.Mm
    await upsertAuthData({ authData: auth })
    // (Direct delete + upsert is OK here — upsertAuthData merges, so we
    // call setAuthData via removeAuthData below if needed; but for the
    // test it's simpler to just write the new partial.)

    // Re-import under the same name — must succeed, and the stored
    // vault should now reflect the SECOND import's keys.
    await expect(
      storeFastVault('Mm', secondSeedImport)
    ).resolves.not.toThrow()

    const stored = await getStoredVault('Mm')
    expect(stored).toBeTruthy()
    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.publicKeyEcdsa).toBe('03second')
    expect(restored.publicKeyEddsa).toBe('edsecond')

    const authData = await getAuthData()
    expect(authData?.Mm).toBeDefined()
    expect(authData?.Mm).toMatchObject({ ledger: false })
  })

  it('overwrites an existing non-Terra-only Fast Vault when re-imported', async () => {
    // First seed-import lands cleanly.
    await storeFastVault('Reimported', firstSeedImport)
    const firstStored = await getStoredVault('Reimported')
    const firstAuth = await getAuthData()
    expect(firstStored).toBeTruthy()
    expect(firstAuth?.Reimported).toBeDefined()
    expect(
      (firstAuth?.Reimported as { terraOnly?: boolean })?.terraOnly
    ).toBeUndefined()

    // Second import under the same name — per product policy, replace.
    await expect(
      storeFastVault('Reimported', secondSeedImport)
    ).resolves.not.toThrow()

    const stored = await getStoredVault('Reimported')
    const restored = fromBinary(VaultSchema, base64.decode(stored!))
    expect(restored.publicKeyEcdsa).toBe('03second')
  })

  it('throws StoreFastVaultNameTakenError when the existing entry is a legacy terraOnly wallet', async () => {
    // Simulate a legacy private-key wallet that the user has NOT yet
    // migrated: authData entry with encryptedKey + terraOnly=true, plus
    // a stored vault proto (from a partial / interrupted earlier write).
    await upsertAuthData({
      authData: {
        Legacy: {
          address: 'terra1legacy',
          encryptedKey: 'encrypted-blob-of-private-key',
          password: 'pwd',
          ledger: false,
          terraOnly: true,
        },
      },
    })
    // Manually plant a proto so the collision check has both sides true.
    await storeFastVault('Legacy', {
      publicKey: '02legacy',
      keyshare: 'opaque-legacy-share',
      chainCode: '0'.repeat(64),
      localPartyId: 'Device',
      serverPartyId: 'Server',
      terraAddress: 'terra1legacy',
    })
    // Re-assert terraOnly + encryptedKey survived the prior storeFastVault
    // call (storeFastVault would have stripped key material if it took
    // the migration branch — for the test we want the not-yet-migrated
    // shape to remain).
    await upsertAuthData({
      authData: {
        Legacy: {
          address: 'terra1legacy',
          encryptedKey: 'encrypted-blob-of-private-key',
          password: 'pwd',
          ledger: false,
          terraOnly: true,
        },
      },
    })

    await expect(
      storeFastVault('Legacy', secondSeedImport)
    ).rejects.toBeInstanceOf(StoreFastVaultNameTakenError)

    // First wallet must remain intact — failed second call shouldn't
    // overwrite the legacy private-key material.
    const authData = await getAuthData()
    expect(
      (authData?.Legacy as { encryptedKey?: string })?.encryptedKey
    ).toBe('encrypted-blob-of-private-key')
  })

  it('writes cleanly when both proto and authData are absent (fresh import)', async () => {
    await expect(
      storeFastVault('Brandnew', firstSeedImport)
    ).resolves.not.toThrow()
    const stored = await getStoredVault('Brandnew')
    expect(stored).toBeTruthy()
    const authData = await getAuthData()
    expect(authData?.Brandnew).toBeDefined()
  })
})
