# Export as Vault Share (.vult)

## Purpose

Allow station-mobile users to export their wallet as a `.vult` vault share file that can be imported into any Vultisig app (VultiAgent, vultisig-windows, vultisig-ios, vultisig-android) via the existing "Import Vault Share" flow. This is the primary migration path for users who have lost their seed phrase.

## Scope

- Construct a KeyImport vault protobuf from a raw secp256k1 private key
- Encrypt with AES-256-GCM (password-derived key) matching Vultisig's format
- Write and share a `.vult` file via the system share sheet
- Terra chain only (the only chain this private key is valid for)

Out of scope: multi-chain support, EdDSA keys, unencrypted export, import flow.

## Reference Implementation

Follows vultiagent-app's exact patterns:
- `src/services/exportVaultBackup.ts` — vault serialization + encryption
- `src/utils/crypto.ts` — AES-GCM with @noble/ciphers
- `src/proto/vultisig/vault/v1/` — protobuf schemas from CommonData

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@bufbuild/protobuf` | ^2.11.0 | Protobuf serialization (create, toBinary) |
| `@noble/ciphers` | ^2.1.1 | AES-256-GCM encryption |
| `@noble/hashes` | ^2.0.1 | SHA-256 for password key derivation |
| `@noble/curves` | ^2.0.1 | secp256k1 public key derivation from private key |
| `@scure/base` | ^2.0.0 | Hex/base64 encoding |
| `expo-file-system` | ~18.0.0 | Write .vult file to cache directory |
| `expo-sharing` | ~13.0.0 | System share sheet |

## Data Flow

```
1. User taps "Export as Vault Share" (after private key is revealed)
2. Prompt for export password (encrypts the .vult file)
3. Derive secp256k1 compressed public key from private key hex
   - @noble/curves: secp256k1.getPublicKey(privateKeyHex, true)
   - Returns 33-byte compressed public key → hex encode
4. Build Vault protobuf message:
   - name: wallet name
   - public_key_ecdsa: compressed public key hex
   - public_key_eddsa: ""
   - signers: ["station-mobile"]
   - local_party_id: "station-mobile"
   - hex_chain_code: ""
   - lib_type: LIB_TYPE_KEYIMPORT (2)
   - key_shares: [{ public_key: ecdsaPubKeyHex, keyshare: privateKeyHex }]
   - chain_public_keys: [{ chain: "Terra", public_key: ecdsaPubKeyHex, is_eddsa: false }]
   - reshare_prefix: ""
   - public_key_mldsa44: ""
   - created_at: current timestamp
5. Serialize Vault to binary: toBinary(VaultSchema, vaultProto)
6. Encrypt: SHA256(password) → AES-256-GCM key, random 12-byte nonce
   - Output: nonce (12) + ciphertext + authTag (16)
7. Build VaultContainer protobuf:
   - version: 1
   - is_encrypted: true
   - vault: base64(encrypted bytes)
8. Serialize VaultContainer → binary → base64 string
9. Write to file: {cacheDirectory}/{walletName}-station-mobile.vult
10. Open share sheet with file URI
```

## New Files

### `src/proto/vultisig/vault/v1/vault_pb.ts`

Copy from vultiagent-app. Generated protobuf schema for the Vault message. Includes VaultSchema, Vault_KeyShareSchema, Vault_ChainPublicKeySchema.

### `src/proto/vultisig/vault/v1/vault_container_pb.ts`

Copy from vultiagent-app. Generated protobuf schema for VaultContainer. Includes VaultContainerSchema.

### `src/proto/vultisig/keygen/v1/lib_type_message_pb.ts`

Copy from vultiagent-app. LibType enum (GG20=0, DKLS=1, KEYIMPORT=2).

### `src/services/exportVaultShare.ts`

New service that:
1. Accepts private key hex, wallet name, and export password
2. Derives public key using `@noble/curves` secp256k1
3. Constructs Vault protobuf with KeyImport type
4. Encrypts with AES-256-GCM (matching vultiagent-app's `encryptWithPassword`)
5. Wraps in VaultContainer
6. Writes .vult file and returns file URI

## Modified Files

### `src/screens/ExportPrivateKey.tsx`

After the revealed private key section (copy button), add:
- "Export as Vault Share" button (sapphire theme)
- Tapping it shows an inline password input for the export password
- On submit: calls `exportVaultShare()`, then opens share sheet via `expo-sharing`
- Loading state while generating
- Success feedback after share sheet closes

## Encryption Details

Matches vultiagent-app's `encryptWithPassword()` exactly:
```typescript
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import * as ExpoCrypto from 'expo-crypto'

function encryptWithPassword(data: Uint8Array, password: string): Uint8Array {
  const key = sha256(new TextEncoder().encode(password))
  const nonce = ExpoCrypto.getRandomBytes(12)
  const ciphertext = gcm(key, nonce).encrypt(data)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return result
}
```

## Vault Share Compatibility

The produced .vult file is a standard Vultisig vault backup:
- Parseable by all Vultisig apps (iOS, Android, Windows, VultiAgent)
- Uses LibType KEYIMPORT — Vultisig restricts the vault to imported chains only
- Terra chain entry in chain_public_keys — vault will show Terra in Vultisig
- Single signer ("station-mobile") — no MPC resharing possible
- Encrypted with the same AES-256-GCM scheme all Vultisig apps expect

## Polyfills Required

Station-mobile runs Expo ~55 with Hermes. The @noble/* libraries need:
- `crypto.getRandomValues` — provided by expo-crypto (patch in App.tsx if not already present)
- `Buffer` global — already available in station-mobile via existing polyfills
- Metro config: `unstable_enablePackageExports = true` for @noble/* package exports resolution
