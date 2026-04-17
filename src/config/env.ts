export const env = {
  relayUrl: 'https://api.vultisig.com/router',
  vultisigApiUrl: 'https://api.vultisig.com',
} as const

/** Set to `true` when the full migration/vault-creation flow is ready to ship. */
export const MIGRATION_FLOW_ENABLED =
  process.env.EXPO_PUBLIC_MIGRATION_FLOW_ENABLED === 'true'

const showDevFeatures =
  __DEV__ && process.env.EXPO_PUBLIC_SHOW_DEV_FEATURES === 'true'

export const DevFlags = {
  SeedLegacyData: showDevFeatures,
  SeedCorruptData: showDevFeatures,
  VerifyVault: showDevFeatures,
  StateReset: showDevFeatures,
} as const

// Gated on __DEV__ so production builds can never read a truthy value
// even if the env var is somehow set.
export const STUB_VULTISERVER =
  __DEV__ && process.env.EXPO_PUBLIC_STUB_VULTISERVER === 'true'
