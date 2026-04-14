export const env = {
  relayUrl: 'https://api.vultisig.com/router',
  vultisigApiUrl: 'https://api.vultisig.com',
} as const

/** Set to `true` when the full migration/vault-creation flow is ready to ship. */
export const MIGRATION_FLOW_ENABLED = false
