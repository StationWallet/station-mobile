import * as SecureStore from 'expo-secure-store'

// Warning. To avoid making duplicate key with wallet name,
// enum string length should NOT be in 5 ~ 20
// AND Don't recommend add to keystore, except wallets-name and bio-auth-data
export enum KeystoreEnum {
  AuthData = 'AD',
}

export type KeystoreType = {
  write(key: string, value: string): boolean
  read(key: string): Promise<string>
  remove(key: string): boolean
  migratePreferences(key: string): Promise<void>
}

// Expo SecureStore replacement for native Keystore
export default {
  write: (key: string, value: string): boolean => {
    try {
      SecureStore.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  read: async (key: string): Promise<string> => {
    try {
      const value = await SecureStore.getItemAsync(key)
      return value || ''
    } catch {
      return ''
    }
  },
  remove: (key: string): boolean => {
    try {
      SecureStore.deleteItemAsync(key)
      return true
    } catch {
      return false
    }
  },
  migratePreferences: async (_key: string): Promise<void> => {
    // No-op for Expo migration - old native preferences are not accessible
  },
}
