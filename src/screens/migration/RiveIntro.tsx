import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import Rive from 'rive-react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

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
    // In dev mode, skip the Rive animation to avoid blocking Detox.
    // In production, the Rive animation plays and onStop triggers navigation.
    const delay = __DEV__ ? 500 : 8000
    const timer = setTimeout(goToHome, delay)
    return () => clearTimeout(timer)
  }, [goToHome])

  if (__DEV__) {
    // Simple splash in dev mode — no Rive to avoid blocking Detox
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* Dev mode: skip Rive animation */}
        </View>
      </View>
    )
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
