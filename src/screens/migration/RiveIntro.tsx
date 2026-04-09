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

  // Safety timeout — navigate even if the animation doesn't fire a
  // completion callback (e.g. looping timeline, missing state machine).
  useEffect(() => {
    const timer = setTimeout(goToHome, 8000)
    return () => clearTimeout(timer)
  }, [goToHome])

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
