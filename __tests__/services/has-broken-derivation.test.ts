import { create, toBinary } from '@bufbuild/protobuf'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'
import { hasBrokenDerivation } from 'services/migrateToVault'
import { persistImportedVault } from 'services/importVaultBackup'

// authData mock — persistImportedVault may read/write authData
jest.mock('utils/authData', () => ({
  getAuthData: jest.fn().mockResolvedValue(null),
  upsertAuthData: jest.fn().mockResolvedValue(undefined),
}))

// preferences mock — migrateToVault imports it at module load time
jest.mock('nativeModules/preferences', () => ({
  __esModule: true,
  default: {
    getBool: jest.fn().mockResolvedValue(false),
    setBool: jest.fn().mockResolvedValue(undefined),
  },
  PreferencesEnum: {
    terraOnlyBackfilledV2: 'terraOnlyBackfilledV2',
  },
}))

/** Store an arbitrary Vault proto via persistImportedVault (bypasses
 *  storeFastVault guard-rails, so we can seed any shape we need). */
async function storeVaultProto(
  walletName: string,
  vault: ReturnType<typeof create<typeof VaultSchema>>
): Promise<void> {
  const bytes = toBinary(VaultSchema, vault)
  await persistImportedVault(bytes, walletName)
}

beforeEach(() => {
  resetSecure()
})

describe('hasBrokenDerivation', () => {
  it('returns true for a pre-#93 DKLS vault (ECDSA-only, all-zeros chain code)', async () => {
    const vault = create(VaultSchema, {
      name: 'BrokenWallet',
      publicKeyEcdsa: 'aabbcc',
      publicKeyEddsa: '',
      hexChainCode: '0'.repeat(64),
      libType: LibType.DKLS,
      signers: ['device-1', 'server-1'],
      localPartyId: 'device-1',
      resharePrefix: '',
      keyShares: [],
      chainPublicKeys: [],
      createdAt: { seconds: 0n, nanos: 0 },
      publicKeyMldsa44: '',
    })
    await storeVaultProto('BrokenWallet', vault)

    expect(await hasBrokenDerivation('BrokenWallet')).toBe(true)
  })

  it('returns false for a post-#93 DKLS vault (non-empty eddsa + non-zero chain code)', async () => {
    const vault = create(VaultSchema, {
      name: 'FixedWallet',
      publicKeyEcdsa: 'aabbcc',
      publicKeyEddsa: 'ddeeff',
      hexChainCode: 'a'.repeat(64),
      libType: LibType.DKLS,
      signers: ['device-1', 'server-1'],
      localPartyId: 'device-1',
      resharePrefix: '',
      keyShares: [],
      chainPublicKeys: [],
      createdAt: { seconds: 0n, nanos: 0 },
      publicKeyMldsa44: '',
    })
    await storeVaultProto('FixedWallet', vault)

    expect(await hasBrokenDerivation('FixedWallet')).toBe(false)
  })

  it('returns false for a KEYIMPORT seed-recover vault (multiple chainPublicKeys)', async () => {
    const chainPublicKeys = Array.from({ length: 36 }, (_, i) => ({
      chain: `Chain${i}`,
      publicKey: `pk${i}`,
      isEddsa: false,
    }))
    const vault = create(VaultSchema, {
      name: 'SeedRecoverWallet',
      publicKeyEcdsa: 'aabbcc',
      publicKeyEddsa: 'ddeeff',
      hexChainCode: 'a'.repeat(64),
      libType: LibType.KEYIMPORT,
      signers: ['device-1', 'server-1'],
      localPartyId: 'device-1',
      resharePrefix: '',
      keyShares: [],
      chainPublicKeys,
      createdAt: { seconds: 0n, nanos: 0 },
      publicKeyMldsa44: '',
    })
    await storeVaultProto('SeedRecoverWallet', vault)

    expect(await hasBrokenDerivation('SeedRecoverWallet')).toBe(false)
  })

  it('returns false for a KEYIMPORT legacy migrate vault (Terra-only)', async () => {
    const vault = create(VaultSchema, {
      name: 'LegacyWallet',
      publicKeyEcdsa: 'aabbcc',
      publicKeyEddsa: '',
      hexChainCode: '',
      libType: LibType.KEYIMPORT,
      signers: ['device-1', 'server-1'],
      localPartyId: 'device-1',
      resharePrefix: '',
      keyShares: [],
      chainPublicKeys: [
        { chain: 'Terra', publicKey: 'aabbcc', isEddsa: false },
      ],
      createdAt: { seconds: 0n, nanos: 0 },
      publicKeyMldsa44: '',
    })
    await storeVaultProto('LegacyWallet', vault)

    expect(await hasBrokenDerivation('LegacyWallet')).toBe(false)
  })

  it('returns false when no vault is stored for the wallet name', async () => {
    expect(await hasBrokenDerivation('NonExistentWallet')).toBe(false)
  })
})
