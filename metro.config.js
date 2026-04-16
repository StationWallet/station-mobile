const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Add .riv files as asset extensions so Metro can bundle them via require()
// Must also remove from sourceExts (Expo default config filters assetExts against sourceExts)
config.resolver.sourceExts = (
  config.resolver.sourceExts || []
).filter((ext) => ext !== 'riv')
config.resolver.assetExts.push('riv')

// Package exports resolution for @noble/* and @scure/* libraries.
// Note: unstable_enablePackageExports is disabled because react-navigation v6
// and react-native-safe-area-context have broken "react-native" fields.
// If @noble/* imports fail, re-enable with targeted workarounds.
// config.resolver.unstable_enablePackageExports = true
// config.resolver.unstable_conditionNames = ['react-native', 'require', 'default']

// Node.js built-in polyfills for packages that need them (terra.js, ledger, etc.)
config.resolver.extraNodeModules = {
  crypto: path.resolve(__dirname, 'polyfills/crypto.js'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
  events: require.resolve('events'),
  url: require.resolve('react-native-url-polyfill'),
}

// Polyfill packages that crash in Hermes or need native modules not available on simulator
const ledgerMock = path.resolve(
  __dirname,
  'polyfills/ledger-transport-ble.js'
)
const ledgerTerraMock = path.resolve(
  __dirname,
  'polyfills/ledger-terra-js.js'
)
const terraJsMock = path.resolve(__dirname, 'polyfills/terra.js')

// Workaround: watchman on ExFAT (case-insensitive) fails to crawl src/App/
// because "App" clashes with Expo Router's "app" directory detection.
// Resolve it explicitly so Metro can find the entry point.
const appIndexPath = path.resolve(
  __dirname,
  'src',
  'App',
  'index.tsx'
)

// Disable watchman — it can't crawl src/App/ on ExFAT (case-insensitive) drives.
// The directory name "App" collides with Expo Router's "app" convention on
// case-insensitive filesystems, causing watchman to skip all files inside it.
// Node's fs polling is slower for HMR but resolves all paths correctly.
config.watcher = {
  ...config.watcher,
  watchman: { enabled: false },
}
config.resolver.useWatchman = false

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Explicit resolve for ./src/App which watchman misses on ExFAT drives
  if (moduleName === './src/App' || moduleName === '../App') {
    return { type: 'sourceFile', filePath: appIndexPath }
  }
  // Intercept terra.js - crypto primitives crash in Hermes
  if (moduleName === '@terra-money/terra.js') {
    return { type: 'sourceFile', filePath: terraJsMock }
  }
  // Intercept all @ledgerhq imports
  if (moduleName.startsWith('@ledgerhq/')) {
    return { type: 'sourceFile', filePath: ledgerMock }
  }
  // Intercept ledger-terra-js
  if (moduleName.startsWith('@terra-money/ledger-terra-js')) {
    return { type: 'sourceFile', filePath: ledgerTerraMock }
  }
  // Default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
