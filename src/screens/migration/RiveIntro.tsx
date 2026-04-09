import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet, NativeModules } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// Detox sets the "isDetoxSync" launch arg. When running under Detox,
// skip Rive to avoid blocking idle detection. In normal dev mode, show it.
const isDetox = NativeModules.DetoxManager != null

// Lazy-load rive-react-native only when needed — importing it at
// module scope causes its native runtime to initialize, which keeps
// the main run loop busy and blocks Detox idle detection.
const Rive = isDetox ? null : require('rive-react-native').default

type Nav = StackNavigationProp<MigrationStackParams, 'RiveIntro'>

export default function RiveIntro() {
  const navigation = useNavigation<Nav>()
  const navigated = useRef(false)

  const goToHome = useCallback(() => {
    if (navigated.current) return
    navigated.current = true
    navigation.replace('MigrationHome')
  }, [navigation])

  useEffect(() => {
    // Under Detox, skip animation and navigate immediately.
    // Otherwise, safety timeout in case animation doesn't fire onStop.
    const delay = isDetox ? 500 : 8000
    const timer = setTimeout(goToHome, delay)
    return () => clearTimeout(timer)
  }, [goToHome])

  if (!Rive) {
    // Detox mode: no Rive, auto-navigate via timeout above
    return <View style={styles.container} />
  }

  return (
    <View style={styles.container}>
      {/* Background layer: white-to-dark-blue transition */}
      <Rive
        resourceName="agent_background_transition"
        style={StyleSheet.absoluteFill}
        autoplay
        onStop={goToHome}
      />

      {/* Foreground layer: wallet connector animation */}
      <View style={styles.walletAnimation}>
        <Rive
          resourceName="station_wallet_animation"
          style={styles.walletRive}
          autoplay
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  walletAnimation: {
    position: 'absolute',
    top: 179,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  walletRive: {
    width: 300,
    height: 300,
  },
})
