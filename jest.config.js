module.exports = {
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^react-native-url-polyfill/auto$': '<rootDir>/__mocks__/empty.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo/virtual/env$': '<rootDir>/__mocks__/expo-virtual-env.js',
    '^expo-secure-store$':
      '<rootDir>/__tests__/__mocks__/expo-secure-store.ts',
    '^nativeModules/preferences$':
      '<rootDir>/__tests__/__mocks__/preferences.ts',
    '^.*/modules/legacy-keystore-migration/src$':
      '<rootDir>/__tests__/__mocks__/legacy-keystore.ts',
    '^expo-crypto$': '<rootDir>/__tests__/__mocks__/expo-crypto.ts',
  },
  testMatch: [
    '**/__tests__/**/*.test.{js,ts,tsx}',
    '**/__test__/**/*.test.{js,ts,tsx}',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure|react-native|react-native-url-polyfill)/)',
  ],
}
