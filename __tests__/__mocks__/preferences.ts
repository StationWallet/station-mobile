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
  legacyDataFound = 'legacyDataFound',
  vaultsUpgraded = 'vaultsUpgraded',
  terraOnlyBackfilled = 'terraOnlyBackfilled',
}

const strings = new Map<string, string>()
const bools = new Map<string, boolean>()

export function __reset(): void {
  strings.clear()
  bools.clear()
}

const preferences = {
  setString: async (key: PreferencesEnum, val: string): Promise<void> => {
    strings.set(key, val)
  },
  getString: async (key: PreferencesEnum): Promise<string> => {
    return strings.get(key) ?? ''
  },
  setBool: async (key: PreferencesEnum, val: boolean): Promise<void> => {
    bools.set(key, val)
  },
  getBool: async (key: PreferencesEnum): Promise<boolean> => {
    return bools.get(key) ?? false
  },
  remove: async (key: PreferencesEnum): Promise<void> => {
    strings.delete(key)
    bools.delete(key)
  },
  clear: async (): Promise<void> => {
    strings.clear()
    bools.clear()
  },
}

export default preferences
