import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, ScrollView } from 'react-native'
import { fromBinary } from '@bufbuild/protobuf'
import { gcm } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { hex, base64 } from '@scure/base'
import { readAsStringAsync } from 'expo-file-system/legacy'

import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import { migrateLegacyKeystore } from 'utils/legacyMigration'
import { encrypt, decrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import { exportVaultShare } from 'services/exportVaultShare'
import { VaultContainerSchema } from '../proto/vultisig/vault/v1/vault_container_pb'
import { VaultSchema } from '../proto/vultisig/vault/v1/vault_pb'
import { LibType } from '../proto/vultisig/keygen/v1/lib_type_message_pb'

// Well-known secp256k1 test vectors (not funded keys)
const TEST_PRIVATE_KEY_1 =
  '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_2 =
  '0000000000000000000000000000000000000000000000000000000000000002'
const EXPECTED_PUBKEY_1 =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future DKLS vault2 verification
const EXPECTED_PUBKEY_2 =
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'

const PASSWORD_1 = 'testPassword1!'
const PASSWORD_2 = 'testPassword2!'
const EXPORT_PASSWORD = 'vaultExportPass123'

type Results = Record<string, string>

function buildAuthData(encKey1: string, encKey2: string): string {
  return JSON.stringify({
    TestWallet1: {
      ledger: false,
      address: 'terra1test000e2e000wallet001',
      password: PASSWORD_1,
      encryptedKey: encKey1,
    },
    TestWallet2: {
      ledger: false,
      address: 'terra1test000e2e000wallet002',
      password: PASSWORD_2,
      encryptedKey: encKey2,
    },
    TestLedgerWallet: {
      ledger: true,
      address: 'terra1test000e2e000ledger001',
      path: 0,
    },
  })
}

function buildSizeTestData(count: number): string {
  const wallets: Record<string, unknown> = {}
  for (let i = 0; i < count; i++) {
    const encKey = encrypt(TEST_PRIVATE_KEY_1, `sizeTestPass${i}`)
    wallets[`SizeTestWallet${i}`] = {
      ledger: false,
      address: `terra1sizetest${String(i).padStart(3, '0')}`,
      password: `sizeTestPass${i}`,
      encryptedKey: encKey,
    }
  }
  return JSON.stringify(wallets)
}

export default function DevFullE2ETest(): React.ReactElement {
  const [results, setResults] = useState<Results>({})

  useEffect(() => {
    runTest()
  }, [])

  const runTest = async (): Promise<void> => {
    const r: Results = {}

    if (!LegacyKeystore) {
      r['error'] = 'Native module unavailable (Expo Go?)'
      r['all-passed'] = 'false'
      setResults(r)
      return
    }

    try {
      // ── Phase 1: Migration ──────────────────────────────────

      // Step 1: Clean slate
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setString(
        PreferencesEnum.legacyKeystoreMigrated,
        ''
      )
      r['step01-clean'] = 'true'
      setResults({ ...r })

      // Step 2: Encrypt keys and build auth data
      const encKey1 = encrypt(TEST_PRIVATE_KEY_1, PASSWORD_1)
      const encKey2 = encrypt(TEST_PRIVATE_KEY_2, PASSWORD_2)
      if (!encKey1 || !encKey2) throw new Error('Encryption failed')
      const authDataJson = buildAuthData(encKey1, encKey2)
      JSON.parse(authDataJson) // validate
      r['step02-build-data'] = 'true'
      setResults({ ...r })

      // Step 3: Seed into legacy keystore
      const seeded = await LegacyKeystore.seedLegacyTestData(
        'AD',
        authDataJson
      )
      r['step03-seeded'] = String(seeded)
      setResults({ ...r })

      // Step 4: Read back from legacy
      const legacyRead = await LegacyKeystore.readLegacy('AD')
      r['step04-legacy-read'] = String(legacyRead === authDataJson)
      setResults({ ...r })

      // Step 5: Run migration
      await migrateLegacyKeystore()
      r['step05-migrated'] = 'true'
      setResults({ ...r })

      // Step 6: Read from new expo-secure-store
      const newData = await keystore.read(KeystoreEnum.AuthData)
      r['step06-new-store'] = String(newData === authDataJson)
      setResults({ ...r })

      // Step 7: Verify legacy cleaned up
      const legacyAfter = await LegacyKeystore.readLegacy('AD')
      r['step07-legacy-cleaned'] = String(
        legacyAfter === null || legacyAfter === ''
      )
      setResults({ ...r })

      // Step 8: Idempotent
      await migrateLegacyKeystore()
      const afterSecondRun = await keystore.read(
        KeystoreEnum.AuthData
      )
      r['step08-idempotent'] = String(afterSecondRun === authDataJson)
      setResults({ ...r })

      // ── Phase 2: Decrypt + Validate ─────────────────────────

      // Step 9: Parse migrated data
      const parsed = JSON.parse(newData)
      const walletNames = Object.keys(parsed)
      r['step09-wallet-count'] = String(walletNames.length === 3)
      setResults({ ...r })

      // Step 10: Decrypt wallet 1
      const decrypted1 = decrypt(
        parsed.TestWallet1.encryptedKey,
        PASSWORD_1
      )
      r['step10-decrypt-w1'] = String(
        decrypted1 === TEST_PRIVATE_KEY_1
      )
      setResults({ ...r })

      // Step 11: Decrypt wallet 2
      const decrypted2 = decrypt(
        parsed.TestWallet2.encryptedKey,
        PASSWORD_2
      )
      r['step11-decrypt-w2'] = String(
        decrypted2 === TEST_PRIVATE_KEY_2
      )
      setResults({ ...r })

      // Step 12: Ledger wallet structure
      const ledger = parsed.TestLedgerWallet
      r['step12-ledger'] = String(
        ledger.ledger === true &&
          ledger.address === 'terra1test000e2e000ledger001' &&
          ledger.path === 0
      )
      setResults({ ...r })

      // Step 13: Derive public key
      const pubKeyBytes = secp256k1.getPublicKey(
        hex.decode(decrypted1),
        true
      )
      const pubKeyHex = hex.encode(pubKeyBytes)
      r['step13-pubkey'] = String(pubKeyHex === EXPECTED_PUBKEY_1)
      setResults({ ...r })

      // ── Phase 3: Vault Export + Verification ────────────────

      // Step 14: Export vault share
      const fileUri = await exportVaultShare(
        decrypted1,
        'TestWallet1',
        EXPORT_PASSWORD
      )
      r['step14-export'] = String(fileUri.length > 0)
      setResults({ ...r })

      // Step 15: Read .vult file
      const fileContents = await readAsStringAsync(fileUri)
      r['step15-file-read'] = String(fileContents.length > 0)
      setResults({ ...r })

      // Step 16: Parse VaultContainer
      const containerBytes = base64.decode(fileContents)
      const container = fromBinary(
        VaultContainerSchema,
        containerBytes
      )
      r['step16-container'] = String(
        container.isEncrypted === true && container.version === 1n
      )
      setResults({ ...r })

      // Step 17: Decrypt vault payload
      const encryptedVaultBytes = base64.decode(container.vault)
      const nonce = encryptedVaultBytes.slice(0, 12)
      const ciphertext = encryptedVaultBytes.slice(12)
      const aesKey = sha256(new TextEncoder().encode(EXPORT_PASSWORD))
      const decryptedVaultBytes = gcm(aesKey, nonce).decrypt(
        ciphertext
      )
      r['step17-vault-decrypt'] = String(
        decryptedVaultBytes.length > 0
      )
      setResults({ ...r })

      // Step 18: Parse Vault protobuf
      const vault = fromBinary(VaultSchema, decryptedVaultBytes)
      r['step18-vault-name'] = String(vault.name === 'TestWallet1')
      setResults({ ...r })

      // Step 19: Verify Vault fields
      r['step19-vault-fields'] = String(
        vault.publicKeyEcdsa === EXPECTED_PUBKEY_1 &&
          vault.libType === LibType.KEYIMPORT &&
          vault.keyShares.length === 1 &&
          vault.keyShares[0].keyshare === TEST_PRIVATE_KEY_1 &&
          vault.keyShares[0].publicKey === EXPECTED_PUBKEY_1 &&
          vault.localPartyId === 'station-mobile' &&
          vault.signers.length === 1 &&
          vault.signers[0] === 'station-mobile'
      )
      setResults({ ...r })

      // ── Phase 4: Size Stress Test ───────────────────────────

      // Step 20: Build large payload
      const sizeTestJson = buildSizeTestData(10)
      const byteSize = new TextEncoder().encode(sizeTestJson).length
      r['step20-size-bytes'] = String(byteSize)
      r['step20-over-2k'] = String(byteSize > 2048)
      setResults({ ...r })

      // Step 21: Write to expo-secure-store
      const sizeWritten = await keystore.write(
        KeystoreEnum.AuthData,
        sizeTestJson
      )
      r['step21-size-write'] = String(sizeWritten)
      setResults({ ...r })

      // Step 22: Read back and compare
      const sizeReadBack = await keystore.read(KeystoreEnum.AuthData)
      r['step22-size-match'] = String(sizeReadBack === sizeTestJson)
      setResults({ ...r })

      // Step 23: Report
      r['step23-size-report'] = `${byteSize} bytes, 10 wallets`

      // ── Summary ────────────────────────────────────────────���

      const allPassed =
        r['step01-clean'] === 'true' &&
        r['step02-build-data'] === 'true' &&
        r['step03-seeded'] === 'true' &&
        r['step04-legacy-read'] === 'true' &&
        r['step05-migrated'] === 'true' &&
        r['step06-new-store'] === 'true' &&
        r['step07-legacy-cleaned'] === 'true' &&
        r['step08-idempotent'] === 'true' &&
        r['step09-wallet-count'] === 'true' &&
        r['step10-decrypt-w1'] === 'true' &&
        r['step11-decrypt-w2'] === 'true' &&
        r['step12-ledger'] === 'true' &&
        r['step13-pubkey'] === 'true' &&
        r['step14-export'] === 'true' &&
        r['step15-file-read'] === 'true' &&
        r['step16-container'] === 'true' &&
        r['step17-vault-decrypt'] === 'true' &&
        r['step18-vault-name'] === 'true' &&
        r['step19-vault-fields'] === 'true' &&
        r['step20-over-2k'] === 'true' &&
        r['step21-size-write'] === 'true' &&
        r['step22-size-match'] === 'true'

      r['all-passed'] = String(allPassed)
    } catch (error) {
      r['error'] = String(error)
      r['all-passed'] = 'false'
    }

    // Restore original 3-wallet auth data (size test overwrites it)
    // so migration onboarding tests can relaunch and see wallets
    try {
      const encKey1 = encrypt(TEST_PRIVATE_KEY_1, PASSWORD_1)
      const encKey2 = encrypt(TEST_PRIVATE_KEY_2, PASSWORD_2)
      if (encKey1 && encKey2) {
        const authDataJson = buildAuthData(encKey1, encKey2)
        await keystore.write(KeystoreEnum.AuthData, authDataJson)
      }
      await LegacyKeystore?.clearAllLegacyData()
    } catch {}

    setResults(r)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Full E2E Migration Test</Text>
      <Text style={styles.subtitle}>
        Migration + Decrypt + Vault Export + Size
      </Text>
      {Object.entries(results).map(([key, value]) => {
        const isFail =
          value === 'false' || (key === 'error' && value.length > 0)
        const isPass = value === 'true'
        return (
          <Text
            key={key}
            testID={`e2e-${key}`}
            style={[
              styles.result,
              isFail && styles.fail,
              isPass && styles.pass,
            ]}
          >
            {key}: {value}
          </Text>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 60 },
  title: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
  },
  result: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  pass: { color: '#0f0' },
  fail: { color: '#f44' },
})
