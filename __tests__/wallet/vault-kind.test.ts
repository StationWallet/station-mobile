import { create, toBinary } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from '../__mocks__/expo-secure-store'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { getVaultKind } from 'services/migrateToVault'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

// vaultStoreKey sanitises the name with a 'VAULT-' prefix — replicate here
// so we can pre-seed SecureStore directly.
function vaultStoreKey(name: string): string {
  return 'VAULT-' + name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

const STORE_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

async function storeVault(
  name: string,
  signers: string[],
  localPartyId: string,
  libType: LibType = LibType.DKLS,
): Promise<void> {
  const vault = create(VaultSchema, {
    name,
    publicKeyEcdsa: 'abc',
    publicKeyEddsa: '',
    signers,
    localPartyId,
    hexChainCode: '0'.repeat(64),
    resharePrefix: '',
    libType,
    keyShares: [{ publicKey: 'abc', keyshare: 'share' }],
  })
  const encoded = base64.encode(toBinary(VaultSchema, vault))
  await SecureStore.setItemAsync(vaultStoreKey(name), encoded, STORE_OPTS)
}

beforeEach(() => {
  resetSecure()
})

describe('getVaultKind', () => {
  it("returns 'none' when no vault is stored", async () => {
    expect(await getVaultKind('NoVault')).toBe('none')
  })

  it("returns 'fast' for a device+server vault (canonical fast vault)", async () => {
    await storeVault('FastVault', ['sdk-ABC123', 'Server-987654'], 'sdk-ABC123')
    expect(await getVaultKind('FastVault')).toBe('fast')
  })

  it("returns 'fast' with mixed-case Server prefix", async () => {
    await storeVault('FastVault2', ['Device', 'server-lower'], 'Device')
    expect(await getVaultKind('FastVault2')).toBe('fast')
  })

  it("returns 'multi-share' for a 3-of-3 multi-device vault (no server signer)", async () => {
    await storeVault(
      'MultiVault',
      ['iPhone-AB12', 'MacOS-CD34', 'MacOS-EF56'],
      'iPhone-AB12',
    )
    expect(await getVaultKind('MultiVault')).toBe('multi-share')
  })

  it("returns 'multi-share' when localPartyId is itself server-prefixed", async () => {
    // The server side of a 2-of-2 should not classify itself as a fast vault.
    // This mirrors iOS Vault.swift:172 — if localPartyID starts with 'server-' → false.
    await storeVault(
      'ServerSideVault',
      ['Server-12345', 'Device'],
      'Server-12345',
    )
    expect(await getVaultKind('ServerSideVault')).toBe('multi-share')
  })

  it("returns 'multi-share' for a DKLS vault with a single non-server signer", async () => {
    await storeVault('SoloVault', ['OnlyDevice'], 'OnlyDevice')
    expect(await getVaultKind('SoloVault')).toBe('multi-share')
  })

  it("returns 'fast' for a KEYIMPORT vault with a server signer (post-#93 seed-import shape)", async () => {
    // PR #93 stores seed-imported vaults as libType=KEYIMPORT (because that
    // is what setupKeyImport registers them as on the server). The signer
    // set is still (device, Server-XXX) — i.e. a fast vault. A previous
    // version of getVaultKind early-returned 'multi-share' on any non-DKLS
    // libType, which mis-classified these vaults; this test pins the fix.
    await storeVault(
      'KeyImportFastVault',
      ['sdk-deadbe', 'Server-12345'],
      'sdk-deadbe',
      LibType.KEYIMPORT,
    )
    expect(await getVaultKind('KeyImportFastVault')).toBe('fast')
  })
})
