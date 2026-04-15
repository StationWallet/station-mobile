const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Add .riv files as asset extensions so Metro can bundle them via require()
// Must also remove from sourceExts (Expo default config filters assetExts against sourceExts)
config.resolver.sourceExts = (config.resolver.sourceExts || []).filter(ext => ext !== 'riv')
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
const ledgerMock = path.resolve(__dirname, 'polyfills/ledger-transport-ble.js')
const ledgerTerraMock = path.resolve(__dirname, 'polyfills/ledger-terra-js.js')
const terraJsMock = path.resolve(__dirname, 'polyfills/terra.js')

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
