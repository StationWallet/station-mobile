import { create } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'

import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'

export const LOCAL_PARTY_ID = 'station-mobile'

export function derivePublicKeyHex(privateKeyHex: string): string {
  const privateKeyBytes = hex.decode(privateKeyHex)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
  return hex.encode(publicKeyBytes)
}

/**
 * Builds a Vault protobuf for a Terra wallet with KeyImport lib type.
 * For standard wallets, pass both publicKeyHex and privateKeyHex.
 * For Ledger wallets, pass empty strings (no key material).
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- return type is the complex protobuf create() result
export function buildVaultProto(
  name: string,
  publicKeyHex: string,
  privateKeyHex: string
) {
  return create(VaultSchema, {
    name,
    publicKeyEcdsa: publicKeyHex,
    publicKeyEddsa: '',
    signers: [LOCAL_PARTY_ID],
    localPartyId: LOCAL_PARTY_ID,
    hexChainCode: '',
    resharePrefix: '',
    libType: LibType.KEYIMPORT,
    keyShares: publicKeyHex
      ? [{ publicKey: publicKeyHex, keyshare: privateKeyHex }]
      : [],
    chainPublicKeys: publicKeyHex
      ? [{ chain: 'Terra', publicKey: publicKeyHex, isEddsa: false }]
      : [],
    createdAt: {
      seconds: BigInt(Math.floor(Date.now() / 1000)),
      nanos: 0,
    },
    publicKeyMldsa44: '',
  })
}
