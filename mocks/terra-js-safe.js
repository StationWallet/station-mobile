// Safe proxy for @terra-money/terra.js
// terra.js crypto primitives crash in Hermes engine
// This provides stub implementations for the POC

const { Buffer } = require('buffer');

// Stub AccAddress
const AccAddress = {
  validate: function(addr) {
    try {
      // Basic bech32 validation without crypto
      return typeof addr === 'string' && addr.startsWith('terra1') && addr.length === 44;
    } catch (e) {
      return false;
    }
  },
  fromValAddress: function(addr) { return addr; },
};

// Stub ValAddress
const ValAddress = {
  validate: function(addr) {
    return typeof addr === 'string' && addr.startsWith('terravaloper1');
  },
};

// Stub Coin
class Coin {
  constructor(denom, amount) {
    this.denom = denom;
    this.amount = amount ? amount.toString() : '0';
  }
  toString() { return `${this.amount}${this.denom}`; }
  toData() { return { denom: this.denom, amount: this.amount }; }
  static fromData(data) { return new Coin(data.denom, data.amount); }
}

// Stub Coins
class Coins {
  constructor(coins) {
    this.coins = coins || [];
  }
  get(denom) { return this.coins.find(c => c.denom === denom); }
  toData() { return this.coins.map(c => c.toData ? c.toData() : c); }
  static fromData(data) { return new Coins((data || []).map(d => Coin.fromData(d))); }
  [Symbol.iterator]() { return this.coins[Symbol.iterator](); }
  map(fn) { return this.coins.map(fn); }
  filter(fn) { return new Coins(this.coins.filter(fn)); }
}

// Stub Msg
class Msg {
  static fromData(data) { return data; }
  static fromAmino(data) { return data; }
}

// Stub Fee
class Fee {
  constructor(gasLimit, amount, payer, granter) {
    this.gas_limit = gasLimit;
    this.amount = amount;
    this.payer = payer || '';
    this.granter = granter || '';
  }
  static fromData(data) { return data; }
  static fromAmino(data) { return data; }
}

// Stub SignDoc
class SignDoc {
  constructor(chainID, accountNumber, sequence, authInfo, body) {
    this.chain_id = chainID;
    this.account_number = accountNumber;
    this.sequence = sequence;
    this.auth_info = authInfo;
    this.body = body;
  }
}

// Stub SignatureV2
const SignatureV2 = {
  SignMode: {
    SIGN_MODE_DIRECT: 1,
    SIGN_MODE_LEGACY_AMINO_JSON: 127,
  },
};

// Stub LCDClient
class LCDClient {
  constructor(config) { this.config = config; }
  wallet() { return { accountNumberAndSequence: async () => ({ account_number: 0, sequence: 0 }) }; }
  get tx() { return { create: async () => ({}), broadcastSync: async () => ({}), decode: () => ({}) }; }
  get auth() { return { accountInfo: async () => ({ getAccountNumber: () => 0, getSequenceNumber: () => 0 }) }; }
}

// Stub MnemonicKey
class MnemonicKey {
  constructor(options) {
    this.mnemonic = options?.mnemonic || 'stub mnemonic';
    this.accAddress = 'terra1stubaddress000000000000000000000000';
    this.privateKey = Buffer.alloc(32);
    this.publicKey = null;
  }
}

// Stub CreateTxOptions
const CreateTxOptions = {};

module.exports = {
  AccAddress,
  ValAddress,
  Coin,
  Coins,
  Msg,
  Fee,
  SignDoc,
  SignatureV2,
  LCDClient,
  MnemonicKey,
  CreateTxOptions,
  Dec: function(v) { return { toString: () => String(v) }; },
  Int: function(v) { return { toString: () => String(v) }; },
};
