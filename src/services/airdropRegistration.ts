import { fromBinary } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha512 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { base64 } from '@scure/base'

import { env } from '../config/env'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import type { Vault } from '../proto/vultisig/vault/v1/vault_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import preferences, {
  PreferencesEnum,
} from '../nativeModules/preferences'
import {
  getAuthData,
  type AuthDataValueType,
  type LedgerDataValueType,
} from '../utils/authData'
import { bytesToHex, hexToBytes } from '../utils/mpcCrypto'
import { getStoredVault } from './migrateToVault'

export type AirdropRegistrationSource =
  | 'seed'
  | 'vault_share'
  | 'create'
export type AirdropBucket = 'station_migration' | 'campaign_new'

export type AirdropRegistrationPayload = {
  source: AirdropRegistrationSource
  bucket: AirdropBucket
  recipient_address: string
}

export type AirdropRegistrationCandidate =
  AirdropRegistrationPayload & {
    walletName: string
    publicKeyEcdsa: string
  }

export type AirdropBlockedReason =
  | 'invalid_vault'
  | 'legacy_terra_only'
  | 'missing_auth_token'
  | 'missing_trustworthy_evm_recipient'
  | 'registration_rejected'
  | 'registration_window_closed'
  | 'unknown_registration_source'

export type AirdropVaultClassification =
  | {
      status: 'registerable'
      source: AirdropRegistrationSource
      bucket: AirdropBucket
      recipientAddress: string
      publicKeyEcdsa: string
    }
  | {
      status: 'blocked'
      reason: AirdropBlockedReason
      publicKeyEcdsa?: string
    }

export type AirdropRegistrationRecord = {
  status: 'registered' | 'blocked' | 'failed'
  walletName: string
  publicKeyEcdsa: string
  source?: AirdropRegistrationSource
  bucket?: AirdropBucket
  recipientAddress?: string
  reason?: AirdropBlockedReason | string
  updatedAt: string
  nextRetryAt?: string
}

export type AirdropRegistrationState = {
  version: 1
  records: Record<string, AirdropRegistrationRecord>
}

export type AirdropRegistrationSummary = {
  considered: number
  registered: number
  blocked: number
  failed: number
  skipped: number
}

type AuthEntry = AuthDataValueType | LedgerDataValueType

type RegisterAirdropOnLaunchOptions = {
  getAuthToken?: (
    candidate: AirdropRegistrationCandidate
  ) => Promise<string | null>
  fetchImpl?: typeof fetch
  now?: () => Date
}

const AIRDROP_RETRY_MS = 24 * 60 * 60 * 1000
const DEFAULT_STATE: AirdropRegistrationState = {
  version: 1,
  records: {},
}

const getCurrentDate = (): Date => new Date()

function normalizeCompressedPublicKeyHex(
  value: string
): string | null {
  const clean = value.replace(/^0x/i, '')
  if (!/^0[23][0-9a-fA-F]{64}$/.test(clean)) return null
  return clean.toLowerCase()
}

function normalizeChainCodeHex(value: string): string | null {
  const clean = value.replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) return null
  if (clean === '0'.repeat(64)) return null
  return clean.toLowerCase()
}

function toChecksumAddress(addressHex: string): string {
  const lower = addressHex.replace(/^0x/i, '').toLowerCase()
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)))
  let out = '0x'
  for (let i = 0; i < lower.length; i++) {
    out +=
      parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i]
  }
  return out
}

function ethAddressFromCompressedPublicKey(
  publicKeyHex: string
): string | null {
  const clean = normalizeCompressedPublicKeyHex(publicKeyHex)
  if (!clean) return null

  try {
    const point = secp256k1.Point.fromHex(clean)
    const uncompressed = point.toBytes(false)
    const hash = keccak_256(uncompressed.slice(1))
    return toChecksumAddress(bytesToHex(hash.slice(-20)))
  } catch {
    return null
  }
}

function deriveChildPublicKey(
  parentPublicKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number
): { publicKey: Uint8Array; chainCode: Uint8Array } {
  const data = new Uint8Array(37)
  data.set(parentPublicKey, 0)
  data[33] = (index >>> 24) & 0xff
  data[34] = (index >>> 16) & 0xff
  data[35] = (index >>> 8) & 0xff
  data[36] = index & 0xff

  const digest = hmac(sha512, parentChainCode, data)
  const tweak = BigInt(`0x${bytesToHex(digest.slice(0, 32))}`)
  const childPoint = secp256k1.Point.fromHex(
    bytesToHex(parentPublicKey)
  ).add(secp256k1.Point.BASE.multiply(tweak))

  return {
    publicKey: childPoint.toBytes(true),
    chainCode: digest.slice(32),
  }
}

function deriveCreatedVaultRecipient(vault: Vault): string | null {
  const publicKey = normalizeCompressedPublicKeyHex(
    vault.publicKeyEcdsa
  )
  const chainCode = normalizeChainCodeHex(vault.hexChainCode)
  if (!publicKey || !chainCode) return null

  try {
    let childPublicKey = hexToBytes(publicKey)
    let childChainCode = hexToBytes(chainCode)
    for (const index of [44, 60, 0, 0, 0]) {
      const child = deriveChildPublicKey(
        childPublicKey,
        childChainCode,
        index
      )
      childPublicKey = child.publicKey
      childChainCode = child.chainCode
    }
    return ethAddressFromCompressedPublicKey(
      bytesToHex(childPublicKey)
    )
  } catch {
    return null
  }
}

function deriveImportedEvmRecipient(vault: Vault): string | null {
  const ethereumKey = vault.chainPublicKeys.find(
    (entry) => entry.chain === 'Ethereum' && !entry.isEddsa
  )
  if (!ethereumKey?.publicKey) return null
  return ethAddressFromCompressedPublicKey(ethereumKey.publicKey)
}

function isStationMobileVault(vault: Vault): boolean {
  return vault.localPartyId.toLowerCase().startsWith('sdk-')
}

function isNonLedgerAuthEntry(
  entry?: AuthEntry
): entry is AuthDataValueType {
  return !!entry && entry.ledger !== true
}

function hasServerSigner(vault: Vault): boolean {
  return vault.signers.some((signer) =>
    signer.toLowerCase().startsWith('server-')
  )
}

function isLegacyTerraOnly(
  vault: Vault,
  authEntry?: AuthEntry
): boolean {
  if (isNonLedgerAuthEntry(authEntry) && authEntry.terraOnly) {
    return true
  }

  const hasOnlyTerraChains =
    vault.chainPublicKeys.length > 0 &&
    vault.chainPublicKeys.every(
      (entry) =>
        entry.chain === 'Terra' || entry.chain === 'TerraClassic'
    )

  return (
    vault.libType === LibType.KEYIMPORT &&
    hasOnlyTerraChains &&
    !vault.publicKeyEddsa &&
    !normalizeChainCodeHex(vault.hexChainCode)
  )
}

function bucketForSource(
  source: AirdropRegistrationSource
): AirdropBucket {
  return source === 'seed' ? 'station_migration' : 'campaign_new'
}

function classifyWithSource(
  vault: Vault,
  source: AirdropRegistrationSource
): AirdropVaultClassification {
  let recipient: string | null
  if (source === 'create') {
    recipient = deriveCreatedVaultRecipient(vault)
  } else {
    recipient =
      deriveImportedEvmRecipient(vault) ||
      deriveCreatedVaultRecipient(vault)
  }

  if (!recipient) {
    return {
      status: 'blocked',
      reason: 'missing_trustworthy_evm_recipient',
      publicKeyEcdsa: vault.publicKeyEcdsa,
    }
  }

  return {
    status: 'registerable',
    source,
    bucket: bucketForSource(source),
    recipientAddress: recipient,
    publicKeyEcdsa: vault.publicKeyEcdsa,
  }
}

export function classifyVaultForAirdropRegistration(
  vault: Vault,
  authEntry?: AuthEntry
): AirdropVaultClassification {
  if (!normalizeCompressedPublicKeyHex(vault.publicKeyEcdsa)) {
    return { status: 'blocked', reason: 'invalid_vault' }
  }

  if (isLegacyTerraOnly(vault, authEntry)) {
    return {
      status: 'blocked',
      reason: 'legacy_terra_only',
      publicKeyEcdsa: vault.publicKeyEcdsa,
    }
  }

  if (isNonLedgerAuthEntry(authEntry) && authEntry.airdropSource) {
    return classifyWithSource(vault, authEntry.airdropSource)
  }

  if (!isStationMobileVault(vault) || !hasServerSigner(vault)) {
    return {
      status: 'blocked',
      reason: 'unknown_registration_source',
      publicKeyEcdsa: vault.publicKeyEcdsa,
    }
  }

  if (vault.libType === LibType.DKLS) {
    return classifyWithSource(vault, 'create')
  }

  if (vault.libType === LibType.KEYIMPORT && vault.publicKeyEddsa) {
    return classifyWithSource(vault, 'seed')
  }

  return {
    status: 'blocked',
    reason: 'missing_trustworthy_evm_recipient',
    publicKeyEcdsa: vault.publicKeyEcdsa,
  }
}

function registrationKey(publicKeyEcdsa: string): string {
  return publicKeyEcdsa.toLowerCase()
}

export async function getAirdropRegistrationState(): Promise<AirdropRegistrationState> {
  const raw = await preferences.getString(
    PreferencesEnum.airdropRegistrationState
  )
  if (!raw) return { ...DEFAULT_STATE, records: {} }

  try {
    const parsed = JSON.parse(raw) as AirdropRegistrationState
    if (parsed.version === 1 && parsed.records) return parsed
  } catch {}

  return { ...DEFAULT_STATE, records: {} }
}

async function setAirdropRegistrationState(
  state: AirdropRegistrationState
): Promise<void> {
  await preferences.setString(
    PreferencesEnum.airdropRegistrationState,
    JSON.stringify(state)
  )
}

function isRetryDue(
  record: AirdropRegistrationRecord,
  now: Date
): boolean {
  if (!record.nextRetryAt) return true
  return Date.parse(record.nextRetryAt) <= now.getTime()
}

function shouldSkipRecord(
  record: AirdropRegistrationRecord | undefined,
  now: Date,
  hasAuthTokenProvider: boolean
): boolean {
  if (!record) return false
  if (record.status === 'registered') return true

  if (
    record.status === 'blocked' &&
    record.reason === 'missing_auth_token'
  ) {
    return !hasAuthTokenProvider && !isRetryDue(record, now)
  }

  if (record.status === 'blocked') return true
  return !isRetryDue(record, now)
}

function retryAt(now: Date): string {
  return new Date(now.getTime() + AIRDROP_RETRY_MS).toISOString()
}

function blockedRecord(
  walletName: string,
  publicKeyEcdsa: string,
  reason: AirdropBlockedReason,
  now: Date,
  candidate?: Partial<AirdropRegistrationCandidate>
): AirdropRegistrationRecord {
  return {
    status: 'blocked',
    walletName,
    publicKeyEcdsa,
    source: candidate?.source,
    bucket: candidate?.bucket,
    recipientAddress: candidate?.recipient_address,
    reason,
    updatedAt: now.toISOString(),
    nextRetryAt:
      reason === 'missing_auth_token' ? retryAt(now) : undefined,
  }
}

function failedRecord(
  candidate: AirdropRegistrationCandidate,
  reason: string,
  now: Date
): AirdropRegistrationRecord {
  return {
    status: 'failed',
    walletName: candidate.walletName,
    publicKeyEcdsa: candidate.publicKeyEcdsa,
    source: candidate.source,
    bucket: candidate.bucket,
    recipientAddress: candidate.recipient_address,
    reason,
    updatedAt: now.toISOString(),
    nextRetryAt: retryAt(now),
  }
}

function registeredRecord(
  candidate: AirdropRegistrationCandidate,
  now: Date
): AirdropRegistrationRecord {
  return {
    status: 'registered',
    walletName: candidate.walletName,
    publicKeyEcdsa: candidate.publicKeyEcdsa,
    source: candidate.source,
    bucket: candidate.bucket,
    recipientAddress: candidate.recipient_address,
    updatedAt: now.toISOString(),
  }
}

function parseErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: unknown
      code?: unknown
    }
    if (typeof parsed.error === 'string') return parsed.error
    if (typeof parsed.code === 'string') return parsed.code
  } catch {}
  return null
}

function classifyHttpFailure(
  status: number,
  body: string
):
  | { status: 'blocked'; reason: AirdropBlockedReason }
  | { status: 'failed'; reason: string } {
  const code = parseErrorCode(body)
  if (status === 401) {
    return { status: 'failed', reason: 'auth_failed' }
  }
  if (status === 403 && code === 'WINDOW_CLOSED') {
    return {
      status: 'blocked',
      reason: 'registration_window_closed',
    }
  }
  if (status >= 400 && status < 500) {
    return { status: 'blocked', reason: 'registration_rejected' }
  }
  return { status: 'failed', reason: code ?? `http_${status}` }
}

async function postAirdropRegistration(
  token: string,
  candidate: AirdropRegistrationCandidate,
  fetchImpl: typeof fetch
): Promise<
  { ok: true } | { ok: false; status: number; body: string }
> {
  const res = await fetchImpl(
    `${env.agentBackendUrl}/airdrop/register`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: candidate.source,
        bucket: candidate.bucket,
        recipient_address: candidate.recipient_address,
      }),
    }
  )

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: await res.text(),
    }
  }

  return { ok: true }
}

async function readStoredVault(
  walletName: string
): Promise<Vault | null> {
  const raw = await getStoredVault(walletName)
  if (!raw) return null
  try {
    return fromBinary(VaultSchema, base64.decode(raw))
  } catch {
    return null
  }
}

export async function registerAirdropOnLaunch({
  getAuthToken,
  fetchImpl = fetch,
  now = getCurrentDate,
}: RegisterAirdropOnLaunchOptions = {}): Promise<AirdropRegistrationSummary> {
  const summary: AirdropRegistrationSummary = {
    considered: 0,
    registered: 0,
    blocked: 0,
    failed: 0,
    skipped: 0,
  }
  const state = await getAirdropRegistrationState()
  const authData = await getAuthData()
  const hasAuthTokenProvider = typeof getAuthToken === 'function'

  for (const [walletName, authEntry] of Object.entries(
    authData ?? {}
  )) {
    if (authEntry.ledger) continue

    const vault = await readStoredVault(walletName)
    if (!vault) continue

    const currentTime = now()
    const classification = classifyVaultForAirdropRegistration(
      vault,
      authEntry
    )
    const publicKeyEcdsa =
      classification.publicKeyEcdsa || vault.publicKeyEcdsa

    if (!publicKeyEcdsa) continue
    summary.considered += 1

    const key = registrationKey(publicKeyEcdsa)
    const existing = state.records[key]
    if (
      shouldSkipRecord(existing, currentTime, hasAuthTokenProvider)
    ) {
      summary.skipped += 1
      continue
    }

    if (classification.status === 'blocked') {
      state.records[key] = blockedRecord(
        walletName,
        publicKeyEcdsa,
        classification.reason,
        currentTime
      )
      summary.blocked += 1
      continue
    }

    const candidate: AirdropRegistrationCandidate = {
      walletName,
      publicKeyEcdsa,
      source: classification.source,
      bucket: classification.bucket,
      recipient_address: classification.recipientAddress,
    }

    const token = hasAuthTokenProvider
      ? await getAuthToken(candidate)
      : null

    if (!token) {
      state.records[key] = blockedRecord(
        walletName,
        publicKeyEcdsa,
        'missing_auth_token',
        currentTime,
        candidate
      )
      summary.blocked += 1
      continue
    }

    try {
      const response = await postAirdropRegistration(
        token,
        candidate,
        fetchImpl
      )

      if (response.ok === true) {
        state.records[key] = registeredRecord(candidate, currentTime)
        summary.registered += 1
        continue
      }

      const failure = classifyHttpFailure(
        response.status,
        response.body
      )

      if (failure.status === 'blocked') {
        state.records[key] = blockedRecord(
          walletName,
          publicKeyEcdsa,
          failure.reason,
          currentTime,
          candidate
        )
        summary.blocked += 1
      } else {
        state.records[key] = failedRecord(
          candidate,
          failure.reason,
          currentTime
        )
        summary.failed += 1
      }
    } catch (error) {
      state.records[key] = failedRecord(
        candidate,
        error instanceof Error ? error.message : String(error),
        currentTime
      )
      summary.failed += 1
    }
  }

  await setAirdropRegistrationState(state)
  return summary
}
