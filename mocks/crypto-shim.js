// Stub crypto module for Hermes compatibility
// crypto-browserify crashes in Hermes, so provide minimal stubs

module.exports = {
  createHash: function() { throw new Error('crypto not available in POC') },
  createHmac: function() { throw new Error('crypto not available in POC') },
  randomBytes: function(size) {
    var arr = new Uint8Array(size);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    }
    return Buffer.from(arr);
  },
  getRandomValues: function(arr) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(arr);
    }
    return arr;
  },
};
