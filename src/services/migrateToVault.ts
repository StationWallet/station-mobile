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
import { getCachedSpaWallets } from './spaWalletDiscovery'
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
  /**
   * True when this wallet was discovered in the legacy Terra Station SPA's
   * WebView localStorage. Recovery requires the user's legacy Station
   * password (passed to spaLegacyDecrypt#decryptLegacyWallet).
   */
  spaLegacy?: boolean
  spaEncrypted?: string
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
  const native: MigrationWallet[] = authData
    ? Object.entries(authData)
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
    : []

  // Merge wallets discovered in the legacy Terra Station SPA's WebView
  // localStorage. Key on address so we don't double-count wallets that the
  // user has already started migrating (they'd exist in both stores until
  // the migration completes).
  const spaCache = await getCachedSpaWallets()
  const knownAddresses = new Set(native.map((w) => w.address))
  const spa: MigrationWallet[] = spaCache
    .filter((w) => !knownAddresses.has(w.address))
    .map((w) => ({
      name: w.name,
      address: w.address,
      ledger: false,
      spaLegacy: true,
      spaEncrypted: w.encrypted,
    }))

  return [...native, ...spa]
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
          ...(!isCreatedVault && !isSeedImportVault
            ? { terraOnly: true }
            : {}),
        },
      },
    })
  } else if (!existing) {
    // New vault creation/import: register in authData so getWallets() can find it.
    // Single-key imports are Terra-only, matching migrated legacy private-key vaults.
    await upsertAuthData({
      authData: {
        [walletName]: {
          address: '',
          encryptedKey: '',
          password: '',
          ledger: false,
          ...(!isCreatedVault && !isSeedImportVault
            ? { terraOnly: true }
            : {}),
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
    // "Fast vault" is a structural property of the signers, not the
    // crypto protocol: a 2-of-2 vault where one party is VultiServer and
    // the other is the user's device. This holds regardless of whether
    // the keyshares are DKLS-keygen'd or KEY-IMPORTed — both protocols
    // produce fast vaults when the signer set is (device, Server-XXX).
    //
    // We previously gated on `libType === DKLS`, which incorrectly
    // classified post-#93 seed-imported fast vaults (stored as KEYIMPORT
    // because that's what `setupKeyImport` registers them as on the
    // server) as multi-share, surfacing the wrong "Vault" chip in
    // WalletList instead of "Fast Vault".
    //
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
 * Returns true if the stored vault for `walletName` cannot derive multi-chain
 * addresses correctly when imported into Vultisig.
 *
 * Discriminator: DKLS && empty publicKeyEddsa && all-zeros hexChainCode.
 *
 * This shape is shared by two distinct flows:
 *
 * - Pre-#93 fresh-create / seed-recover: registered the m/330 child (or a
 *   random secp256k1 privkey) as the MPC root with a placeholder zero chain
 *   code. Non-Terra addresses derived from this root are phantom — they don't
 *   match what the same seed produces in Metamask/Phantom/Keplr/etc.
 *
 * - Legacy private-key migrate: the pre-#93 storage path was shared with
 *   fresh-create, so legacy migrates also land in this shape. Those vaults
 *   are Terra-only by design (the user never had a master seed — only the
 *   Terra-derived AES-encrypted private key), so the same warning copy
 *   ("may show incorrect addresses on non-Terra chains") applies honestly.
 *
 * On disk, these two flows are indistinguishable by protobuf alone (both
 * lack a master pubkey + chain code, both register one Terra chainPublicKey,
 * etc.). The auth data also doesn't preserve provenance reliably across
 * upgrade paths. We therefore over-flag conservatively: any DKLS vault with
 * the broken shape gets the warning. Legacy private-key users can't act on
 * the warning (no seed to re-import), but the warning copy is still true
 * for them — their non-Terra addresses in Vultisig are not usable.
 *
 * Returns false for:
 * - Missing vaults (no stored proto)
 * - Post-#93 DKLS vaults (have non-empty publicKeyEddsa and non-zero hexChainCode)
 * - KEYIMPORT seed-recover vaults (post-#93, have eddsa + chain code + 36 chainPublicKeys)
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
      decoded.hexChainCode === '0'.repeat(64)
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
