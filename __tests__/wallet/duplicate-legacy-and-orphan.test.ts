import { create, toBinary } from '@bufbuild/protobuf'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { persistImportedVault } from 'services/importVaultBackup'
import {
  getStoredVault,
  getStoredVaultTerraAddress,
} from 'services/migrateToVault'
import { deleteWallet } from 'utils/wallet'
import { upsertAuthData } from 'utils/authData'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'

// Trezor "abandon abandon ... about" Terra master pubkey + matching address —
// computed from the master ECDSA private key (1837c1...cdf67) for that seed.
// Keeps the pubkey→address derivation tied to a stable, well-known vector.
const TREZOR_TERRA_PUBKEY =
  '03d902f35f560e0470c63313c7369168d9d7df2d49bf295fd9fb7cb109ccee0494'
const TREZOR_TERRA_ADDRESS =
  'terra1w0za5zsr6tggqwmnruzzg2a5pnkjlzauqec2z9'

beforeEach(() => {
  resetSecure()
})

function buildVaultBytes(
  walletName: string,
  terraPubKeyHex: string
): Uint8Array {
  const vault = create(VaultSchema, {
    name: walletName,
    publicKeyEcdsa: 'rootEcdsa',
    publicKeyEddsa: 'rootEddsa',
    signers: ['Device-1', 'Server-1'],
    localPartyId: 'Device-1',
    hexChainCode: '0'.repeat(64),
    resharePrefix: '',
    libType: LibType.KEYIMPORT,
    keyShares: [
      { publicKey: 'rootEcdsa', keyshare: 'k-ecdsa' },
      { publicKey: 'rootEddsa', keyshare: 'k-eddsa' },
    ],
    chainPublicKeys: [
      { chain: 'Terra', publicKey: terraPubKeyHex, isEddsa: false },
      { chain: 'Ethereum', publicKey: '02deadbeef', isEddsa: false },
    ],
  })
  return toBinary(VaultSchema, vault)
}

function persistVaultWithChainPublicKeys(
  walletName: string,
  terraPubKeyHex: string
): Promise<void> {
  return persistImportedVault(
    buildVaultBytes(walletName, terraPubKeyHex),
    walletName
  )
}

describe('getStoredVaultTerraAddress', () => {
  it('extracts the Terra address from a stored vault proto', async () => {
    await persistVaultWithChainPublicKeys('Seed', TREZOR_TERRA_PUBKEY)
    const address = await getStoredVaultTerraAddress('Seed')
    expect(address).toBe(TREZOR_TERRA_ADDRESS)
  })

  it('returns null when no vault is stored for the wallet', async () => {
    const address = await getStoredVaultTerraAddress('Missing')
    expect(address).toBeNull()
  })

  it('returns null when the stored vault has an uncompressed-looking Terra pubkey', async () => {
    // 04-prefixed: uncompressed secp256k1. Even at the right length our
    // derivation refuses it explicitly so corrupted/wrong-format data
    // doesn't silently fall back to a phantom "no Terra entry" miss.
    const uncompressed = '04' + 'a'.repeat(64) // 66 chars total, but invalid prefix
    await persistVaultWithChainPublicKeys('Bad', uncompressed)
    expect(await getStoredVaultTerraAddress('Bad')).toBeNull()
  })

  it('returns null when the Terra pubkey is the right length but not hex', async () => {
    const junk = '02' + 'z'.repeat(64) // non-hex characters
    await persistVaultWithChainPublicKeys('Junk', junk)
    expect(await getStoredVaultTerraAddress('Junk')).toBeNull()
  })

  it('returns null when the stored vault has no Terra chainPublicKey', async () => {
    const vault = create(VaultSchema, {
      name: 'NoTerra',
      publicKeyEcdsa: 'a',
      libType: LibType.KEYIMPORT,
      signers: ['Device', 'Server'],
      localPartyId: 'Device',
      hexChainCode: '0'.repeat(64),
      publicKeyEddsa: '',
      resharePrefix: '',
      keyShares: [],
      chainPublicKeys: [
        {
          chain: 'Ethereum',
          publicKey: '02deadbeef',
          isEddsa: false,
        },
      ],
    })
    await persistImportedVault(
      toBinary(VaultSchema, vault),
      'NoTerra'
    )
    const address = await getStoredVaultTerraAddress('NoTerra')
    expect(address).toBeNull()
  })
})

describe('getWallets — SPA-legacy dedup (Fix A)', () => {
  // Each test sets up its own SPA cache mock AND its own state, with
  // jest.resetModules() between cases so the doMock takes effect for the
  // freshly required modules.

  async function runWithMockedSpaCache(
    spaWallets: Array<{
      name: string
      address: string
      encrypted: string
    }>,
    setup: (mods: {
      upsertAuthData: typeof import('utils/authData').upsertAuthData
      persistImportedVault: typeof import('services/importVaultBackup').persistImportedVault
    }) => Promise<void>
  ): Promise<
    Array<{ name: string; address: string; spaLegacy?: boolean }>
  > {
    jest.resetModules()
    // Re-resolve the SecureStore mock under the *new* module graph so
    // every consumer (utils/wallet, services/migrateToVault,
    // services/importVaultBackup, utils/authData) talks to the same
    // backing Map.
    const { __reset } =
      require('../__mocks__/expo-secure-store') as typeof import('../__mocks__/expo-secure-store')
    __reset()
    jest.doMock('services/spaWalletCache', () => ({
      getCachedSpaWallets: async (): Promise<typeof spaWallets> =>
        spaWallets,
      getUniqueSpaWalletName: (name: string): string => name,
    }))
    const authMod = require('utils/authData')
    const importMod = require('services/importVaultBackup')
    await setup({
      upsertAuthData: authMod.upsertAuthData,
      persistImportedVault: importMod.persistImportedVault,
    })
    const { getWallets: getWalletsFresh } = require('utils/wallet')
    return await getWalletsFresh()
  }

  it('deduplicates SPA wallets against Fast Vaults whose authData address is empty', async () => {
    const wallets = await runWithMockedSpaCache(
      [
        {
          name: 'Legacy SPA',
          address: TREZOR_TERRA_ADDRESS,
          encrypted: 'encrypted-payload',
        },
      ],
      async ({ upsertAuthData, persistImportedVault }) => {
        // Seed-import-style: address='' in authData + stored vault proto
        // whose chainPublicKeys[Terra] derives to TREZOR_TERRA_ADDRESS.
        await upsertAuthData({
          authData: {
            Seed: {
              address: '',
              encryptedKey: '',
              password: '',
              ledger: false,
            },
          },
        })
        await persistImportedVault(
          buildVaultBytes('Seed', TREZOR_TERRA_PUBKEY),
          'Seed'
        )
      }
    )

    // Only the native Fast Vault should appear; SPA legacy at the same
    // Terra address must be deduplicated away.
    expect(wallets).toHaveLength(1)
    expect(wallets[0].name).toBe('Seed')
    expect(wallets[0].spaLegacy).toBeUndefined()
  })

  it('still appends SPA wallets whose Terra address does NOT match any Fast Vault', async () => {
    const wallets = await runWithMockedSpaCache(
      [
        {
          name: 'Other SPA',
          address: 'terra1other00000000000000000000000000000xxxxx',
          encrypted: 'enc',
        },
      ],
      async ({ upsertAuthData, persistImportedVault }) => {
        await upsertAuthData({
          authData: {
            Seed: {
              address: '',
              encryptedKey: '',
              password: '',
              ledger: false,
            },
          },
        })
        await persistImportedVault(
          buildVaultBytes('Seed', TREZOR_TERRA_PUBKEY),
          'Seed'
        )
      }
    )

    expect(wallets.map((w) => w.name).sort()).toEqual([
      'Other SPA',
      'Seed',
    ])
  })
})

describe('deleteWallet — orphan-proto cleanup (Fix B)', () => {
  it('removes the stored vault proto alongside the authData entry', async () => {
    await upsertAuthData({
      authData: {
        Seed: {
          address: TREZOR_TERRA_ADDRESS,
          encryptedKey: '',
          password: '',
          ledger: false,
        },
      },
    })
    await persistVaultWithChainPublicKeys('Seed', TREZOR_TERRA_PUBKEY)

    // Sanity check — both pieces of state exist pre-delete.
    expect(await getStoredVault('Seed')).not.toBeNull()

    await deleteWallet({ walletName: 'Seed' })

    // After delete: no stored vault proto, no authData entry. An SPA-legacy
    // entry surfaced with the same name later would now correctly classify
    // as 'none' (the wallet-card chip falls back to "Migrate to a Vault"
    // instead of incorrectly showing "Fast Vault").
    expect(await getStoredVault('Seed')).toBeNull()
  })
})
