import { toBinary, fromBinary, create } from '@bufbuild/protobuf'
import { base64 } from '@scure/base'
import * as SecureStore from 'expo-secure-store'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import {
  getAuthData,
  upsertAuthData,
  AuthDataValueType,
  LedgerDataValueType,
} from 'utils/authData'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import type {
  CreatedFastVaultResult,
  ImportedSeedFastVaultResult,
  KeyImportResult,
} from './dklsKeyImport'

const VAULT_KEY_PREFIX = 'VAULT-'

const VAULT_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** Sanitize a wallet name into a valid SecureStore key (alphanumeric, '.', '-', '_' only). */
function vaultStoreKey(walletName: string): string {
  return (
    VAULT_KEY_PREFIX + walletName.replace(/[^a-zA-Z0-9._-]/g, '_')
  )
}

export interface MigrationWallet {
  name: string
  address: string
  ledger: boolean
  path?: number
}

export interface MigrationResult {
  wallet: MigrationWallet
  success: boolean
  error?: string
}

function getUniqueImportedChainKeyShares(
  importedChains: ImportedSeedFastVaultResult['importedChains']
): Array<{ publicKey: string; keyshare: string }> {
  const seenPublicKeys = new Set<string>()

  return importedChains.flatMap((chain) => {
    if (!chain.keyshare) return []
    if (seenPublicKeys.has(chain.publicKey)) return []
    seenPublicKeys.add(chain.publicKey)

    return [
      {
        publicKey: chain.publicKey,
        keyshare: chain.keyshare,
      },
    ]
  })
}

/**
 * Reads legacy auth data and returns only wallets that still have key
 * material to migrate (i.e. have not yet been migrated / imported / created
 * as a vault).
 *
 * After migration or vault creation, `storeFastVault` / `persistImportedVault`
 * zero out `encryptedKey` in the authData entry but leave the entry in place
 * so that `getWallets()` can still find the wallet. We must filter those
 * already-migrated stubs out here so that they do not drive the "Start
 * Migration" CTA after the user has finished migrating.
 *
 * An entry is considered unmigrated when:
 *   - it is a Ledger wallet (`ledger === true`), OR
 *   - it still has a non-empty `encryptedKey`
 */
export async function discoverLegacyWallets(): Promise<
  MigrationWallet[]
> {
  const authData = await getAuthData()
  if (!authData) return []

  return Object.entries(authData)
    .filter(([, data]) => {
      if (data.ledger === true) return true
      return (data as AuthDataValueType).encryptedKey?.length > 0
    })
    .map(([name, data]) => ({
      name,
      address: data.address,
      ledger: data.ledger === true,
      path:
        data.ledger === true
          ? (data as LedgerDataValueType).path
          : undefined,
    }))
}

/**
 * Reads a stored vault protobuf for a given wallet name.
 * Returns the raw base64-encoded vault bytes, or null if not found.
 */
export async function getStoredVault(
  walletName: string
): Promise<string | null> {
  return SecureStore.getItemAsync(
    vaultStoreKey(walletName),
    VAULT_STORE_OPTS
  )
}

/**
 * Stores a DKLS fast vault and deletes the legacy auth data entry.
 * Only deletes legacy data after verifying the vault reads back correctly.
 */
export async function storeFastVault(
  walletName: string,
  result:
    | KeyImportResult
    | CreatedFastVaultResult
    | ImportedSeedFastVaultResult
): Promise<void> {
  if ((await getStoredVault(walletName)) !== null) {
    // eslint-disable-next-line no-console -- important diagnostic for double-migration attempts
    console.warn(
      `[storeFastVault] ${walletName} already migrated, skipping`
    )
    return
  }

  const isSeedImportVault = 'importedChains' in result
  const isCreatedVault =
    'publicKeyEddsa' in result && !isSeedImportVault
  const legacyResult = result as KeyImportResult

  const vault = isSeedImportVault
    ? create(VaultSchema, {
        name: walletName,
        publicKeyEcdsa: result.publicKeyEcdsa,
        publicKeyEddsa: result.publicKeyEddsa,
        signers: [result.localPartyId, result.serverPartyId],
        localPartyId: result.localPartyId,
        hexChainCode: result.chainCode,
        resharePrefix: '',
        libType: LibType.KEYIMPORT,
        keyShares: [
          {
            publicKey: result.publicKeyEcdsa,
            keyshare: result.keyshareEcdsa,
          },
          {
            publicKey: result.publicKeyEddsa,
            keyshare: result.keyshareEddsa,
          },
          ...getUniqueImportedChainKeyShares(result.importedChains),
        ],
        chainPublicKeys: result.importedChains.map((chain) => ({
          chain: chain.chain,
          publicKey: chain.publicKey,
          isEddsa: chain.isEddsa,
        })),
        createdAt: {
          seconds: BigInt(Math.floor(Date.now() / 1000)),
          nanos: 0,
        },
        publicKeyMldsa44: '',
      })
    : isCreatedVault
    ? create(VaultSchema, {
        name: walletName,
        publicKeyEcdsa: result.publicKeyEcdsa,
        publicKeyEddsa: result.publicKeyEddsa,
        signers: [result.localPartyId, result.serverPartyId],
        localPartyId: result.localPartyId,
        hexChainCode: result.chainCode,
        resharePrefix: '',
        libType: LibType.DKLS,
        keyShares: [
          {
            publicKey: result.publicKeyEcdsa,
            keyshare: result.keyshareEcdsa,
          },
          {
            publicKey: result.publicKeyEddsa,
            keyshare: result.keyshareEddsa,
          },
        ],
        chainPublicKeys: [],
        createdAt: {
          seconds: BigInt(Math.floor(Date.now() / 1000)),
          nanos: 0,
        },
        publicKeyMldsa44: '',
      })
    : create(VaultSchema, {
        name: walletName,
        publicKeyEcdsa: legacyResult.publicKey,
        publicKeyEddsa: '',
        signers: [
          legacyResult.localPartyId,
          legacyResult.serverPartyId,
        ],
        localPartyId: legacyResult.localPartyId,
        hexChainCode: '',
        resharePrefix: '',
        libType: LibType.KEYIMPORT,
        keyShares: [
          {
            publicKey: legacyResult.publicKey,
            keyshare: legacyResult.keyshare,
          },
        ],
        chainPublicKeys: [
          {
            chain: 'Terra',
            publicKey: legacyResult.publicKey,
            isEddsa: false,
          },
        ],
        createdAt: {
          seconds: BigInt(Math.floor(Date.now() / 1000)),
          nanos: 0,
        },
        publicKeyMldsa44: '',
      })

  const vaultBytes = toBinary(VaultSchema, vault)
  const encoded = base64.encode(vaultBytes)

  await SecureStore.setItemAsync(
    vaultStoreKey(walletName),
    encoded,
    VAULT_STORE_OPTS
  )

  // Ensure the wallet appears in the legacy wallet list (getWallets reads authData).
  // For migrations: strip key material but keep the entry.
  // For new vaults: create a minimal entry so the wallet is discoverable.
  const authData = await getAuthData()
  const existing = authData?.[walletName]

  if (existing && !existing.ledger) {
    // Migration: strip sensitive data from the existing entry
    const entry = existing as AuthDataValueType
    await upsertAuthData({
      authData: {
        [walletName]: {
          address: entry.address,
          encryptedKey: '',
          password: '',
          ledger: false,
          terraOnly: !isCreatedVault && !isSeedImportVault,
        },
      },
    })
  } else if (!existing) {
    // New vault creation: register in authData so getWallets() can find it
    await upsertAuthData({
      authData: {
        [walletName]: {
          address: '',
          encryptedKey: '',
          password: '',
          ledger: false,
        },
      },
    })
  }
}

/**
 * Canonical vault classifier — mirrors iOS `Vault.swift:172` and
 * vultiagent-app `vaultUtils.ts:6`.
 *
 * - 'none'        → no stored vault proto for this wallet
 * - 'fast'        → DKLS vault, has a `server-`-prefixed signer, and the
 *                   user's own localPartyId is NOT server-prefixed (i.e. a
 *                   2-of-2 device + VultiServer vault)
 * - 'multi-share' → DKLS vault with no server signer (multi-device, or the
 *                   device is itself the server party — shouldn't self-classify
 *                   as fast)
 */
export async function getVaultKind(
  walletName: string
): Promise<'none' | 'fast' | 'multi-share'> {
  const stored = await getStoredVault(walletName)
  if (!stored) return 'none'
  try {
    const decoded = fromBinary(VaultSchema, base64.decode(stored))
    if (decoded.libType !== LibType.DKLS) return 'multi-share'
    // localPartyId is server-side → not a fast vault from user perspective
    if (decoded.localPartyId?.toLowerCase().startsWith('server-')) {
      return 'multi-share'
    }
    const hasServerSigner = decoded.signers.some((s) =>
      s.toLowerCase().startsWith('server-')
    )
    return hasServerSigner ? 'fast' : 'multi-share'
  } catch {
    return 'none'
  }
}

/**
 * Returns true if the stored vault for `walletName` was registered under the
 * pre-#93 broken FRESH-CREATE / SEED-RECOVER path. Vaults in this state derive
 * correct Terra addresses but phantom addresses on every other chain when
 * imported into Vultisig or any other Vultisig wallet. The only fix is to
 * re-create or re-import the seed with current code.
 *
 * Discriminator: DKLS && empty publicKeyEddsa && all-zeros hexChainCode &&
 * NO chainPublicKeys.
 *
 * The chainPublicKeys check is what distinguishes broken fresh-create vaults
 * (no chainPublicKeys registered) from legacy private-key migrate vaults
 * (one Terra chainPublicKey registered). Legacy private-key migrates are
 * stored under the same DKLS+empty-eddsa+zero-chainCode shape because the
 * pre-#93 storeFastVault code path was shared, but they're TERRA-ONLY BY
 * DESIGN — the user only ever had a Terra privkey, no master to recover —
 * so they shouldn't be flagged as broken-derivation. Their single Terra
 * chainPublicKey lets us tell them apart from broken fresh-creates.
 *
 * Returns false for:
 * - Missing vaults (no stored proto)
 * - Post-#93 DKLS vaults (have non-empty publicKeyEddsa and non-zero hexChainCode)
 * - KEYIMPORT seed-recover vaults (chainPublicKeys.length >= 36)
 * - Legacy private-key migrate vaults (have one Terra chainPublicKey)
 */
export async function hasBrokenDerivation(
  walletName: string
): Promise<boolean> {
  const stored = await getStoredVault(walletName)
  if (!stored) return false
  try {
    const decoded = fromBinary(VaultSchema, base64.decode(stored))
    return (
      decoded.libType === LibType.DKLS &&
      decoded.publicKeyEddsa === '' &&
      decoded.hexChainCode === '0'.repeat(64) &&
      decoded.chainPublicKeys.length === 0
    )
  } catch {
    return false
  }
}

/**
 * Check if a stored vault is a DKLS fast vault (vs legacy KEYIMPORT or
 * multi-share).  Uses the canonical server-prefix discriminator from iOS
 * `Vault.swift:172` and vultiagent-app `vaultUtils.ts:6`: a fast vault has at
 * least one `server-`-prefixed signer AND the user's own localPartyId is NOT
 * server-prefixed.
 *
 * Note: still called by ExportPrivateKey.tsx — see open follow-up ticket.
 */
export async function isVaultFastVault(
  walletName: string
): Promise<boolean> {
  return (await getVaultKind(walletName)) === 'fast'
}

/**
 * One-time backfill: every non-ledger authData entry in this app is Terra-only
 * by construction — either a legacy Terra Station wallet (migrated from the old
 * native keystore) or a Fast Vault created by this app (which only registers
 * the Terra chain). Stamp `terraOnly: true` on any entry missing the flag.
 *
 * V2 reruns for users whose V1 backfill already completed, so legacy wallets
 * that were never migrated to a Fast Vault also get the flag.
 */
export async function backfillTerraOnlyFlag(): Promise<void> {
  const done = await preferences.getBool(
    PreferencesEnum.terraOnlyBackfilledV2
  )
  if (done) return

  const authData = await getAuthData()
  if (!authData) {
    await preferences.setBool(
      PreferencesEnum.terraOnlyBackfilledV2,
      true
    )
    return
  }

  let changed = false

  for (const entry of Object.values(authData)) {
    if (entry.ledger) continue
    const val = entry as AuthDataValueType
    if (val.terraOnly === true) continue

    val.terraOnly = true
    changed = true
  }

  if (changed) {
    await upsertAuthData({ authData })
  }

  await preferences.setBool(
    PreferencesEnum.terraOnlyBackfilledV2,
    true
  )
}

export { VAULT_KEY_PREFIX, VAULT_STORE_OPTS, vaultStoreKey }
