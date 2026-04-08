import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import { fromBinary } from '@bufbuild/protobuf'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex } from '@scure/base'

import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'
import { getStoredVault } from 'services/migrateToVault'

// Must match the test vectors in DevSeedLegacyData
const TEST_PRIVATE_KEY_1 = '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_2 = '0000000000000000000000000000000000000000000000000000000000000002'
const EXPECTED_PUBKEY_1 = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const EXPECTED_PUBKEY_2 = '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'

type Results = Record<string, string>

/**
 * DEV ONLY: Reads the stored vault protobufs after migration and verifies
 * that the private keys, public keys, and vault structure are correct.
 * This is the critical data integrity check for the migration flow.
 */
export default function DevVerifyVault(): React.ReactElement {
  const [results, setResults] = useState<Results>({})

  useEffect(() => {
    verify()
  }, [])

  const verify = async () => {
    const r: Results = {}

    try {
      // Verify TestWallet1 vault
      const vault1Raw = await getStoredVault('TestWallet1')
      r['vault1-exists'] = String(!!vault1Raw)

      if (vault1Raw) {
        const vault1Bytes = Uint8Array.from(atob(vault1Raw), c => c.charCodeAt(0))
        const vault1 = fromBinary(VaultSchema, vault1Bytes)

        r['vault1-name'] = String(vault1.name === 'TestWallet1')
        r['vault1-pubkey'] = String(vault1.publicKeyEcdsa === EXPECTED_PUBKEY_1)
        r['vault1-libtype'] = String(vault1.libType === LibType.KEYIMPORT)
        r['vault1-keyshare'] = String(
          vault1.keyShares.length === 1 &&
          vault1.keyShares[0].keyshare === TEST_PRIVATE_KEY_1 &&
          vault1.keyShares[0].publicKey === EXPECTED_PUBKEY_1
        )
        r['vault1-chain'] = String(
          vault1.chainPublicKeys.length === 1 &&
          vault1.chainPublicKeys[0].chain === 'Terra' &&
          vault1.chainPublicKeys[0].publicKey === EXPECTED_PUBKEY_1
        )

        // Independently derive pubkey from private key to double-check
        const derivedPub1 = hex.encode(secp256k1.getPublicKey(hex.decode(TEST_PRIVATE_KEY_1), true))
        r['vault1-derive-check'] = String(derivedPub1 === vault1.publicKeyEcdsa)
      }

      // Verify TestWallet2 vault
      const vault2Raw = await getStoredVault('TestWallet2')
      r['vault2-exists'] = String(!!vault2Raw)

      if (vault2Raw) {
        const vault2Bytes = Uint8Array.from(atob(vault2Raw), c => c.charCodeAt(0))
        const vault2 = fromBinary(VaultSchema, vault2Bytes)

        r['vault2-name'] = String(vault2.name === 'TestWallet2')
        r['vault2-pubkey'] = String(vault2.publicKeyEcdsa === EXPECTED_PUBKEY_2)
        r['vault2-keyshare'] = String(
          vault2.keyShares.length === 1 &&
          vault2.keyShares[0].keyshare === TEST_PRIVATE_KEY_2
        )
      }

      // Verify TestLedgerWallet vault (no key material)
      const vault3Raw = await getStoredVault('TestLedgerWallet')
      r['ledger-exists'] = String(!!vault3Raw)

      if (vault3Raw) {
        const vault3Bytes = Uint8Array.from(atob(vault3Raw), c => c.charCodeAt(0))
        const vault3 = fromBinary(VaultSchema, vault3Bytes)

        r['ledger-name'] = String(vault3.name === 'TestLedgerWallet')
        r['ledger-no-keyshares'] = String(vault3.keyShares.length === 0)
        r['ledger-no-pubkey'] = String(vault3.publicKeyEcdsa === '')
      }

      // Overall
      const allPassed =
        r['vault1-exists'] === 'true' &&
        r['vault1-name'] === 'true' &&
        r['vault1-pubkey'] === 'true' &&
        r['vault1-libtype'] === 'true' &&
        r['vault1-keyshare'] === 'true' &&
        r['vault1-chain'] === 'true' &&
        r['vault1-derive-check'] === 'true' &&
        r['vault2-exists'] === 'true' &&
        r['vault2-name'] === 'true' &&
        r['vault2-pubkey'] === 'true' &&
        r['vault2-keyshare'] === 'true' &&
        r['ledger-exists'] === 'true' &&
        r['ledger-name'] === 'true' &&
        r['ledger-no-keyshares'] === 'true' &&
        r['ledger-no-pubkey'] === 'true'

      r['all-passed'] = String(allPassed)
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
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  result: { color: '#33CCBB', fontSize: 12, marginVertical: 1 },
  fail: { color: '#FF5C5C' },
})
