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
}

export type PreferencesType = {
  setString(key: PreferencesEnum, val: string): void
  getString(key: PreferencesEnum): Promise<string>
  setBool(key: PreferencesEnum, val: boolean): void
  getBool(key: PreferencesEnum): Promise<boolean>
  remove(key: PreferencesEnum): void
  clear(): void
}

// Expo SecureStore replacement for native Preferences
const Preferences: PreferencesType = {
  setString: (key: PreferencesEnum, val: string): void => {
    SecureStore.setItem(key, val)
  },
  getString: async (key: PreferencesEnum): Promise<string> => {
    try {
      const value = await SecureStore.getItemAsync(key)
      return value || ''
    } catch {
      return ''
    }
  },
  setBool: (key: PreferencesEnum, val: boolean): void => {
    SecureStore.setItem(key, val ? 'true' : 'false')
  },
  getBool: async (key: PreferencesEnum): Promise<boolean> => {
    try {
      const value = await SecureStore.getItemAsync(key)
      return value === 'true'
    } catch {
      return false
    }
  },
  remove: (key: PreferencesEnum): void => {
    SecureStore.deleteItemAsync(key)
  },
  clear: (): void => {
    // No bulk clear in SecureStore - clear known keys
    Object.values(PreferencesEnum).forEach((key) => {
      try { SecureStore.deleteItemAsync(key) } catch {}
    })
  },
}

export default Preferences
