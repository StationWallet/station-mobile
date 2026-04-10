import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

/**
 * DEV ONLY: Seeds wallet data with a CORRUPTED encrypted key into the old
 * native keystore. When KeygenProgress tries to decrypt this key, it will
 * fail deterministically — enabling skip/retry UI testing without needing
 * vultiserver to be unreachable.
 *
 * Wallets seeded:
 *   - CorruptWallet: bad encryptedKey → decrypt fails → keygen error
 *   - TestLedgerWallet: ledger → auto-skipped (no DKLS)
 */
export default function DevSeedCorruptData(): React.ReactElement {
  const [status, setStatus] = useState('seeding corrupt data...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    seed()
  }, [])

  const seed = async (): Promise<void> => {
    try {
      if (!LegacyKeystore) {
        setStatus('error: native module unavailable')
        setDone(true)
        return
      }

      // 1. Clear everything
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated,
        false
      )
      await preferences.setBool(
        PreferencesEnum.legacyDataFound,
        false
      )
      await preferences.setBool(PreferencesEnum.vaultsUpgraded, false)
      await preferences.setBool(PreferencesEnum.firstRun, false)

      // 2. Build auth data with a CORRUPT encrypted key
      // The encryptedKey is garbage that won't decrypt with any password
      const authData = JSON.stringify({
        CorruptWallet: {
          ledger: false,
          address: 'terra1corrupt000e2e000wallet',
          password: 'wrongPassword',
          encryptedKey: 'CORRUPT_NOT_REAL_ENCRYPTED_DATA_xxxxx',
        },
        TestLedgerWallet: {
          ledger: true,
          address: 'terra1test000e2e000ledger001',
          path: 0,
        },
      })

      // 3. Write ONLY to the old native keystore
      const seeded = await LegacyKeystore.seedLegacyTestData(
        'AD',
        authData
      )
      if (!seeded)
        throw new Error('seedLegacyTestData returned false')

      // 4. Verify readback
      const readBack = await LegacyKeystore.readLegacy('AD')
      if (readBack !== authData)
        throw new Error('Legacy readback mismatch')

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
      <Text testID="seed-corrupt-status" style={styles.text}>
        {status}
      </Text>
      {done && (
        <Text testID="seed-corrupt-done" style={styles.text}>
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
