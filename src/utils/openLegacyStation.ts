import { Alert, Linking } from 'react-native'

export const LEGACY_STATION_URL = 'https://mobile.station.terra.money/'

/**
 * Opens the legacy Station PWA in the user's default browser.
 * Shows a confirmation dialog first so users understand the app is unmaintained.
 */
export function openLegacyStation(): void {
  Alert.alert(
    'Open legacy Station',
    'This opens the legacy Station web app in your browser. The legacy app is no longer maintained — use it at your own risk.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open',
        onPress: () => {
          Linking.openURL(LEGACY_STATION_URL).catch(() => {
            Alert.alert(
              'Could not open URL',
              'Please visit mobile.station.terra.money manually.'
            )
          })
        },
      },
    ]
  )
}
