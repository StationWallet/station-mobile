import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'app.keystore';

// Warning. To avoid making duplicate key with wallet name,
// enum string length should NOT be in 5 ~ 20
// AND Don't recommend add to keystore, except wallets-name and bio-auth-data
export enum KeystoreEnum {
  AuthData = 'AD',
}

export type KeystoreType = {
  write(key: string, value: string): void
  read(key: string): Promise<string>
  remove(key: string): void
}

export default {
  write: (key: string, value: string): boolean => {
    try {
      Keychain.setGenericPassword('keystore', value, {
        service: `${SERVICE_NAME}-${key}`
      });
      return true;
    } catch {
      return false;
    }
  },

  read: async (key: string): Promise<string> => {
    try {
      const result = await Keychain.getGenericPassword({
        service: `${SERVICE_NAME}-${key}`
      });

      if (result) {
        return result.password;
      }
      return '';
    } catch {
      return '';
    }
  },

  remove: (key: string): boolean => {
    try {
      Keychain.resetGenericPassword({
        service: `${SERVICE_NAME}-${key}`
      });
      return true;
    } catch {
      return false;
    }
  },
};
