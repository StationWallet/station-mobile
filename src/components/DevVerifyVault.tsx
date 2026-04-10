import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import { fromBinary } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { getStoredVault } from 'services/migrateToVault'

// Lazy-load expo-dkls to avoid crashes in non-native contexts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded native module with no TS definitions
let ExpoDkls: any = null
try {
  ExpoDkls = require('../../modules/expo-dkls').default
} catch {}

// Must match the test vectors in DevSeedLegacyData
const TEST_PRIVATE_KEY_1 =
  '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_2 =
  '0000000000000000000000000000000000000000000000000000000000000002'
const EXPECTED_PUBKEY_1 =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const EXPECTED_PUBKEY_2 =
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'

type Results = Record<string, string>

type Props = {
  importedVaultName?: string
}

/**
 * DEV ONLY: Reads the stored vault protobufs after migration and verifies
 * that the vault structure, keys, and keyshares are correct.
 *
 * Supports both vault types:
 *   - KEYIMPORT (legacy): checks raw private key in keyshare
 *   - DKLS (fast vault): checks opaque keyshare, 2 signers, loads keyshare
 *     via native module to verify structural validity
 *
 * When importedVaultName is provided, verifies the imported vault instead
 * of the migration test wallets.
 */
export default function DevVerifyVault({
  importedVaultName,
}: Props = {}): React.ReactElement {
  const [results, setResults] = useState<Results>({})

  useEffect(() => {
    verify()
    // Run only when importedVaultName changes (verify depends on it)
  }, [importedVaultName])

  const verify = async (): Promise<void> => {
    const r: Results = {}

    try {
      // ── Imported vault verification ──
      if (importedVaultName) {
        const vaultRaw = await getStoredVault(importedVaultName)
        r['imported-exists'] = String(!!vaultRaw)

        if (vaultRaw) {
          const vaultBytes = Uint8Array.from(atob(vaultRaw), (c) =>
            c.charCodeAt(0)
          )
          const vault = fromBinary(VaultSchema, vaultBytes)

          r['imported-name'] = String(
            vault.name === importedVaultName
          )
          r['imported-has-pubkey'] = String(
            vault.publicKeyEcdsa.length > 0 &&
              vault.publicKeyEcdsa.startsWith('0')
          )
          r['imported-has-keyshare'] = String(
            vault.keyShares.length >= 1 &&
              vault.keyShares[0].keyshare.length > 0 &&
              vault.keyShares[0].publicKey === vault.publicKeyEcdsa
          )
          r['imported-libtype'] = String(
            vault.libType === LibType.KEYIMPORT ||
              vault.libType === LibType.DKLS
          )
          r['imported-has-signers'] = String(vault.signers.length > 0)

          r['all-passed'] = String(
            r['imported-exists'] === 'true' &&
              r['imported-name'] === 'true' &&
              r['imported-has-pubkey'] === 'true' &&
              r['imported-has-keyshare'] === 'true' &&
              r['imported-libtype'] === 'true' &&
              r['imported-has-signers'] === 'true'
          )
        } else {
          r['all-passed'] = 'false'
        }

        setResults(r)
        return
      }

      // Verify TestWallet1 vault
      const vault1Raw = await getStoredVault('TestWallet1')
      r['vault1-exists'] = String(!!vault1Raw)

      if (vault1Raw) {
        const vault1Bytes = Uint8Array.from(atob(vault1Raw), (c) =>
          c.charCodeAt(0)
        )
        const vault1 = fromBinary(VaultSchema, vault1Bytes)

        r['vault1-name'] = String(vault1.name === 'TestWallet1')
        r['vault1-libtype'] = String(
          vault1.libType === LibType.KEYIMPORT ||
            vault1.libType === LibType.DKLS
        )

        if (vault1.libType === LibType.DKLS) {
          // ── DKLS fast vault checks ──
          r['vault1-vault-type'] = 'DKLS'

          // Public key should be non-empty (DKLS ceremony generates it)
          r['vault1-pubkey'] = String(
            vault1.publicKeyEcdsa.length > 0 &&
              vault1.publicKeyEcdsa.startsWith('0')
          )

          // Must have exactly 2 signers (device + server)
          r['vault1-signers'] = String(vault1.signers.length === 2)

          // Must have a local party ID that matches one signer
          r['vault1-local-party'] = String(
            vault1.localPartyId.length > 0 &&
              vault1.signers.includes(vault1.localPartyId)
          )

          // Must have 1 keyshare with non-empty opaque data
          r['vault1-keyshare'] = String(
            vault1.keyShares.length === 1 &&
              vault1.keyShares[0].keyshare.length > 50 && // opaque blob, much larger than a raw key
              vault1.keyShares[0].publicKey === vault1.publicKeyEcdsa
          )

          // Chain public keys
          r['vault1-chain'] = String(
            vault1.chainPublicKeys.length === 1 &&
              vault1.chainPublicKeys[0].chain === 'Terra' &&
              vault1.chainPublicKeys[0].publicKey ===
                vault1.publicKeyEcdsa &&
              vault1.chainPublicKeys[0].isEddsa === false
          )

          // ── Keyshare loading validation ──
          // Load the keyshare via native DKLS module to confirm it's structurally valid.
          // This is the closest we can get to signing validation without a co-signer.
          if (ExpoDkls && vault1.keyShares[0].keyshare) {
            try {
              const handle = await ExpoDkls.loadKeyshare(
                vault1.keyShares[0].keyshare
              )
              // If loadKeyshare returns a handle without throwing, the keyshare is valid
              r['vault1-keyshare-loadable'] = 'true'
              // Extract key ID and verify it's non-empty
              const keyId = await ExpoDkls.getKeyshareKeyId(handle)
              r['vault1-keyshare-has-keyid'] = String(
                keyId.length > 0
              )
              // Clean up native handle
              try {
                ExpoDkls.freeKeyshare(handle)
              } catch {}
            } catch (e) {
              r['vault1-keyshare-loadable'] = 'false'
              r['vault1-keyshare-load-error'] =
                e instanceof Error ? e.message : String(e)
            }
          } else {
            r['vault1-keyshare-loadable'] =
              'skipped (no native module)'
          }
        } else {
          // ── Legacy KEYIMPORT vault checks ──
          r['vault1-vault-type'] = 'KEYIMPORT'
          r['vault1-pubkey'] = String(
            vault1.publicKeyEcdsa === EXPECTED_PUBKEY_1
          )
          r['vault1-keyshare'] = String(
            vault1.keyShares.length === 1 &&
              vault1.keyShares[0].keyshare === TEST_PRIVATE_KEY_1 &&
              vault1.keyShares[0].publicKey === EXPECTED_PUBKEY_1
          )
          r['vault1-chain'] = String(
            vault1.chainPublicKeys.length === 1 &&
              vault1.chainPublicKeys[0].chain === 'Terra' &&
              vault1.chainPublicKeys[0].publicKey ===
                EXPECTED_PUBKEY_1
          )

          // Derive pubkey independently
          const derivedPub1 = hex.encode(
            secp256k1.getPublicKey(
              hex.decode(TEST_PRIVATE_KEY_1),
              true
            )
          )
          r['vault1-derive-check'] = String(
            derivedPub1 === vault1.publicKeyEcdsa
          )
        }
      }

      // Verify TestWallet2 vault
      const vault2Raw = await getStoredVault('TestWallet2')
      r['vault2-exists'] = String(!!vault2Raw)

      if (vault2Raw) {
        const vault2Bytes = Uint8Array.from(atob(vault2Raw), (c) =>
          c.charCodeAt(0)
        )
        const vault2 = fromBinary(VaultSchema, vault2Bytes)

        r['vault2-name'] = String(vault2.name === 'TestWallet2')

        if (vault2.libType === LibType.DKLS) {
          r['vault2-vault-type'] = 'DKLS'
          r['vault2-pubkey'] = String(
            vault2.publicKeyEcdsa.length > 0 &&
              vault2.publicKeyEcdsa.startsWith('0')
          )
          r['vault2-keyshare'] = String(
            vault2.keyShares.length === 1 &&
              vault2.keyShares[0].keyshare.length > 50
          )

          // Load keyshare to validate
          if (ExpoDkls && vault2.keyShares[0].keyshare) {
            try {
              const handle = await ExpoDkls.loadKeyshare(
                vault2.keyShares[0].keyshare
              )
              r['vault2-keyshare-loadable'] = 'true'
              try {
                ExpoDkls.freeKeyshare(handle)
              } catch {}
            } catch (e) {
              r['vault2-keyshare-loadable'] = 'false'
              r['vault2-keyshare-load-error'] =
                e instanceof Error ? e.message : String(e)
            }
          }
        } else {
          r['vault2-vault-type'] = 'KEYIMPORT'
          r['vault2-pubkey'] = String(
            vault2.publicKeyEcdsa === EXPECTED_PUBKEY_2
          )
          r['vault2-keyshare'] = String(
            vault2.keyShares.length === 1 &&
              vault2.keyShares[0].keyshare === TEST_PRIVATE_KEY_2
          )
        }
      }

      // Verify TestLedgerWallet vault (no key material)
      // In DKLS migration, ledger wallets are skipped (no vault stored).
      // In legacy migration, a vault is created with no key material.
      const vault3Raw = await getStoredVault('TestLedgerWallet')
      r['ledger-exists'] = String(!!vault3Raw)

      if (vault3Raw) {
        const vault3Bytes = Uint8Array.from(atob(vault3Raw), (c) =>
          c.charCodeAt(0)
        )
        const vault3 = fromBinary(VaultSchema, vault3Bytes)

        r['ledger-name'] = String(vault3.name === 'TestLedgerWallet')
        r['ledger-no-keyshares'] = String(
          vault3.keyShares.length === 0
        )
        r['ledger-no-pubkey'] = String(vault3.publicKeyEcdsa === '')
      } else {
        // No vault for ledger = expected for DKLS migration (ledger was skipped)
        r['ledger-name'] = 'true'
        r['ledger-no-keyshares'] = 'true'
        r['ledger-no-pubkey'] = 'true'
      }

      // Overall pass — adapt to vault type
      const vault1Type = r['vault1-vault-type']
      const vault2Type = r['vault2-vault-type']

      const vault1Checks =
        vault1Type === 'DKLS'
          ? r['vault1-exists'] === 'true' &&
            r['vault1-name'] === 'true' &&
            r['vault1-pubkey'] === 'true' &&
            r['vault1-libtype'] === 'true' &&
            r['vault1-signers'] === 'true' &&
            r['vault1-local-party'] === 'true' &&
            r['vault1-keyshare'] === 'true' &&
            r['vault1-chain'] === 'true' &&
            r['vault1-keyshare-loadable'] === 'true' &&
            r['vault1-keyshare-has-keyid'] === 'true'
          : r['vault1-exists'] === 'true' &&
            r['vault1-name'] === 'true' &&
            r['vault1-pubkey'] === 'true' &&
            r['vault1-libtype'] === 'true' &&
            r['vault1-keyshare'] === 'true' &&
            r['vault1-chain'] === 'true' &&
            r['vault1-derive-check'] === 'true'

      const vault2Checks =
        vault2Type === 'DKLS'
          ? r['vault2-exists'] === 'true' &&
            r['vault2-name'] === 'true' &&
            r['vault2-pubkey'] === 'true' &&
            r['vault2-keyshare'] === 'true' &&
            r['vault2-keyshare-loadable'] === 'true'
          : r['vault2-exists'] === 'true' &&
            r['vault2-name'] === 'true' &&
            r['vault2-pubkey'] === 'true' &&
            r['vault2-keyshare'] === 'true'

      // Ledger checks pass if: vault exists with no key material, OR no vault (DKLS skip)
      const ledgerChecks =
        r['ledger-name'] === 'true' &&
        r['ledger-no-keyshares'] === 'true' &&
        r['ledger-no-pubkey'] === 'true'

      r['all-passed'] = String(
        vault1Checks && vault2Checks && ledgerChecks
      )
    } catch (e) {
      r['error'] = String(e instanceof Error ? e.message : e)
      r['all-passed'] = 'false'
    }

    setResults(r)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vault Verification</Text>
      {Object.entries(results).map(([key, val]) => (
        <Text
          key={key}
          testID={`verify-${key}`}
          style={[styles.result, val === 'false' && styles.fail]}
        >
          {key}: {val}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', padding: 16, marginTop: 16 },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  result: { color: '#33CCBB', fontSize: 12, marginVertical: 1 },
  fail: { color: '#FF5C5C' },
})
