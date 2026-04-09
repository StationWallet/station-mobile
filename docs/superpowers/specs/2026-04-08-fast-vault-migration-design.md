# Fast Vault Migration Design

**Date:** 2026-04-08
**Status:** Draft
**Scope:** Convert station-mobile's migration flow to produce 2-of-2 DKLS fast vaults (Terra-only) with vultiserver as co-signer.

## Context

Station-mobile migrates legacy Terra Station wallets into Vultisig's vault format. Currently, migrated vaults use `libType: KEYIMPORT` with the raw private key stored in the `keyShares` field — a single-signer vault with no threshold protection.

The legacy auth data stores only `{ encryptedKey, password, address }` — a derived leaf private key at BIP44 path `m/44'/330'/0'/0/0`. No mnemonic, no master key, no chain code. Multi-chain derivation is not possible from this data, so migrated vaults are Terra-only.

vultiagent-app (same stack: Expo + React Native) already implements fast vault creation with a custom `expo-dkls` native module. We port this module and the supporting services to station-mobile.

## Architecture

### Components

1. **`modules/expo-dkls/`** — Native Expo module wrapping `godkls.xcframework` (149 MB) + `goschnorr.xcframework` (104 MB) on iOS, and `dkls-release.aar` (9.2 MB) + `goschnorr-release.aar` (1.8 MB) on Android. Copied from vultiagent-app as-is. Provides DKLS key import, keygen, and keysign functions via async JS bridge.

2. **`src/services/relay.ts`** — HTTP client for vultisig-relay (message broker). Ported from vultiagent-app. Functions: `joinRelaySession`, `waitForParties`, `startRelaySession`, `sendRelayMessage`, `getRelayMessages`, `uploadSetupMessage`, `signalComplete`, `waitForComplete`, `deleteRelayMessage`.

3. **`src/services/fastVaultServer.ts`** — HTTP client for vultiserver. Ported from vultiagent-app. Functions: `setupVaultWithServer` (calls `/vault/import`), `verifyVaultEmail`.

4. **`src/services/dklsKeyImport.ts`** — Orchestrates the DKLS key import ceremony for a single secp256k1 private key. Adapted from vultiagent-app's `importFastVault.ts` with multi-chain, EdDSA, and mnemonic logic removed.

5. **`src/config/env.ts`** — Environment configuration for API URLs.

### Data Flow

```
Legacy AuthData (encryptedKey + password)
  → decrypt → raw secp256k1 private key
  → DKLS key import ceremony (device + vultiserver via relay)
  → device receives: DKLS keyshare (opaque blob) + public key + chain code
  → build Vault protobuf (libType: DKLS, signers: [sdk-xxxx, Server-yyyy])
  → store in SecureStore as VAULT-{walletName}
  → verify stored vault reads back correctly
  → delete legacy auth data entry for this wallet
```

## Migration Flow

### Screen Sequence

```
WalletDiscovery
  → [for each wallet]
    → VaultEmail (step 1/2)
    → VaultPassword (step 2/2)
    → KeygenProgress (DKLS ceremony)
    → VerifyEmail (4-digit OTP from vultiserver via agentmail)
  → MigrationSuccess
```

### WalletDiscovery (modified)

Same as current: shows list of detected wallets. Ledger wallets are shown but marked as non-upgradeable (no private key). Tapping "Upgrade" navigates to the first wallet's VaultEmail screen instead of the bulk MigrationProgress screen.

### VaultEmail (new)

- Shows which wallet is being set up (wallet name displayed)
- Step indicator: 1/2
- Email input with validation (must contain `@` and `.`)
- "Next" button (disabled until valid)
- Matches vultiagent-app design: dark navy background (#02122B), Brockmann fonts, light text (#F0F4FC primary, #8295AE secondary)

### VaultPassword (new)

- Step indicator: 2/2
- Two password fields: "At least 6 characters" + "Confirm password"
- Validation: min 6 chars, must match
- "Continue" button triggers the DKLS ceremony
- Same vultiagent-app design language

### KeygenProgress (new)

- Full-screen progress display with percentage (0-100%)
- Phase text: "Connecting..." → "Generating..."
- Progress steps map to ceremony phases:
  - setup: 12%, joining: 20%, waiting: 28%, ecdsa: 48%, finalizing: 86%, complete: 100%
  - (No EdDSA step — Terra is ECDSA only)
- On success: auto-advances to next wallet's VaultEmail, or MigrationSuccess if last
- On failure: shows error message with "Skip" and "Retry" buttons
  - Skip: marks wallet as un-migrated, advances to next wallet
  - Retry: restarts the ceremony for this wallet

### MigrationSuccess (modified)

- Shows per-wallet results: checkmark for fast vaults, warning icon for skipped/failed
- `vaultsUpgraded` preference set to `true` regardless (user has been through the flow)
- "Continue" navigates to main app

### Ledger Wallets

Skipped from the DKLS flow entirely — no private key to import. They remain as address-only vault data. Shown in WalletDiscovery but not included in the upgrade sequence.

## DKLS Key Import Ceremony

For each standard (non-Ledger) wallet:

1. **Setup** — Generate `sessionId` (UUID), `hexEncryptionKey` (32 random bytes hex), `localPartyId` ("sdk-{random4hex}"). Use 32 zero bytes as chain code (DKLS requires the parameter; not used for HD derivation in this single-chain context).

2. **Server registration** — POST to vultiserver `/vault/batch/import` with:
   - `name`: wallet name
   - `session_id`: generated UUID
   - `hex_encryption_key`: generated key
   - `hex_chain_code`: 32 zero bytes hex
   - `local_party_id`: the party ID the server should use on the relay (e.g., "Server-12345"). Despite the field name, vultiserver adopts this value as **its own** party ID when registering with the relay (`relayClient.RegisterSessionWithRetry(req.SessionID, req.LocalPartyId)` in `service/import_batch.go`). The device generates a separate `localPartyId` (e.g., "sdk-a1b2") and joins the relay independently.
   - `encryption_password`: user-provided password
   - `email`: user-provided email
   - `protocols`: ["ecdsa"] (ECDSA only — no EdDSA for Terra)
   - The device discovers the server's party ID by polling the relay for participants and selecting the non-self party.

3. **Relay join** — Register on relay, poll until server joins (2 parties), signal start.

4. **ECDSA key import** — `ExpoDkls.createDklsKeyImportSession(privateKeyHex, chainCodeHex, 2, partyIds)` returns `{ setupMessage, sessionHandle }`. Upload encrypted setup message to relay. Run concurrent message exchange loops (outbound: native → encrypt → relay; inbound: relay → decrypt → native) until `inputMessage()` returns `finished: true`. Call `finishKeygen(handle)` → `{ publicKey, keyshare, chainCode }`.

5. **No EdDSA round** — Terra uses secp256k1 only.

6. **Signal completion** — POST `/complete/{sessionId}`, wait for server confirmation.

7. **Store vault** — Build Vault protobuf:
   - `name`: wallet name
   - `publicKeyEcdsa`: compressed public key from DKLS result
   - `publicKeyEddsa`: empty
   - `signers`: [localPartyId, serverPartyId]
   - `localPartyId`: localPartyId
   - `hexChainCode`: chain code from DKLS result
   - `resharePrefix`: empty
   - `libType`: DKLS
   - `keyShares`: [{ publicKey, keyshare: base64 DKLS keyshare }]
   - `chainPublicKeys`: [{ chain: "Terra", publicKey, isEddsa: false }]
   - `publicKeyMldsa44`: empty
   - Serialize → base64 → SecureStore `VAULT-{walletName}`

8. **Strip legacy key material** — Read back the stored vault, validate it parses correctly and contains the expected public key. Only then strip the sensitive fields (`encryptedKey`, `password`) from the legacy auth data entry while preserving the `address` field (needed for wallet list display). The wallet entry remains in auth data but with empty key material.

### Timeouts

- Party join: 120 seconds
- MPC message loop: 120 seconds
- Completion signal: 60 polls at 1 second intervals

### Message Encryption

All relay messages encrypted with AES-256-GCM using the session's `hexEncryptionKey`. Uses `@noble/ciphers` (already in project). Messages are base64-encoded for transport. MD5 hash of plaintext used for deduplication.

## Vault Export (modified)

**For DKLS vaults:** Read the stored vault protobuf directly from SecureStore (already contains DKLS keyshares). Encrypt with user's export password using AES-256-GCM. Wrap in VaultContainer (`version: 1, isEncrypted: true`). Base64-encode and write as `{walletName}-station-mobile.vult`. Share via system share sheet.

**For legacy wallets (un-migrated):** Existing export flow unchanged — rebuild vault from raw key.

**Export Private Key screen:** Hidden for DKLS vaults (no raw key to reveal). Remains available for un-migrated legacy wallets only.

## Retry from Main UI

Un-migrated wallets appear in the wallet list with a "Legacy" badge. An "Upgrade to Fast Vault" action is available.

Tapping it launches VaultEmail → VaultPassword → KeygenProgress for that single wallet. On success, the wallet becomes a DKLS fast vault and legacy data is deleted. On failure, returns to wallet list with wallet unchanged.

**Detection:** Parse stored vault protobuf. If `libType === DKLS` → fast vault. If `libType === KEYIMPORT` or no vault stored → legacy, show upgrade option.

## Files

### New Files

| File | Source | Notes |
|------|--------|-------|
| `modules/expo-dkls/` | Copy from vultiagent-app | Entire directory — native module, frameworks, AARs, TS bridge |
| `src/services/relay.ts` | Port from vultiagent-app | Relay HTTP client, point to env config |
| `src/services/fastVaultServer.ts` | Port from vultiagent-app | Vultiserver HTTP client, point to env config |
| `src/services/dklsKeyImport.ts` | Adapted from vultiagent-app `importFastVault.ts` | Single ECDSA key import only — no multi-chain, no EdDSA, no mnemonic |
| `src/screens/migration/VaultEmail.tsx` | New, vultiagent design | Per-wallet email collection |
| `src/screens/migration/VaultPassword.tsx` | New, vultiagent design | Per-wallet password collection |
| `src/screens/migration/KeygenProgress.tsx` | New, vultiagent design | DKLS ceremony progress with skip/retry |
| `src/config/env.ts` | New | `relayUrl`, `vultisigApiUrl` |

### Modified Files

| File | Change |
|------|--------|
| `src/services/migrateToVault.ts` | Replace local vault building with DKLS ceremony call; add legacy data deletion after verified storage |
| `src/services/exportVaultShare.ts` | Read stored DKLS vault directly instead of rebuilding from raw key |
| `src/navigation/MigrationNavigator.tsx` | Add VaultEmail, VaultPassword, KeygenProgress to stack |
| `src/screens/migration/WalletDiscovery.tsx` | Navigate to per-wallet email screen instead of bulk progress |
| `src/screens/migration/MigrationProgress.tsx` | Remove — replaced by per-wallet KeygenProgress |
| `src/screens/migration/MigrationSuccess.tsx` | Show per-wallet results (fast vault checkmark vs skipped warning) |
| `src/screens/ExportPrivateKey.tsx` | Hide raw key export for DKLS vaults |
| Wallet list screen | Add "Legacy" badge and "Upgrade to Fast Vault" action for un-migrated wallets |

### Dependencies

No new npm packages. Existing `@noble/ciphers`, `@noble/hashes`, `@noble/curves`, `@scure/base` cover AES-GCM, SHA-256, secp256k1, and encoding needs.

## E2E Tests (Detox)

1. **Full migration success** — All wallets go through email/password/DKLS ceremony → all become DKLS vaults → legacy auth data deleted for all → MigrationSuccess shows all checkmarks.

2. **Partial migration** — Multiple wallets, one skipped during ceremony → skipped wallet retains legacy data → migrated wallets have DKLS vaults → MigrationSuccess shows mixed results.

3. **Retry from main UI** — After partial migration, tap "Upgrade to Fast Vault" on legacy wallet → complete email/password/DKLS ceremony → wallet becomes DKLS vault → legacy data deleted → badge disappears.

4. **Export DKLS vault** — Migrated fast vault → export as `.vult` → file contains `libType: DKLS`, threshold keyshare (not raw key), two signers.

5. **Ledger wallet handling** — Ledger wallets shown in discovery but not included in DKLS upgrade sequence → remain as address-only vaults.

## Security Considerations

- **Raw private key lifetime:** The decrypted private key exists in memory only during the DKLS ceremony. After the ceremony, the DKLS keyshare replaces it in storage. The legacy auth data (containing the encrypted private key) is deleted only after the DKLS vault is verified.
- **Relay messages:** End-to-end encrypted with per-session AES-256-GCM key. Relay server cannot read message contents.
- **Server trust model:** Vultiserver is a blind co-signer for fast vaults — no transaction validation. The 2-of-2 model protects against server-side breach (attacker gets one share, can't sign alone). It does not protect against user-side compromise (attacker with user's share can request server co-sign).
- **Export security:** `.vult` files contain a DKLS keyshare, not the full private key. An attacker who obtains the `.vult` file and its password gets one threshold share — they would also need the server's share (requiring the vault password on vultiserver) to sign transactions.
