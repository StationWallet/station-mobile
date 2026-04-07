import * as SecureStore from 'expo-secure-store'

export enum PreferencesEnum {
  settings = 'settings',
  onboarding = 'skipOnboarding',
  useBioAuth = 'useBioAuth',
  firstRun = 'firstRun',
  walletHideSmall = 'walletHideSmall',
  scheme = 'scheme',
  walletConnectSession = 'walletConnectSession',
  stakingFilter = 'stakingFilter',
  tokens = 'tokens',
  legacyKeystoreMigrated = 'legacyKeystoreMigrated',
  vaultsUpgraded = 'vaultsUpgraded',
}

export type PreferencesType = {
  setString(key: PreferencesEnum, val: string): Promise<void>
  getString(key: PreferencesEnum): Promise<string>
  setBool(key: PreferencesEnum, val: boolean): Promise<void>
  getBool(key: PreferencesEnum): Promise<boolean>
  remove(key: PreferencesEnum): Promise<void>
  clear(): Promise<void>
}

const secureOpts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

// Expo SecureStore replacement for native Preferences
const Preferences: PreferencesType = {
  setString: async (key: PreferencesEnum, val: string): Promise<void> => {
    await SecureStore.setItemAsync(key, val, secureOpts)
  },
  getString: async (key: PreferencesEnum): Promise<string> => {
    try {
      const value = await SecureStore.getItemAsync(key, secureOpts)
      return value || ''
    } catch {
      return ''
    }
  },
  setBool: async (key: PreferencesEnum, val: boolean): Promise<void> => {
    await SecureStore.setItemAsync(key, val ? 'true' : 'false', secureOpts)
  },
  getBool: async (key: PreferencesEnum): Promise<boolean> => {
    try {
      const value = await SecureStore.getItemAsync(key, secureOpts)
      return value === 'true'
    } catch {
      return false
    }
  },
  remove: async (key: PreferencesEnum): Promise<void> => {
    await SecureStore.deleteItemAsync(key, secureOpts)
  },
  clear: async (): Promise<void> => {
    // No bulk clear in SecureStore - clear known keys
    await Promise.all(
      Object.values(PreferencesEnum).map((key) =>
        SecureStore.deleteItemAsync(key, secureOpts).catch(() => {})
      )
    )
  },
}

export default Preferences
