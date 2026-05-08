import React, { useEffect, useState } from 'react'
import { Alert, Text, StyleSheet, View, Platform } from 'react-native'
import LegacyKeystore from '../../modules/legacy-keystore-migration/src'
import { encrypt } from 'utils/crypto'
import keystore, { KeystoreEnum } from 'nativeModules/keystore'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

// Well-known secp256k1 test vectors (not funded keys).
// Identical to DevSeedLegacyData.tsx so migration assertions stay uniform.
const TEST_PRIVATE_KEY_1 =
  '0000000000000000000000000000000000000000000000000000000000000001'
const TEST_PRIVATE_KEY_2 =
  '0000000000000000000000000000000000000000000000000000000000000002'
const PASSWORD_1 = 'testPassword1!'
const PASSWORD_2 = 'testPassword2!'

/**
 * DEV ONLY (Android): Seeds wallet data into the OLD StorageCipher18 RSA+AES
 * format — the pre-2021-07-22 cohort whose data the V1 migration could only
 * detect, never decrypt. Used by Android E2E tests to validate the new
 * decryption path without needing a real years-old install.
 *
 * On iOS, the native function returns false (no equivalent format), so this
 * component renders an explanatory message instead of seeding.
 *
 * Companion to DevSeedLegacyData.tsx, which targets the modern Android
 * EncryptedSharedPreferences format and the iOS Keychain+AES format.
 */
export default function DevSeedLegacyDataAndroidV1(): React.ReactElement {
  const [status, setStatus] = useState('seeding...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    seed()
  }, [])

  const doSeed = async (): Promise<void> => {
    try {
      if (!LegacyKeystore) {
        setStatus('error: native module unavailable')
        setDone(true)
        return
      }

      if (Platform.OS !== 'android') {
        setStatus(
          'StorageCipher18 format is Android-only; this seeder is a no-op on iOS'
        )
        setDone(true)
        return
      }

      // 1. Clear everything — old keystore (both formats), new keystore, all
      // migration flags (including V2 so the retry path runs).
      await LegacyKeystore.clearAllLegacyData()
      await keystore.remove(KeystoreEnum.AuthData)
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigrated,
        false
      )
      await preferences.setBool(
        PreferencesEnum.legacyKeystoreMigratedV2,
        false
      )
      await preferences.setBool(
        PreferencesEnum.legacyDataFound,
        false
      )
      await preferences.setBool(PreferencesEnum.vaultsUpgraded, false)
      await preferences.setBool(PreferencesEnum.firstRun, false)

      // 2. Build auth data with encrypted keys (same format the old app used).
      const encKey1 = encrypt(TEST_PRIVATE_KEY_1, PASSWORD_1)
      const encKey2 = encrypt(TEST_PRIVATE_KEY_2, PASSWORD_2)
      if (!encKey1 || !encKey2) throw new Error('Encryption failed')

      // Wallet names and address placeholders are DISTINCT from the modern
      // V1 cohort (DevSeedLegacyData) so testers can visually confirm that
      // the StorageCipher18 RSA+AES decryption path ran rather than the
      // EncryptedSharedPreferences fallback.
      const authData = JSON.stringify({
        StorageCipher18Wallet1: {
          ledger: false,
          address: 'terra1cipher18000wallet001',
          password: PASSWORD_1,
          encryptedKey: encKey1,
        },
        StorageCipher18Wallet2: {
          ledger: false,
          address: 'terra1cipher18000wallet002',
          password: PASSWORD_2,
          encryptedKey: encKey2,
        },
        StorageCipher18LedgerWallet: {
          ledger: true,
          address: 'terra1cipher18000ledger001',
          path: 0,
        },
      })

      // 3. Write to the OLD RSA+AES StorageCipher18 location only — this is
      // exactly the format that v5.0.x detected but failed to decrypt.
      const seeded =
        await LegacyKeystore.seedLegacyTestDataStorageCipher18(
          'AD',
          authData
        )
      if (!seeded) {
        throw new Error(
          'seedLegacyTestDataStorageCipher18 returned false — Android Keystore unavailable?'
        )
      }

      // 4. Round-trip verification: readLegacy should recover the same bytes
      // via the new RSA+AES decryption path.
      const readBack = await LegacyKeystore.readLegacy('AD')
      if (readBack !== authData) {
        throw new Error(
          `Legacy readback mismatch — got ${
            readBack === null ? 'null' : `${readBack.length}b`
          }, expected ${authData.length}b`
        )
      }

      // 5. New keystore must still be empty (migration runs on next launch).
      const newData = await keystore.read(KeystoreEnum.AuthData)
      if (newData) {
        throw new Error(
          'New keystore should be empty before migration'
        )
      }

      setStatus('seeded')
      setDone(true)
    } catch (e) {
      setStatus(
        `error: ${e instanceof Error ? e.message : String(e)}`
      )
      setDone(true)
    }
  }

  const seed = (): void => {
    if (!__DEV__) {
      throw new Error(
        'DevSeedLegacyDataAndroidV1 cannot run in production'
      )
    }
    Alert.alert(
      'Seed StorageCipher18 Dev Data',
      'This will wipe all wallet and migration state. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: (): void => {
            setStatus('cancelled')
            setDone(true)
          },
        },
        {
          text: 'Seed',
          style: 'destructive',
          onPress: (): void => {
            void doSeed()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <Text testID="seed-v1-status" style={styles.text}>
        {status}
      </Text>
      {done && (
        <Text testID="seed-v1-done" style={styles.text}>
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
