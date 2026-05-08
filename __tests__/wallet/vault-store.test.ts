import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { persistImportedVault } from 'services/importVaultBackup'
import { getStoredVault, storeFastVault } from 'services/migrateToVault'
import { getAuthData } from 'utils/authData'
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
      restored.chainPublicKeys.map(({ chain, publicKey, isEddsa }) => ({
        chain,
        publicKey,
        isEddsa,
      }))
    ).toEqual([
      { chain: 'Terra', publicKey: '02terra', isEddsa: false },
    ])

    const authData = await getAuthData()
    expect(authData?.TerraOnly).toMatchObject({
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
      restored.chainPublicKeys.map(({ chain, publicKey, isEddsa }) => ({
        chain,
        publicKey,
        isEddsa,
      }))
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
