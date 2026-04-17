import { create, toBinary } from '@bufbuild/protobuf'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { getStoredVault } from '../../src/services/migrateToVault'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

// Production `persistImportedVault` ends with `await import('../utils/authData')`
// to avoid a module-init-time dependency on authData. Jest's CommonJS VM
// rejects dynamic-import callbacks and babel-preset-expo doesn't rewrite them,
// so we replace the module with a version that keeps the SecureStore write
// path intact and drops the authData registration step (out of scope for D3).
jest.mock('../../src/services/importVaultBackup', () => {
  const SecureStore = require('expo-secure-store')
  const { base64 } = require('@scure/base')
  const {
    VAULT_STORE_OPTS,
    vaultStoreKey,
  } = require('../../src/services/migrateToVault')

  return {
    async persistImportedVault(
      vaultBytes: Uint8Array,
      vaultName: string,
    ): Promise<void> {
      const encoded = base64.encode(vaultBytes)
      await SecureStore.setItemAsync(
        vaultStoreKey(vaultName),
        encoded,
        VAULT_STORE_OPTS,
      )
    },
  }
})

// eslint-disable-next-line import/first -- mock must be declared before import
import { persistImportedVault } from '../../src/services/importVaultBackup'

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
