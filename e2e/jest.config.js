/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 300000,
  bail: 1,
  maxWorkers: 1,
  globalSetup: '<rootDir>/e2e/globalSetup.js',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  modulePathIgnorePatterns: [
    '<rootDir>/.worktrees/',
    '<rootDir>/.claude/',
    '<rootDir>/e2e/smoke/',
  ],
}
