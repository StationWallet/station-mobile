import { create, toBinary } from '@bufbuild/protobuf'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { persistImportedVault } from 'services/importVaultBackup'
import { getStoredVault } from 'services/migrateToVault'
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
    expect(await getStoredVault('My Weird/Vault!')).toBeTruthy()
  })
})
