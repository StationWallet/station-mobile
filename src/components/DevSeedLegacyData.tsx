import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import { encrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'

// Well-known secp256k1 test vectors (not funded keys)
const TEST_PRIVATE_KEY_1 = '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_2 = '0000000000000000000000000000000000000000000000000000000000000002'
const PASSWORD_1 = 'testPassword1!'
const PASSWORD_2 = 'testPassword2!'

/**
 * DEV ONLY: Seeds wallet data into the OLD native keystore format,
 * simulating a pre-upgrade Station app installation. Does NOT run
 * migration — that happens on the next app launch via migrateLegacyKeystore().
 *
 * Used by Detox E2E tests to set up the real upgrade scenario.
 */
export default function DevSeedLegacyData(): React.ReactElement {
  const [status, setStatus] = useState('seeding...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    seed()
  }, [])

  const seed = async () => {
    try {
      if (!LegacyKeystore) {
        setStatus('error: native module unavailable')
        setDone(true)
        return
      }

      // 1. Clear everything — old keystore, new keystore, all migration flags
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setBool(PreferencesEnum.legacyKeystoreMigrated, false)
      await preferences.setBool(PreferencesEnum.legacyDataFound, false)
      await preferences.setBool(PreferencesEnum.vaultsUpgraded, false)
      await preferences.setBool(PreferencesEnum.firstRun, false)

      // 2. Build auth data with encrypted keys (same format the old app used)
      const encKey1 = encrypt(TEST_PRIVATE_KEY_1, PASSWORD_1)
      const encKey2 = encrypt(TEST_PRIVATE_KEY_2, PASSWORD_2)
      if (!encKey1 || !encKey2) throw new Error('Encryption failed')

      const authData = JSON.stringify({
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

      // 3. Write ONLY to the old native keystore (not the new expo-secure-store)
      const seeded = await LegacyKeystore.seedLegacyTestData('AD', authData)
      if (!seeded) throw new Error('seedLegacyTestData returned false')

      // 4. Verify we can read it back from old keystore
      const readBack = await LegacyKeystore.readLegacy('AD')
      if (readBack !== authData) throw new Error('Legacy readback mismatch')

      // 5. Verify new keystore is empty (migration hasn't run yet)
      const newData = await keystore.read(KeystoreEnum.AuthData)
      if (newData) throw new Error('New keystore should be empty before migration')

      setStatus('seeded')
      setDone(true)
    } catch (e) {
      setStatus(`error: ${e instanceof Error ? e.message : String(e)}`)
      setDone(true)
    }
  }

  return (
    <View style={styles.container}>
      <Text testID="seed-status" style={styles.text}>{status}</Text>
      {done && <Text testID="seed-done" style={styles.text}>done</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#02122B' },
  text: { color: '#fff', fontSize: 16, marginVertical: 4 },
})
