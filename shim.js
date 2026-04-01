// Minimal shims for Expo
if (typeof __dirname === 'undefined') global.__dirname = '/'
if (typeof __filename === 'undefined') global.__filename = ''

if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer
}

if (typeof process === 'undefined') {
  global.process = require('process')
}
// Must be false — node-forge, pbkdf2, and other deps check this to select
// Node.js-compatible code paths (nextTick, native crypto, binary encoding).
// Setting to true or removing breaks crypto operations.
process.browser = false
