// Minimal crypto module polyfill for Hermes compatibility
// The main terra.js crypto operations are handled by the terra.js polyfill
// using @noble/hashes and elliptic directly. This polyfill handles any other
// code that tries to import node's crypto module.

var { Buffer } = require('buffer');

function randomBytes(size) {
  var arr = new Uint8Array(size);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  }
  return Buffer.from(arr);
}

// Minimal createHash using @noble/hashes
function createHash(algorithm) {
  var hashFn;
  if (algorithm === 'sha256') {
    hashFn = require('@noble/hashes/sha256').sha256;
  } else if (algorithm === 'sha512') {
    hashFn = require('@noble/hashes/sha512').sha512;
  } else if (algorithm === 'ripemd160' || algorithm === 'rmd160') {
    hashFn = require('@noble/hashes/ripemd160').ripemd160;
  } else {
    return {
      update: function() { return this; },
      digest: function() { return Buffer.alloc(32); },
    };
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
  var hmacFn = require('@noble/hashes/hmac').hmac;
  var hashFn;
  if (algorithm === 'sha256') {
    hashFn = require('@noble/hashes/sha256').sha256;
  } else if (algorithm === 'sha512') {
    hashFn = require('@noble/hashes/sha512').sha512;
  } else {
    return {
      update: function() { return this; },
      digest: function() { return Buffer.alloc(32); },
    };
  }

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
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      return globalThis.crypto.getRandomValues(arr);
    }
    return arr;
  },
};
