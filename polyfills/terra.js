// Functional replacement for @terra-money/terra.js
// terra.js's deep dependency chain (bip32 -> tiny-secp256k1 native addon) crashes in Hermes.
// This provides REAL crypto implementations for MnemonicKey/RawKey/AccAddress using
// pure-JS libraries that work in Hermes, plus stubs for transaction/staking types.

const { Buffer } = require('buffer');
const bip39 = require('bip39');
const { bech32 } = require('bech32');

// Use @noble/hashes for hash functions (pure JS, Hermes-compatible)
const { sha256 } = require('@noble/hashes/sha2.js');
const { ripemd160 } = require('@noble/hashes/legacy.js');
const { HDKey } = require('@scure/bip32');

// Use elliptic for secp256k1 (pure JS, used by the secp256k1 package's fallback)
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// --- Address derivation ---

function hash160(buf) {
  return Buffer.from(ripemd160(sha256(buf)));
}

function pubKeyToAccAddress(compressedPubKey, prefix) {
  prefix = prefix || 'terra';
  const h = hash160(compressedPubKey);
  const words = bech32.toWords(h);
  return bech32.encode(prefix, words);
}

// --- SimplePublicKey ---
class SimplePublicKey {
  constructor(key) {
    // key is base64-encoded compressed public key
    this.key = key;
  }
  toProto() {
    return { key: this.key, typeUrl: '/cosmos.crypto.secp256k1.PubKey' };
  }
  toAmino() {
    return { type: 'tendermint/PubKeySecp256k1', value: this.key };
  }
  toData() {
    return this.toProto();
  }
  rawAddress() {
    const pubBytes = Buffer.from(this.key, 'base64');
    return hash160(pubBytes);
  }
  address() {
    const raw = this.rawAddress();
    return bech32.encode('terra', bech32.toWords(raw));
  }
  toString() {
    return this.key;
  }
}

// --- Key base class ---
class Key {
  constructor(publicKey) {
    this.publicKey = publicKey;
  }
  get accAddress() {
    if (this.publicKey) {
      return this.publicKey.address();
    }
    return '';
  }
  get valAddress() {
    if (this.publicKey) {
      const raw = this.publicKey.rawAddress();
      return bech32.encode('terravaloper', bech32.toWords(raw));
    }
    return '';
  }
  async createSignature() {
    throw new Error('createSignature not implemented in POC mock');
  }
  async createSignatureAmino() {
    throw new Error('createSignatureAmino not implemented in POC mock');
  }
  async signTx(_tx, _options, _isClassic) {
    // Transaction signing stub - the actual signing flow requires
    // full protobuf serialization which is handled by the WebView.
    // This is here to prevent crashes if the code path is reached.
    throw new Error('signTx requires full terra.js - use WebView signing flow');
  }
}

// --- RawKey ---
class RawKey extends Key {
  constructor(privateKey) {
    const privBuf = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
    const kp = ec.keyFromPrivate(privBuf);
    const compressedPub = Buffer.from(kp.getPublic(true, 'array'));
    const pubKeyBase64 = compressedPub.toString('base64');
    super(new SimplePublicKey(pubKeyBase64));
    this.privateKey = privBuf;
  }

  ecdsaSign(payload) {
    const hash = Buffer.from(sha256(payload));
    const sig = ec.sign(hash, this.privateKey, { canonical: true });
    const r = sig.r.toArray('be', 32);
    const s = sig.s.toArray('be', 32);
    const signature = new Uint8Array(64);
    signature.set(r, 0);
    signature.set(s, 32);
    return { signature, recid: sig.recoveryParam };
  }

  async sign(payload) {
    const { signature } = this.ecdsaSign(payload);
    return Buffer.from(signature);
  }
}

// --- MnemonicKey (FUNCTIONAL) ---
const LUNA_COIN_TYPE = 330;

class MnemonicKey extends RawKey {
  constructor(options) {
    options = options || {};
    const account = options.account !== undefined ? options.account : 0;
    const index = options.index !== undefined ? options.index : 0;
    const coinType = options.coinType !== undefined ? options.coinType : LUNA_COIN_TYPE;

    let mnemonic = options.mnemonic;
    if (!mnemonic) {
      mnemonic = bip39.generateMnemonic(256);
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive(`m/44'/${coinType}'/${account}'/0/${index}`);

    if (!derived.privateKey) {
      throw new Error('Failed to derive key pair');
    }

    super(Buffer.from(derived.privateKey));
    this.mnemonic = mnemonic;
  }
}

// --- AccAddress ---
const AccAddress = {
  validate: function(addr) {
    try {
      if (typeof addr !== 'string') return false;
      const decoded = bech32.decode(addr);
      if (decoded.prefix !== 'terra') return false;
      const data = bech32.fromWords(decoded.words);
      return data.length === 20;
    } catch (e) {
      return false;
    }
  },
  fromValAddress: function(addr) {
    try {
      const decoded = bech32.decode(addr);
      return bech32.encode('terra', decoded.words);
    } catch (e) {
      return addr;
    }
  },
};

// --- ValAddress ---
const ValAddress = {
  validate: function(addr) {
    try {
      if (typeof addr !== 'string') return false;
      const decoded = bech32.decode(addr);
      return decoded.prefix === 'terravaloper' && decoded.words.length > 0;
    } catch (e) {
      return false;
    }
  },
};

// --- Coin ---
class Coin {
  constructor(denom, amount) {
    this.denom = denom;
    this.amount = amount ? amount.toString() : '0';
  }
  toString() { return `${this.amount}${this.denom}`; }
  toData() { return { denom: this.denom, amount: this.amount }; }
  toAmino() { return this.toData(); }
  toProto() { return this.toData(); }
  static fromData(data) { return new Coin(data.denom, data.amount); }
  static fromAmino(data) { return Coin.fromData(data); }
  static fromProto(data) { return Coin.fromData(data); }
  add(other) {
    if (other.denom !== this.denom) throw new Error('Denom mismatch');
    return new Coin(this.denom, (BigInt(this.amount) + BigInt(other.amount)).toString());
  }
}

// --- Coins ---
class Coins {
  constructor(coins) {
    if (Array.isArray(coins)) {
      this.coins = coins;
    } else if (coins && typeof coins === 'object') {
      this.coins = Object.entries(coins).map(([denom, amount]) => new Coin(denom, amount));
    } else {
      this.coins = [];
    }
  }
  get(denom) { return this.coins.find(c => c.denom === denom); }
  toData() { return this.coins.map(c => c.toData ? c.toData() : c); }
  toAmino() { return this.toData(); }
  toProto() { return this.toData(); }
  static fromData(data) { return new Coins((data || []).map(d => Coin.fromData(d))); }
  static fromAmino(data) { return Coins.fromData(data); }
  static fromProto(data) { return Coins.fromData(data); }
  [Symbol.iterator]() { return this.coins[Symbol.iterator](); }
  map(fn) { return this.coins.map(fn); }
  filter(fn) { return new Coins(this.coins.filter(fn)); }
}

// --- Msg serialization helpers ---
function serializeCoin(c) {
  if (c && typeof c.toProto === 'function') return c.toProto();
  if (c && typeof c.toData === 'function') return c.toData();
  return c;
}

function serializeCoins(c) {
  if (c && typeof c.toProto === 'function') return c.toProto();
  if (Array.isArray(c)) return c.map(serializeCoin);
  return c;
}

// --- Msg types ---
class Msg {
  static fromData(data) { return data; }
  static fromAmino(data) { return data; }
  static fromProto(data) { return data; }
  toData() { return this.toProto(); }
}

class MsgSend extends Msg {
  constructor(from_address, to_address, amount) {
    super();
    this.from_address = from_address;
    this.to_address = to_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.bank.v1beta1.MsgSend',
      from_address: this.from_address,
      to_address: this.to_address,
      amount: serializeCoins(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgSend',
      value: {
        from_address: this.from_address,
        to_address: this.to_address,
        amount: serializeCoins(this.amount),
      },
    };
  }
}

class MsgExecuteContract extends Msg {
  constructor(sender, contract, execute_msg, coins) {
    super();
    this.sender = sender;
    this.contract = contract;
    this.execute_msg = execute_msg;
    this.coins = coins || new Coins([]);
  }
  toProto() {
    return {
      '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
      sender: this.sender,
      contract: this.contract,
      msg: this.execute_msg,
      funds: serializeCoins(this.coins),
    };
  }
  toAmino() {
    return {
      type: 'wasm/MsgExecuteContract',
      value: {
        sender: this.sender,
        contract: this.contract,
        execute_msg: this.execute_msg,
        coins: serializeCoins(this.coins),
      },
    };
  }
}

class MsgSwap extends Msg {
  constructor(trader, offer_coin, ask_denom) {
    super();
    this.trader = trader;
    this.offer_coin = offer_coin;
    this.ask_denom = ask_denom;
  }
  toProto() {
    return {
      '@type': '/terra.market.v1beta1.MsgSwap',
      trader: this.trader,
      offer_coin: serializeCoin(this.offer_coin),
      ask_denom: this.ask_denom,
    };
  }
  toAmino() {
    return {
      type: 'market/MsgSwap',
      value: {
        trader: this.trader,
        offer_coin: serializeCoin(this.offer_coin),
        ask_denom: this.ask_denom,
      },
    };
  }
}

class MsgDeposit extends Msg {
  constructor(proposal_id, depositor, amount) {
    super();
    this.proposal_id = proposal_id;
    this.depositor = depositor;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.gov.v1beta1.MsgDeposit',
      proposal_id: this.proposal_id,
      depositor: this.depositor,
      amount: serializeCoins(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgDeposit',
      value: {
        proposal_id: this.proposal_id,
        depositor: this.depositor,
        amount: serializeCoins(this.amount),
      },
    };
  }
}

class MsgWithdrawDelegatorReward extends Msg {
  constructor(delegator_address, validator_address) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
  }
  toProto() {
    return {
      '@type': '/cosmos.distribution.v1beta1.MsgWithdrawDelegationReward',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgWithdrawDelegationReward',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
      },
    };
  }
}

class MsgDelegate extends Msg {
  constructor(delegator_address, validator_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgDelegate',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgDelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}

class MsgBeginRedelegate extends Msg {
  constructor(delegator_address, validator_src_address, validator_dst_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_src_address = validator_src_address;
    this.validator_dst_address = validator_dst_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgBeginRedelegate',
      delegator_address: this.delegator_address,
      validator_src_address: this.validator_src_address,
      validator_dst_address: this.validator_dst_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgBeginRedelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_src_address: this.validator_src_address,
        validator_dst_address: this.validator_dst_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}

class MsgUndelegate extends Msg {
  constructor(delegator_address, validator_address, amount) {
    super();
    this.delegator_address = delegator_address;
    this.validator_address = validator_address;
    this.amount = amount;
  }
  toProto() {
    return {
      '@type': '/cosmos.staking.v1beta1.MsgUndelegate',
      delegator_address: this.delegator_address,
      validator_address: this.validator_address,
      amount: serializeCoin(this.amount),
    };
  }
  toAmino() {
    return {
      type: 'cosmos-sdk/MsgUndelegate',
      value: {
        delegator_address: this.delegator_address,
        validator_address: this.validator_address,
        amount: serializeCoin(this.amount),
      },
    };
  }
}

// --- Fee ---
class Fee {
  constructor(gasLimit, amount, payer, granter) {
    this.gas_limit = gasLimit;
    this.amount = amount;
    this.payer = payer || '';
    this.granter = granter || '';
  }
  toData() { return { gas_limit: this.gas_limit, amount: this.amount, payer: this.payer, granter: this.granter }; }
  toAmino() { return this.toData(); }
  toProto() { return this.toData(); }
  static fromData(data) { return new Fee(data.gas_limit, data.amount, data.payer, data.granter); }
  static fromAmino(data) { return Fee.fromData(data); }
  static fromProto(data) { return Fee.fromData(data); }
}

// --- Tx ---
class Tx {
  constructor(body, auth_info, signatures) {
    this.body = body || {};
    this.auth_info = auth_info || {};
    this.signatures = signatures || [];
  }
  toData() { return { body: this.body, auth_info: this.auth_info, signatures: this.signatures }; }
  static fromData(data) { return new Tx(data.body, data.auth_info, data.signatures); }
  static fromAmino(data) { return Tx.fromData(data); }
  appendEmptySignatures() {}
}

class TxInfo {
  constructor(data) { Object.assign(this, data || {}); }
}

// --- Wallet (LCDClient wallet) ---
class Wallet {
  constructor(lcd, key) {
    this.lcd = lcd;
    this.key = key;
  }
  async accountNumberAndSequence() {
    return { account_number: 0, sequence: 0 };
  }
  async createAndSignTx() {
    return new Tx();
  }
}

// --- SignDoc ---
class SignDoc {
  constructor(chainID, accountNumber, sequence, authInfo, body) {
    this.chain_id = chainID;
    this.account_number = accountNumber;
    this.sequence = sequence;
    this.auth_info = authInfo;
    this.body = body;
  }
}

// --- SignatureV2 ---
const SignatureV2 = {
  SignMode: {
    SIGN_MODE_DIRECT: 1,
    SIGN_MODE_LEGACY_AMINO_JSON: 127,
  },
};

// --- LCDClient ---
class LCDClient {
  constructor(config) {
    this.config = config;
    this.chainID = config?.chainID || 'phoenix-1';
    this.URL = config?.URL || '';
  }
  wallet(key) {
    return new Wallet(this, key);
  }
  get tx() {
    return {
      create: async () => new Tx(),
      broadcastSync: async () => ({ txhash: '', raw_log: '' }),
      broadcast: async () => ({ txhash: '', raw_log: '' }),
      hash: async () => '',
      txInfo: async () => new TxInfo(),
      decode: () => new Tx(),
    };
  }
  get auth() {
    return {
      accountInfo: async () => ({
        getAccountNumber: () => 0,
        getSequenceNumber: () => 0,
        account_number: 0,
        sequence: 0,
      }),
    };
  }
  get bank() {
    return {
      balance: async () => [new Coins([])],
      total: async () => new Coins([]),
    };
  }
  get staking() {
    return {
      validators: async () => [[]],
      delegations: async () => [[]],
      unbondingDelegations: async () => [[]],
      delegation: async () => null,
    };
  }
  get distribution() {
    return {
      rewards: async () => ({ total: new Coins([]), rewards: {} }),
    };
  }
  get oracle() {
    return {
      parameters: async () => ({}),
      exchangeRates: async () => new Coins([]),
    };
  }
  get ibc() {
    return {
      denomTrace: async () => ({ denom_trace: { path: '', base_denom: '' } }),
    };
  }
}

// --- isTxError ---
function isTxError(result) {
  return !!(result && result.code && result.code !== 0);
}

// --- Misc type stubs ---
const CreateTxOptions = {};
const Validator = {};
const UnbondingDelegation = {};
const Delegation = {};
const Rewards = {};
const OracleParams = {};
const Vote = {};
const SyncTxBroadcastResult = {};

function Dec(v) { return { toString: () => String(v), toFixed: (n) => Number(v).toFixed(n) }; }
function Int(v) { return { toString: () => String(v) }; }

module.exports = {
  // Functional crypto
  Key,
  RawKey,
  MnemonicKey,
  SimplePublicKey,
  LUNA_COIN_TYPE,

  // Address validation (functional, uses bech32)
  AccAddress,
  ValAddress,

  // Data types
  Coin,
  Coins,
  Fee,
  Tx,
  TxInfo,
  Wallet,
  SignDoc,
  SignatureV2,
  SyncTxBroadcastResult,

  // Msg types
  Msg,
  MsgSend,
  MsgExecuteContract,
  MsgSwap,
  MsgDeposit,
  MsgWithdrawDelegatorReward,
  MsgDelegate,
  MsgBeginRedelegate,
  MsgUndelegate,

  // Client
  LCDClient,
  CreateTxOptions,

  // Utilities
  isTxError,
  Dec,
  Int,

  // Staking type stubs (used as TS types mostly)
  Validator,
  UnbondingDelegation,
  Delegation,
  Rewards,
  OracleParams,
  Vote,
};
