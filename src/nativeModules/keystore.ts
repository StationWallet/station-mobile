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

export const LEGACY_SERVICE_PREFIX = 'app.keystore'
export const LEGACY_ACCOUNT = 'keystore'

export function keychainOpts(
  key: string
): SecureStore.SecureStoreOptions {
  return {
    keychainService: `${LEGACY_SERVICE_PREFIX}-${key}`,
    keychainAccessible:
      SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  }
}

export default {
  write: async (key: string, value: string): Promise<boolean> => {
    try {
      await SecureStore.setItemAsync(
        LEGACY_ACCOUNT,
        value,
        keychainOpts(key)
      )
      return true
    } catch {
      return false
    }
  },
  read: async (key: string): Promise<string> => {
    try {
      const value = await SecureStore.getItemAsync(
        LEGACY_ACCOUNT,
        keychainOpts(key)
      )
      return value || ''
    } catch {
      return ''
    }
  },
  remove: async (key: string): Promise<boolean> => {
    try {
      await SecureStore.deleteItemAsync(
        LEGACY_ACCOUNT,
        keychainOpts(key)
      )
      return true
    } catch {
      return false
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface requires key param
  migratePreferences: async (_key: string): Promise<void> => {
    // No-op — preferences were in MMKV (now inaccessible after Expo migration).
    // Wallet data is NOT preserved by name matching — the old keychain service was
    // "_secure_storage_service" and the new one is "app.keystore-AD". Migration is
    // handled entirely by migrateLegacyKeystore() in src/utils/legacyMigration.ts.
  },
}
