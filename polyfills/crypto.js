// Minimal crypto module polyfill for Hermes compatibility
// The main terra.js crypto operations are handled by the terra.js polyfill
// using @noble/hashes and elliptic directly. This polyfill handles any other
// code that tries to import node's crypto module.

var { Buffer } = require('buffer');
var { sha256, sha512 } = require('@noble/hashes/sha2.js');
var { ripemd160 } = require('@noble/hashes/legacy.js');
var { hmac: hmacFn } = require('@noble/hashes/hmac.js');

// Minimal createHash using @noble/hashes
var hashAlgos = { sha256: sha256, sha512: sha512, ripemd160: ripemd160, rmd160: ripemd160 };

function createHash(algorithm) {
  var hashFn = hashAlgos[algorithm];
  if (!hashFn) throw new Error('Unsupported hash algorithm: ' + algorithm);

  var data = [];
  return {
    update: function(input) {
      data.push(Buffer.from(input));
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
var hmacAlgos = { sha256: sha256, sha512: sha512 };

function createHmac(algorithm, key) {
  var hashFn = hmacAlgos[algorithm];
  if (!hashFn) throw new Error('Unsupported HMAC algorithm: ' + algorithm);

  var keyBuf = Buffer.from(key);
  var data = [];
  return {
    update: function(input) {
      data.push(Buffer.from(input));
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

function getRandomValues(arr) {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new Error('No secure random number generator available');
  }
  return globalThis.crypto.getRandomValues(arr);
}

function randomBytes(size) {
  var arr = new Uint8Array(size);
  getRandomValues(arr);
  return Buffer.from(arr);
}

module.exports = {
  createHash: createHash,
  createHmac: createHmac,
  randomBytes: randomBytes,
  getRandomValues: getRandomValues,
};
