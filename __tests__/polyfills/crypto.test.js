const crypto = require('../../polyfills/crypto');

describe('randomBytes', () => {
  test('returns Buffer of requested size', () => {
    const result = crypto.randomBytes(32);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  test('returns non-zero bytes', () => {
    const result = crypto.randomBytes(32);
    const allZeros = result.every(b => b === 0);
    expect(allZeros).toBe(false);
  });

  test('two calls produce different output', () => {
    const a = crypto.randomBytes(32);
    const b = crypto.randomBytes(32);
    expect(a.equals(b)).toBe(false);
  });
});

describe('createHash', () => {
  test('sha256 produces correct hash', () => {
    const result = crypto.createHash('sha256').update('hello world').digest('hex');
    expect(result).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  test('sha512 produces correct hash', () => {
    const result = crypto.createHash('sha512').update('hello world').digest('hex');
    expect(result).toBe('309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f');
  });

  test('ripemd160 produces correct hash', () => {
    const result = crypto.createHash('ripemd160').update('hello world').digest('hex');
    expect(result).toBe('98c615784ccb5fe5936fbc0cbe9dfdb408d92f0f');
  });

  test('unsupported algorithm throws', () => {
    expect(() => crypto.createHash('md5')).toThrow('Unsupported hash algorithm: md5');
  });
});

describe('createHmac', () => {
  test('sha256 HMAC produces correct output', () => {
    const result = crypto.createHmac('sha256', 'secret-key').update('hello world').digest('hex');
    expect(result).toBe('095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67');
  });

  test('unsupported algorithm throws', () => {
    expect(() => crypto.createHmac('md5', 'key')).toThrow('Unsupported HMAC algorithm: md5');
  });
});
