module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/__test__/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure)/)',
  ],
}
