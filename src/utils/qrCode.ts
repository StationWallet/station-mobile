import { UTIL } from 'consts'
import _ from 'lodash'

export const schemeUrl = {
  recoverWallet: /^terrastation:(|\/\/)wallet_recover\/\?payload=/,
  send: /^terrastation:(|\/\/)send\/\?payload=/,
}

export const getRecoverWalletDataFromPayload = (
  payload: string
): RecoverWalletSchemeDataType | undefined => {
  const bufferString = UTIL.fromBase64(payload)
  return UTIL.jsonTryParse<RecoverWalletSchemeDataType>(bufferString)
}

export const checkIfRecoverWalletQrCodeDataType = (
  data: RecoverWalletSchemeDataType
): boolean => {
  return (
    _.some(data) &&
    typeof data === 'object' &&
    'address' in data &&
    'name' in data &&
    'encrypted_key' in data
  )
}

export const createRecoverWalletPayload = (
  props: RecoverWalletSchemeDataType
): string => UTIL.toBase64(UTIL.jsonTryStringify(props))

export const createRecoverWalletSchemeUrl = (
  props: RecoverWalletSchemeDataType
): string => {
  const payload = createRecoverWalletPayload(props)
  return `terrastation://wallet_recover/?payload=${payload}`
}

// Matches a base64 (incl. URL-safe + padded) string of at least 16 chars.
// Pre-filter for the bare-payload branch so we don't even attempt to base64
// decode obvious non-payloads (64-char hex keys, mnemonics with spaces,
// deeplinks, etc). A real SPA payload is ~250+ chars; 16 is a safe floor.
const BARE_BASE64_PAYLOAD = /^[A-Za-z0-9+/_=-]{16,}$/

/**
 * Try to interpret a pasted/scanned string as a Station legacy-SPA wallet
 * recovery payload. Accepts both shapes the legacy app emits:
 *   1. `terrastation://wallet_recover/?payload=<base64>` (deeplink / QR)
 *   2. `<base64>`                                       (bare payload)
 *
 * Returns the parsed `{name, address, encrypted_key}` object, or null when
 * the input is anything else (hex private key, garbage, etc).
 *
 * Centralized here so multiple entry points (RecoverSeed, ImportPrivateKey)
 * stay in sync on what counts as a recovery payload.
 */
export const detectRecoveryPayload = (
  input: string
): RecoverWalletSchemeDataType | null => {
  const value = input.trim()
  if (!value) return null

  if (schemeUrl.recoverWallet.test(value)) {
    const payload = value.replace(schemeUrl.recoverWallet, '')
    const data = getRecoverWalletDataFromPayload(payload)
    if (data && checkIfRecoverWalletQrCodeDataType(data)) return data
    return null
  }

  if (BARE_BASE64_PAYLOAD.test(value)) {
    const data = getRecoverWalletDataFromPayload(value)
    if (data && checkIfRecoverWalletQrCodeDataType(data)) return data
  }

  return null
}
