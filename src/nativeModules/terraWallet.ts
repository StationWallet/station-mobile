import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import secp256k1 from 'secp256k1';
import { sha256, ripemd160 } from 'hash.js';
import { Buffer } from 'buffer';
import sortKeys from 'sort-keys';

export interface WalletDetails {
  privateKey: string;
  publicKey: string;
  publicKey64: string;
  address: string;
  mnemonic: string;
}

export interface Fee {
  amount: Array<{
    denom: string;
    amount: string;
  }>;
  gas: string;
}

export interface Message {
  type: string;
  value: any;
}

export interface TransactionPayload {
  fee: Fee;
  msgs: Message[];
  memo: string;
}

export interface PublicKey {
  type: string;
  value: string;
}

export interface SignedTransaction {
  signature: string;
  publicKey: PublicKey;
}

export class TerraWallet {
  static async getNewWallet(): Promise<WalletDetails> {
    try {
      const mnemonic = bip39.generateMnemonic();
      const wallet = await TerraWallet.getNewWalletFromSeed(mnemonic, 330);
      return wallet;
    } catch (error: any) {
      throw new Error(`Failed to generate wallet: ${error.message}`);
    }
  }

  static async getNewWalletFromSeed(mnemonic: string, bip: number = 330): Promise<WalletDetails> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic');
      }

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const node = bip32.fromSeed(seed);
      const childNode = node.derivePath(`m/44'/${bip}'/0'/0/0`);

      const privateKey = childNode.privateKey;
      if (!privateKey) {
        throw new Error('Could not derive private key');
      }

      const publicKey = secp256k1.publicKeyCreate(privateKey, true);
      const publicKeyUncompressed = secp256k1.publicKeyCreate(privateKey, false);

      const address = TerraWallet.createTerraAddress(publicKey);

      return {
        privateKey: Buffer.from(privateKey).toString('hex'),
        publicKey: Buffer.from(publicKey).toString('hex'),
        publicKey64: Buffer.from(publicKeyUncompressed).toString('base64'),
        address,
        mnemonic
      };
    } catch (error: any) {
      throw new Error(`Failed to generate wallet from seed: ${error.message}`);
    }
  }

  static createTerraAddress(publicKey: Uint8Array): string {
    // Hash the public key with SHA256, then RIPEMD160
    const sha256Hash = sha256().update(publicKey).digest();
    const ripemd160Hash = ripemd160().update(sha256Hash).digest();

    // Convert the hash to Uint8Array
    const hashArray = Uint8Array.from(ripemd160Hash);

    const terraPrefix = 'terra';

    const words = TerraWallet.convertBits(hashArray, 8, 5, true);
    const address = TerraWallet.bech32Encode(terraPrefix, words);

    return address;
  }

  static convertBits(data: Uint8Array | number[], fromBits: number, toBits: number, pad: boolean): Uint8Array {
    // Ensure data is Uint8Array
    const uintData = Array.isArray(data) ? Uint8Array.from(data) : data;

    let acc = 0;
    let bits = 0;
    const result = [];
    const maxv = (1 << toBits) - 1;

    for (let i = 0; i < uintData.length; i++) {
      const value = uintData[i];
      acc = (acc << fromBits) | value;
      bits += fromBits;

      while (bits >= toBits) {
        bits -= toBits;
        result.push((acc >> bits) & maxv);
      }
    }

    if (pad && bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }

    return Uint8Array.from(result);
  }

  static bech32Encode(prefix: string, words: Uint8Array): string {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    let result = prefix + '1';
    for (let i = 0; i < words.length; i++) {
      result += CHARSET.charAt(words[i]);
    }

    for (let i = 0; i < 6; i++) {
      result += CHARSET.charAt(0);
    }

    return result;
  }

  static async sign(
      message: TransactionPayload,
      sequence: string,
      account_number: string,
      chain_id: string,
      hexPrivateKey: string,
      hexPublicKey: string
  ): Promise<SignedTransaction> {
    try {
      const privateKey = Buffer.from(hexPrivateKey, 'hex');

      const signDoc = {
        chain_id,
        account_number,
        sequence,
        fee: message.fee,
        msgs: message.msgs,
        memo: message.memo
      };

      const sortedSignDoc = sortKeys(signDoc, { deep: true });
      const signMessage = Buffer.from(JSON.stringify(sortedSignDoc));

      // Hash and convert to Uint8Array
      const hashData = sha256().update(signMessage).digest();
      const hash = Uint8Array.from(hashData);

      const { signature } = secp256k1.ecdsaSign(hash, privateKey);
      const signatureBase64 = Buffer.from(signature).toString('base64');
      const pubKeyValue = Buffer.from(hexPublicKey, 'hex').toString('base64');

      return {
        signature: signatureBase64,
        publicKey: {
          type: 'tendermint/PubKeySecp256k1',
          value: pubKeyValue
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  }

  static async isValidAddress(address: string): Promise<boolean> {
    try {
      if (!address.startsWith('terra1')) {
        return false;
      }

      if (address.length < 39 || address.length > 46) {
        return false;
      }

      const validChars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const addressWithoutPrefix = address.substring(6);
      for (let i = 0; i < addressWithoutPrefix.length; i++) {
        if (validChars.indexOf(addressWithoutPrefix[i]) === -1) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

export default TerraWallet;