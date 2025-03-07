import {MMKV} from 'react-native-mmkv';

const storage = new MMKV({
  id: 'app-preferences',
});

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
  setString(key: PreferencesEnum, val: string): void;
  getString(key: PreferencesEnum): Promise<string>;
  setBool(key: PreferencesEnum, val: boolean): void;
  getBool(key: PreferencesEnum): Promise<boolean>;
  remove(key: PreferencesEnum): void;
  clear(): void;
};

const Preferences: PreferencesType = {
  setString(key: PreferencesEnum, val: string): void {
    storage.set(key, val);
  },

  async getString(key: PreferencesEnum): Promise<string> {
    return storage.getString(key) || '';
  },

  setBool(key: PreferencesEnum, val: boolean): void {
    storage.set(key, val);
  },

  async getBool(key: PreferencesEnum): Promise<boolean> {
    return storage.getBoolean(key) || false;
  },

  remove(key: PreferencesEnum): void {
    storage.delete(key);
  },

  clear(): void {
    storage.clearAll();
  },
};

export default Preferences;
