import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import { encrypt } from 'utils/crypto'
import { upsertAuthData } from 'utils/authData'
import { migrateWalletToVault } from 'services/migrateToVault'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

// Same test vectors as DevSeedLegacyData
const TEST_PRIVATE_KEY_1 =
  '0000000000000000000000000000000000000000000000000000000000000001'
const PASSWORD_1 = 'testPassword1!'

/**
 * DEV ONLY: Creates a KEYIMPORT (legacy) vault directly in the new keystore,
 * sets vaultsUpgraded=true, and puts the app in the "Main" route state.
 *
 * This simulates a user who went through the old (non-DKLS) migration.
 * The wallet appears with a "Legacy" badge and "Upgrade to Fast Vault" button
 * in the main wallet UI.
 *
 * Used by the retry-from-main-UI E2E test.
 */
export default function DevSeedPreMigrated(): React.ReactElement {
  const [status, setStatus] = useState('seeding pre-migrated...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    seed()
  }, [])

  const seed = async (): Promise<void> => {
    try {
      // 1. Clear existing data
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setBool(PreferencesEnum.firstRun, false)

      // 2. Encrypt and write auth data directly to new keystore
      const encKey1 = encrypt(TEST_PRIVATE_KEY_1, PASSWORD_1)
      if (!encKey1) throw new Error('Encryption failed')

      const walletEntry = {
        ledger: false as const,
        address: 'terra1test000e2e000wallet001',
        password: PASSWORD_1,
        encryptedKey: encKey1,
      }

      await upsertAuthData({ authData: { TestWallet1: walletEntry } })

      // 3. Run old-style migration to create KEYIMPORT vault
      const result = await migrateWalletToVault(
        'TestWallet1',
        walletEntry
      )
      if (!result.success) {
        throw new Error(`Migration failed: ${result.error}`)
      }

      // 4. Set flags so app goes to Main route (skip migration flow)
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated,
        true
      )
      await preferences.setBool(PreferencesEnum.legacyDataFound, true)
      await preferences.setBool(PreferencesEnum.vaultsUpgraded, true)

      setStatus('seeded')
      setDone(true)
    } catch (e) {
      setStatus(
        `error: ${e instanceof Error ? e.message : String(e)}`
      )
      setDone(true)
    }
  }

  return (
    <View style={styles.container}>
      <Text testID="seed-premigrated-status" style={styles.text}>
        {status}
      </Text>
      {done && (
        <Text testID="seed-premigrated-done" style={styles.text}>
          done
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#02122B',
  },
  text: { color: '#fff', fontSize: 16, marginVertical: 4 },
})
