import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import {
  VAULT_STORE_OPTS,
  vaultStoreKey,
} from 'services/migrateToVault'
import { getAuthData } from 'utils/authData'

/**
 * DEV ONLY: reset all wallet/migration state without erasing the
 * simulator. Lets Detox UI tests share a single simulator boot
 * across suites instead of eating ~2 min per suite on `simctl erase`.
 */
export default function DevStateReset(): React.ReactElement {
  const [status, setStatus] = useState('resetting...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    reset()
  }, [])

  const reset = async (): Promise<void> => {
    try {
      // Clear per-wallet vault blobs written by migrateToVault.
      const authData = await getAuthData()
      if (authData) {
        for (const name of Object.keys(authData)) {
          await SecureStore.deleteItemAsync(
            vaultStoreKey(name),
            VAULT_STORE_OPTS
          )
        }
      }

      // Clear the auth data (wallet list) itself.
      await keystore.remove(KeystoreEnum.AuthData)

      // Reset migration-flow boolean flags.
      for (const key of [
        PreferencesEnum.legacyKeystoreMigrated,
        PreferencesEnum.legacyDataFound,
        PreferencesEnum.vaultsUpgraded,
        PreferencesEnum.firstRun,
      ]) {
        await preferences.setBool(key, false)
      }

      // Clear the old native keystore too.
      if (LegacyKeystore) {
        await LegacyKeystore.clearAllLegacyData()
      }

      setStatus('done')
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
      <Text testID="dev-reset-status" style={styles.text}>
        {status}
      </Text>
      {done && (
        <Text testID="dev-reset-done" style={styles.text}>
          reset
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
