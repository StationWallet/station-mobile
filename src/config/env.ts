export const env = {
  relayUrl: 'https://api.vultisig.com/router',
  vultisigApiUrl: 'https://api.vultisig.com',
} as const

/**
 * When `true`, fresh installs boot into the dev `AuthMenu` (with seed/dev
 * buttons) instead of the production migration flow. Used by Detox E2E
 * tests to seed legacy-wallet fixtures before walking the migration path.
 */
export const BYPASS_AUTH_FOR_TESTING =
  process.env.EXPO_PUBLIC_BYPASS_AUTH_FOR_TESTING === 'true'

const showDevFeatures =
  __DEV__ && process.env.EXPO_PUBLIC_SHOW_DEV_FEATURES === 'true'

export const DevFlags = {
  SeedLegacyData: showDevFeatures,
  SeedLegacyDataAndroidV1: showDevFeatures,
  SeedCorruptData: showDevFeatures,
  VerifyVault: showDevFeatures,
  StateReset: showDevFeatures,
} as const

/**
 * Production-flippable flags. Default off; flipped via Expo env (OTA-deployable).
 *
 * - `OpenLegacyStationWebView`: exposes the "Open legacy Station (web)" link on
 *   MigrationHome. Disabled by default — users find their legacy wallets via the
 *   hidden discovery WebView instead, which surfaces them in the regular
 *   wallets-found list. The link is kept available for QA/support escalation.
 */
export const FeatureFlags = {
  OpenLegacyStationWebView:
    process.env.EXPO_PUBLIC_OPEN_LEGACY_STATION_WEBVIEW === 'true',
} as const

// Gated on __DEV__ so production builds can never read a truthy value
// even if the env var is somehow set.
export const STUB_VULTISERVER =
  __DEV__ && process.env.EXPO_PUBLIC_STUB_VULTISERVER === 'true'
