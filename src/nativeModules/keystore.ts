import * as SecureStore from 'expo-secure-store'

// Warning. To avoid making duplicate key with wallet name,
// enum string length should NOT be in 5 ~ 20
// AND Don't recommend add to keystore, except wallets-name and bio-auth-data
export enum KeystoreEnum {
  AuthData = 'AD',
}

export type KeystoreType = {
  write(key: string, value: string): Promise<boolean>
  read(key: string): Promise<string>
  remove(key: string): Promise<boolean>
  migratePreferences(key: string): Promise<void>
}

// Match the old react-native-keychain storage location exactly so that
// existing wallet data is accessible after the Expo upgrade.
//
// Old app (react-native-keychain):
//   kSecAttrService = "app.keystore-AD"
//   kSecAttrAccount = "keystore"
//
// expo-secure-store maps:
//   keychainService option → kSecAttrService
//   key parameter          → kSecAttrAccount
//
// So we use keychainService="app.keystore-{key}" and key="keystore".
const LEGACY_SERVICE_PREFIX = 'app.keystore'
const LEGACY_ACCOUNT = 'keystore'

function keychainOpts(key: string): SecureStore.SecureStoreOptions {
  return { keychainService: `${LEGACY_SERVICE_PREFIX}-${key}` }
}

export default {
  write: async (key: string, value: string): Promise<boolean> => {
    try {
      await SecureStore.setItemAsync(LEGACY_ACCOUNT, value, keychainOpts(key))
      return true
    } catch {
      return false
    }
  },
  read: async (key: string): Promise<string> => {
    try {
      const value = await SecureStore.getItemAsync(LEGACY_ACCOUNT, keychainOpts(key))
      return value || ''
    } catch {
      return ''
    }
  },
  remove: async (key: string): Promise<boolean> => {
    try {
      await SecureStore.deleteItemAsync(LEGACY_ACCOUNT, keychainOpts(key))
      return true
    } catch {
      return false
    }
  },
  migratePreferences: async (_key: string): Promise<void> => {
    // No-op — preferences were in MMKV (lost on upgrade).
    // Wallet data is preserved via matching the old keychain service name.
  },
}
