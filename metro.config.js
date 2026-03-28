const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Node.js built-in polyfills for packages that need them (terra.js, ledger, etc.)
config.resolver.extraNodeModules = {
  crypto: path.resolve(__dirname, 'mocks/crypto-shim.js'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
  events: require.resolve('events'),
  url: require.resolve('react-native-url-polyfill'),
}

// Mock packages that crash in Hermes or need native modules not available on simulator
const ledgerMock = path.resolve(__dirname, 'mocks/ledger-transport-ble.js')
const ledgerTerraMock = path.resolve(__dirname, 'mocks/ledger-terra-js.js')
const terraJsMock = path.resolve(__dirname, 'mocks/terra-js-safe.js')

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
