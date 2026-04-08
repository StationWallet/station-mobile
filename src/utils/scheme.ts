import { Linking } from 'react-native'

import { UTIL } from 'consts'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'

export const parseDynamicLinkURL = (
  value: string
): URL | undefined => {
  const url = UTIL.tryNewURL(value)
  const link = url?.searchParams.get('link')
  if (link) {
    return UTIL.tryNewURL(link)
  }
}

export const storeScheme = async (url: string): Promise<void> => {
  if (url && url !== '') {
    await preferences.setString(PreferencesEnum.scheme, url)
  }
}

export const loadScheme = async (url: string): Promise<void> => {
  if (url && url !== '') {
    try {
      Linking.openURL(url)
    } finally {
      await preferences.setString(PreferencesEnum.scheme, '')
    }
  }
}
