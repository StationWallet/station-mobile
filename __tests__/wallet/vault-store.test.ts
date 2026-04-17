import { create, toBinary, fromBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'

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
