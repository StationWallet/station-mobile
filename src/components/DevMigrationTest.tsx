import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import { migrateLegacyKeystore } from 'utils/legacyMigration'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

const TEST_WALLET_DATA = JSON.stringify({
  TestLegacyWallet: {
    ledger: false,
    address: 'terra1test000legacy000migration000addr',
    password: 'testpass',
    encryptedKey: 'abc123encryptedkey',
  },
})

export default function DevMigrationTest(): React.ReactElement {
  const [results, setResults] = useState<Record<string, string>>({})

  useEffect(() => {
    runTest()
  }, [])

  const runTest = async (): Promise<void> => {
    const r: Record<string, string> = {}

    try {
      // Step 1: Clean slate
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setString(PreferencesEnum.legacyKeystoreMigrated, '')
      r['clean'] = 'true'

      // Step 2: Seed legacy data
      const seeded = await LegacyKeystore.seedLegacyTestData('AD', TEST_WALLET_DATA)
      r['seeded'] = String(seeded)

      // Step 3: Verify legacy data is readable via native module
      const legacyRead = await LegacyKeystore.readLegacy('AD')
      r['legacy-readable'] = String(legacyRead === TEST_WALLET_DATA)
      r['legacy-data'] = legacyRead || 'null'

      // Step 4: Run migration
      await migrateLegacyKeystore()
      r['migration-ran'] = 'true'

      // Step 5: Read from new expo-secure-store location
      const newData = await keystore.read(KeystoreEnum.AuthData)
      r['new-readable'] = String(newData === TEST_WALLET_DATA)
      r['new-data'] = newData || 'null'

      // Step 6: Verify legacy data was cleaned up
      const legacyAfter = await LegacyKeystore.readLegacy('AD')
      r['legacy-cleaned'] = String(legacyAfter === null || legacyAfter === '')

      // Step 7: Verify migration is idempotent
      await migrateLegacyKeystore()
      const newDataAfterSecondRun = await keystore.read(KeystoreEnum.AuthData)
      r['idempotent'] = String(newDataAfterSecondRun === TEST_WALLET_DATA)

      // Step 8: Parse the migrated data to verify structure
      const parsed = JSON.parse(newData)
      r['wallet-name'] = Object.keys(parsed)[0] || 'missing'
      r['wallet-address'] = parsed?.TestLegacyWallet?.address || 'missing'

      r['all-passed'] = String(
        r['seeded'] === 'true' &&
        r['legacy-readable'] === 'true' &&
        r['new-readable'] === 'true' &&
        r['legacy-cleaned'] === 'true' &&
        r['idempotent'] === 'true'
      )
    } catch (error) {
      r['error'] = String(error)
      r['all-passed'] = 'false'
    }

    // Clean up after test
    try {
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setString(PreferencesEnum.legacyKeystoreMigrated, '')
    } catch {}

    setResults(r)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Legacy Migration Test Results</Text>
      {Object.entries(results).map(([key, value]) => (
        <Text key={key} testID={`migration-${key}`} style={styles.result}>
          {key}: {value}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 18, marginBottom: 12, fontWeight: 'bold' },
  result: { color: '#0f0', fontSize: 14, marginBottom: 4, fontFamily: 'monospace' },
})
