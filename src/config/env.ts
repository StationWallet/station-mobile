export const env = {
  relayUrl: 'https://api.vultisig.com/router',
  vultisigApiUrl: 'https://api.vultisig.com',
} as const

/** Set to `true` when the full migration/vault-creation flow is ready to ship. */
export const MIGRATION_FLOW_ENABLED =
  process.env.EXPO_PUBLIC_MIGRATION_FLOW_ENABLED !== 'false'

const showDevFeatures =
  __DEV__ && process.env.EXPO_PUBLIC_SHOW_DEV_FEATURES === 'true'

export const DevFlags = {
  CryptoTestScreen: showDevFeatures,
  FullE2ETest: showDevFeatures,
  SeedLegacyData: showDevFeatures,
  SeedCorruptData: showDevFeatures,
  VerifyVault: showDevFeatures,
} as const
