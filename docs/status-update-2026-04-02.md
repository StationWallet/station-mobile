# Station Mobile — Expo Migration Branch (April 2)

**Context:** We're migrating Station Mobile from React Native to Expo. A critical part of this work is the legacy keystore migration — wallet private keys are encrypted and stored in the device keystore, and if migration fails or reads from the wrong location, users permanently lose access to their funds. The migration bridges the gap between the old storage format (iOS: AES-256-CBC in Keychain, Android: EncryptedSharedPreferences) and the new Expo-based `expo-secure-store` layer, running automatically on first launch after upgrade. Today's work spans multi-wallet support, private key export, vault share export, and hardening of that migration path.

## Multi-Wallet Support
[`e576468`](https://github.com/0xApotheosis/station-mobile/commit/e576468)...[`471450d`](https://github.com/0xApotheosis/station-mobile/commit/471450d) (6 commits)

- Added WalletPicker screen, extended navigation context with wallet list and auto-select, and updated AuthMenu/WalletCreated/WalletRecovered to support both auth and add-wallet modes

## Export Private Key
[`643b967`](https://github.com/0xApotheosis/station-mobile/commit/643b967)...[`a723185`](https://github.com/0xApotheosis/station-mobile/commit/a723185) (8 commits)

- Built ExportPrivateKey screen with password verification, clipboard copy, and QR code display accessible from WalletHome for non-Ledger wallets
- Fixed hex-to-bytes conversion for secp256k1 public key derivation, null guarding on QR input, and clipboard/state cleanup on unmount

## Vault Share Export
[`f0f7b2b`](https://github.com/0xApotheosis/station-mobile/commit/f0f7b2b)...[`199e6f8`](https://github.com/0xApotheosis/station-mobile/commit/199e6f8) (6 commits)

- Added Vultisig protobuf schemas from CommonData and built a vault share export service using protobuf serialization + AES-GCM encryption, surfaced via an "Export as Vault Share" button that writes an encrypted `.bak` file and opens the OS share sheet

## Legacy Keystore Migration
[`83ea73a`](https://github.com/0xApotheosis/station-mobile/commit/83ea73a)...[`bb7dbe3`](https://github.com/0xApotheosis/station-mobile/commit/bb7dbe3) (11 commits)

- Built the full native module (iOS: Keychain + AES-256-CBC decryption, Android: EncryptedSharedPreferences reader), JS orchestration layer with verify-before-delete, and app startup integration
- Hardened for audit findings, added Expo Go graceful fallback, fixed Keychain accessibility for simulator persistence
- Added Detox E2E test and a dev-only migration test component

## Bug Fixes & Polish
[`3fa625a`](https://github.com/0xApotheosis/station-mobile/commit/3fa625a)...[`f7cc46e`](https://github.com/0xApotheosis/station-mobile/commit/f7cc46e) (5 commits)

- Fixed keyboard white bar, disabled iOS Automatic Strong Password on wallet fields, removed all Ledger functionality, and did a general branch cleanup (hooks bug fix, deduplication, perf improvements)
