import { create, toBinary } from '@bufbuild/protobuf'

import { __reset as resetSecure } from '../__mocks__/expo-secure-store'
import { LibType } from '../../src/proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../../src/proto/vultisig/vault/v1/vault_pb'
import {
  classifyVaultForAirdropRegistration,
  getAirdropRegistrationState,
  registerAirdropOnLaunch,
} from 'services/airdropRegistration'
import { persistImportedVault } from 'services/importVaultBackup'
import { storeFastVault } from 'services/migrateToVault'

const ROOT_PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const ETH_PUBKEY =
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'
const CHAIN_CODE =
  '7923408dadd3c7b56eed15567707ae5e5dca089de972e07f3b860450e2a3b70e'

const now = (): Date => new Date('2026-05-19T00:00:00.000Z')

beforeEach(() => {
  resetSecure()
})

describe('classifyVaultForAirdropRegistration', () => {
  it('blocks legacy Terra-only migrations instead of deriving a phantom EVM recipient', () => {
    const vault = create(VaultSchema, {
      name: 'LegacyTerra',
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: '',
      hexChainCode: '',
      libType: LibType.KEYIMPORT,
      signers: ['sdk-test', 'Server-test'],
      localPartyId: 'sdk-test',
      chainPublicKeys: [
        { chain: 'Terra', publicKey: ROOT_PUBKEY, isEddsa: false },
      ],
      keyShares: [{ publicKey: ROOT_PUBKEY, keyshare: 'share' }],
    })

    expect(
      classifyVaultForAirdropRegistration(vault, {
        ledger: false,
        address: 'terra1legacy',
        encryptedKey: '',
        password: '',
        terraOnly: true,
      })
    ).toEqual({
      status: 'blocked',
      reason: 'legacy_terra_only',
      publicKeyEcdsa: ROOT_PUBKEY,
    })
  })

  it('uses imported Ethereum chain public keys for seed-imported Station vaults', () => {
    const vault = create(VaultSchema, {
      name: 'SeedImport',
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      hexChainCode: CHAIN_CODE,
      libType: LibType.KEYIMPORT,
      signers: ['sdk-test', 'Server-test'],
      localPartyId: 'sdk-test',
      chainPublicKeys: [
        { chain: 'Ethereum', publicKey: ETH_PUBKEY, isEddsa: false },
      ],
      keyShares: [{ publicKey: ROOT_PUBKEY, keyshare: 'share' }],
    })

    const result = classifyVaultForAirdropRegistration(vault)

    expect(result).toMatchObject({
      status: 'registerable',
      source: 'seed',
      bucket: 'station_migration',
      publicKeyEcdsa: ROOT_PUBKEY,
    })
    expect(
      result.status === 'registerable' && result.recipientAddress
    ).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('derives created-vault recipients from the root ECDSA key and chain code', () => {
    const vault = create(VaultSchema, {
      name: 'Created',
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      hexChainCode: CHAIN_CODE,
      libType: LibType.DKLS,
      signers: ['sdk-test', 'Server-test'],
      localPartyId: 'sdk-test',
      keyShares: [{ publicKey: ROOT_PUBKEY, keyshare: 'share' }],
    })

    const result = classifyVaultForAirdropRegistration(vault)

    expect(result).toMatchObject({
      status: 'registerable',
      source: 'create',
      bucket: 'campaign_new',
      publicKeyEcdsa: ROOT_PUBKEY,
    })
    expect(
      result.status === 'registerable' && result.recipientAddress
    ).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('requires provenance before registering non-Station vault shares', () => {
    const vault = create(VaultSchema, {
      name: 'Imported',
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      hexChainCode: CHAIN_CODE,
      libType: LibType.DKLS,
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Device-1',
      keyShares: [{ publicKey: ROOT_PUBKEY, keyshare: 'share' }],
    })

    expect(classifyVaultForAirdropRegistration(vault)).toEqual({
      status: 'blocked',
      reason: 'unknown_registration_source',
      publicKeyEcdsa: ROOT_PUBKEY,
    })

    expect(
      classifyVaultForAirdropRegistration(vault, {
        ledger: false,
        address: '',
        encryptedKey: '',
        password: '',
        airdropSource: 'vault_share',
      })
    ).toMatchObject({
      status: 'registerable',
      source: 'vault_share',
      bucket: 'campaign_new',
    })
  })
})

describe('registerAirdropOnLaunch', () => {
  it('persists missing-auth state and does not call the backend without a token provider', async () => {
    await storeFastVault('CreatedFastVault', {
      publicKey: ROOT_PUBKEY,
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      keyshareEcdsa: 'ecdsa-share',
      keyshareEddsa: 'eddsa-share',
      chainCode: CHAIN_CODE,
      localPartyId: 'sdk-test',
      serverPartyId: 'Server-test',
    })
    const fetchMock = jest.fn()

    const first = await registerAirdropOnLaunch({
      fetchImpl: fetchMock as unknown as typeof fetch,
      now,
    })
    const second = await registerAirdropOnLaunch({
      fetchImpl: fetchMock as unknown as typeof fetch,
      now,
    })

    expect(first).toMatchObject({ considered: 1, blocked: 1 })
    expect(second).toMatchObject({ considered: 1, skipped: 1 })
    expect(fetchMock).not.toHaveBeenCalled()

    const state = await getAirdropRegistrationState()
    expect(state.records[ROOT_PUBKEY.toLowerCase()]).toMatchObject({
      status: 'blocked',
      reason: 'missing_auth_token',
      source: 'create',
      bucket: 'campaign_new',
    })
  })

  it('posts authenticated registrations and records success', async () => {
    await storeFastVault('SeedImport', {
      publicKey: ROOT_PUBKEY,
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      keyshareEcdsa: 'root-ecdsa-share',
      keyshareEddsa: 'root-eddsa-share',
      chainCode: CHAIN_CODE,
      localPartyId: 'sdk-test',
      serverPartyId: 'Server-test',
      importedChains: [
        {
          chain: 'Ethereum',
          publicKey: ETH_PUBKEY,
          keyshare: '',
          isEddsa: false,
        },
      ],
    })
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn(),
    })

    const summary = await registerAirdropOnLaunch({
      getAuthToken: jest.fn().mockResolvedValue('jwt'),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now,
    })

    expect(summary).toMatchObject({ considered: 1, registered: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://agent.vultisig.com/airdrop/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt',
          'Content-Type': 'application/json',
        }),
      })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(
      {
        source: 'seed',
        bucket: 'station_migration',
        recipient_address: expect.stringMatching(
          /^0x[0-9a-fA-F]{40}$/
        ),
      }
    )

    const state = await getAirdropRegistrationState()
    expect(state.records[ROOT_PUBKEY.toLowerCase()]).toMatchObject({
      status: 'registered',
      source: 'seed',
      bucket: 'station_migration',
    })
  })

  it('uses vault-share provenance persisted for imported backups', async () => {
    const vault = create(VaultSchema, {
      name: 'ImportedVault',
      publicKeyEcdsa: ROOT_PUBKEY,
      publicKeyEddsa: 'edroot',
      hexChainCode: CHAIN_CODE,
      libType: LibType.DKLS,
      signers: ['Device-1', 'Server-1'],
      localPartyId: 'Device-1',
      keyShares: [{ publicKey: ROOT_PUBKEY, keyshare: 'share' }],
    })

    await persistImportedVault(
      toBinary(VaultSchema, vault),
      'ImportedVault'
    )

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn(),
    })

    await registerAirdropOnLaunch({
      getAuthToken: jest.fn().mockResolvedValue('jwt'),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now,
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(
      {
        source: 'vault_share',
        bucket: 'campaign_new',
      }
    )
  })
})
