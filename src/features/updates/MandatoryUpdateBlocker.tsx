// Full-screen mandatory-update blocker. Renders over the entire app
// when an OTA is available for the current native runtime. The user
// cannot proceed without applying the update — there's no Later / dismiss
// affordance by design. Minimal surface: title, one Update button,
// retry-able error if the apply fails.
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Text from 'components/Text'

import { useMandatoryUpdateController } from './useMandatoryUpdateController'

const BUTTON_BLUE = '#3267F0'
const BUTTON_BLUE_PRESSED = '#2956DB'
const BG = '#02122B'
const TEXT_PRIMARY = '#F7FBFF'
const TEXT_MUTED = 'rgba(247,251,255,0.72)'
const ERROR_RED = '#FF6B6B'

/**
 * Renders nothing when no OTA is available. Otherwise renders a full-screen
 * blocker positioned over its sibling content via a parent `position:
 * 'absolute'` wrapper in the integrating component. Designed to mount as
 * a sibling of the NavigationContainer so it overlays every route.
 */
export function MandatoryUpdateBlocker(): React.ReactElement | null {
  const { shouldBlock, isApplying, applyError, applyUpdate } =
    useMandatoryUpdateController()
  const insets = useSafeAreaInsets()

  if (!shouldBlock) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="App update required"
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        },
      ]}
      // Pointer events on so we intercept all interactions with the
      // navigator underneath. Without this, taps would leak through
      // the transparent regions and the user could still interact.
      pointerEvents="auto"
    >
      <View style={styles.center}>
        <Text fontType="brockmann-medium" style={styles.title}>
          Update available
        </Text>
        {applyError ? (
          <Text fontType="brockmann-medium" style={styles.error}>
            {applyError}
          </Text>
        ) : (
          <Text fontType="brockmann-medium" style={styles.subtitle}>
            A new version of Station is ready.
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isApplying
            ? 'Applying update'
            : applyError
            ? 'Retry update'
            : 'Update now'
        }
        accessibilityState={{
          disabled: isApplying,
          busy: isApplying,
        }}
        onPress={applyUpdate}
        disabled={isApplying}
        style={({ pressed }): object => [
          styles.button,
          {
            backgroundColor: isApplying
              ? 'rgba(50,103,240,0.5)'
              : pressed
              ? BUTTON_BLUE_PRESSED
              : BUTTON_BLUE,
          },
        ]}
      >
        {isApplying ? (
          <ActivityIndicator color={TEXT_PRIMARY} />
        ) : (
          <Text fontType="brockmann-bold" style={styles.buttonText}>
            {applyError ? 'Retry' : 'Update'}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    // Filled absolute overlay — covers the entire screen including
    // status-bar safe-area. The integrating parent positions us absolute,
    // we just paint edge-to-edge inside that.
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  error: {
    color: ERROR_RED,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 20,
  },
})
