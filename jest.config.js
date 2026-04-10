module.exports = {
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^react-native-url-polyfill/auto$': '<rootDir>/__mocks__/empty.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.{js,ts,tsx}',
    '**/__test__/**/*.test.{js,ts,tsx}',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure|react-native|react-native-url-polyfill)/)',
  ],
}
