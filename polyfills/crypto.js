// Minimal crypto module polyfill for Hermes compatibility
// The main terra.js crypto operations are handled by the terra.js polyfill
// using @noble/hashes and elliptic directly. This polyfill handles any other
// code that tries to import node's crypto module.

var { Buffer } = require('buffer');

function randomBytes(size) {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new Error('No secure random number generator available');
  }
  var arr = new Uint8Array(size);
  globalThis.crypto.getRandomValues(arr);
  return Buffer.from(arr);
}

// Minimal createHash using @noble/hashes
function createHash(algorithm) {
  var hashFn;
  if (algorithm === 'sha256') {
    hashFn = require('@noble/hashes/sha2.js').sha256;
  } else if (algorithm === 'sha512') {
    hashFn = require('@noble/hashes/sha2.js').sha512;
  } else if (algorithm === 'ripemd160' || algorithm === 'rmd160') {
    hashFn = require('@noble/hashes/legacy.js').ripemd160;
  } else {
    throw new Error('Unsupported hash algorithm: ' + algorithm);
  }

  var data = [];
  return {
    update: function(input) {
      if (typeof input === 'string') {
        data.push(Buffer.from(input));
      } else {
        data.push(Buffer.from(input));
      }
      return this;
    },
    digest: function(encoding) {
      var combined = Buffer.concat(data);
      var result = Buffer.from(hashFn(combined));
      if (encoding === 'hex') return result.toString('hex');
      if (encoding === 'base64') return result.toString('base64');
      return result;
    },
  };
}

// Minimal createHmac using @noble/hashes
function createHmac(algorithm, key) {
  var hashFn;
  if (algorithm === 'sha256') {
    hashFn = require('@noble/hashes/sha2.js').sha256;
  } else if (algorithm === 'sha512') {
    hashFn = require('@noble/hashes/sha2.js').sha512;
  } else {
    throw new Error('Unsupported HMAC algorithm: ' + algorithm);
  }

  var hmacFn = require('@noble/hashes/hmac.js').hmac;
  var keyBuf = typeof key === 'string' ? Buffer.from(key) : Buffer.from(key);
  var data = [];
  return {
    update: function(input) {
      if (typeof input === 'string') {
        data.push(Buffer.from(input));
      } else {
        data.push(Buffer.from(input));
      }
      return this;
    },
    digest: function(encoding) {
      var combined = Buffer.concat(data);
      var result = Buffer.from(hmacFn(hashFn, keyBuf, combined));
      if (encoding === 'hex') return result.toString('hex');
      if (encoding === 'base64') return result.toString('base64');
      return result;
    },
  };
}

module.exports = {
  createHash: createHash,
  createHmac: createHmac,
  randomBytes: randomBytes,
  getRandomValues: function(arr) {
    if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
      throw new Error('No secure random number generator available');
    }
    return globalThis.crypto.getRandomValues(arr);
  },
};
