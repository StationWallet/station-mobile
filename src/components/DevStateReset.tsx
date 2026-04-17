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

/** DEV ONLY: clear all wallet + migration state without a simulator erase. */
export default function DevStateReset(): React.ReactElement {
  const [status, setStatus] = useState('resetting...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    reset()
  }, [])

  const reset = async (): Promise<void> => {
    try {
      const authData = await getAuthData()
      if (authData) {
        await Promise.all(
          Object.keys(authData).map((name) =>
            SecureStore.deleteItemAsync(
              vaultStoreKey(name),
              VAULT_STORE_OPTS
            )
          )
        )
      }

      await keystore.remove(KeystoreEnum.AuthData)

      await Promise.all(
        [
          PreferencesEnum.legacyKeystoreMigrated,
          PreferencesEnum.legacyDataFound,
          PreferencesEnum.vaultsUpgraded,
          PreferencesEnum.firstRun,
        ].map((key) => preferences.setBool(key, false))
      )

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
