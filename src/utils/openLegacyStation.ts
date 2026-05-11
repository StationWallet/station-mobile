import { Alert, Linking } from 'react-native'

// Production origin is the live legacy Terra Station SPA. In __DEV__ the URL
// can be overridden to a local mirror (e.g. http://127.0.0.1:3001/) via the
// EXPO_PUBLIC_LEGACY_STATION_URL env var — used for E2E development against
// the offline mirror in vultisig-ops/.spikes/station-spa-mirror/.
const PRODUCTION_LEGACY_STATION_URL =
  'https://mobile.station.terra.money/'
const devOverride =
  __DEV__ && process.env.EXPO_PUBLIC_LEGACY_STATION_URL
    ? process.env.EXPO_PUBLIC_LEGACY_STATION_URL
    : null
export const LEGACY_STATION_URL =
  devOverride ?? PRODUCTION_LEGACY_STATION_URL

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
        onPress: (): void => {
          Linking.openURL(LEGACY_STATION_URL).catch((): void => {
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
