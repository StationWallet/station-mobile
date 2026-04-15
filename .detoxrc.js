/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Vultisig.app',
      build: 'xcodebuild -workspace ios/Vultisig.xcworkspace -scheme Vultisig -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build && set -a && source .env.test && set +a && npx expo export:embed --entry-file index.js --platform ios --dev true --bundle-output ios/build/Build/Products/Debug-iphonesimulator/Vultisig.app/main.jsbundle --assets-dest ios/build/Build/Products/Debug-iphonesimulator/Vultisig.app',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Vultisig.app',
      build: 'xcodebuild -workspace ios/Vultisig.xcworkspace -scheme Vultisig -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
