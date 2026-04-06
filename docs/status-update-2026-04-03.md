# April 3: Station Mobile — Expo Migration Branch

**Context:** Got access to the Station Mobile repo today and began setting up EAS Build for a friction-free release pipeline. Continued hardening the legacy keystore migration path — wallet private keys are encrypted in the device keystore, and if migration fails or reads from the wrong location, users permanently lose access to their funds. Today's work focused on EAS setup, migration hardening, E2E test coverage, StorageCipher18 investigation, and iOS entitlements.

## EAS Build Setup
[`f8c010d`](https://github.com/StationWallet/station-mobile/commit/f8c010d578964b588c7ef9a02853dc397a985fd5) (1 commit)

Added `eas.json` build profiles and `expo-updates` config for App Store publishing, laying the groundwork for a friction-free CI/CD release pipeline

## Legacy Keystore Migration Hardening
[`b129343`](https://github.com/StationWallet/station-mobile/commit/b129343512b6b0c264a7c22a96a5185bffe11b62)...[`b45df35`](https://github.com/StationWallet/station-mobile/commit/b45df3583718cb1d371b2860b0a33a6a9b96ee4f) (3 commits)

Added 10-second timeout to legacy keystore reads to prevent indefinite hangs, made Android throw on EncryptedSharedPreferences open failure instead of silently returning null, and corrected a misleading comment in migratePreferences that suggested it migrated key material (it doesn't)

## E2E Migration Test
[`bba6eca`](https://github.com/StationWallet/station-mobile/commit/bba6ecaf5a3d60c833af536819f5bb9ddeceb000)...[`6158c6e`](https://github.com/StationWallet/station-mobile/commit/6158c6e2ebb18caabfa4698afa5af2f74a62ede1) (2 commits)

Designed and implemented a full end-to-end migration test that creates a wallet, exports it as a vault share, verifies the exported protobuf container can be decrypted and contains the correct key material — covering the complete lifecycle from keystore read through vault export

## StorageCipher18 Investigation
[`90d1c48`](https://github.com/StationWallet/station-mobile/commit/90d1c48f7765bb26f93a874f654459be0f32cd57) (1 commit)

Investigated and documented how the legacy Android StorageCipher18 key store behaves across app releases — recorded findings in `docs/keystore-migration.md` to inform migration edge-case handling

## iOS Entitlements
[`1f63480`](https://github.com/StationWallet/station-mobile/commit/1f63480f89a26c849716e02af3824f860e9a1d79) (1 commit)

Restored push notification permissions and universal link entitlements in `app.json` that were lost during the Expo managed workflow migration
