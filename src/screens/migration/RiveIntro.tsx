import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// In dev mode, skip Rive to avoid blocking Detox idle detection.
// In production, load Rive and play the animations.
const Rive = __DEV__ ? null : require('rive-react-native').default

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
    const delay = __DEV__ ? 100 : 8000
    const timer = setTimeout(goToHome, delay)
    return () => clearTimeout(timer)
  }, [goToHome])

  // Dev mode: simple static splash
  if (!Rive) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.stationText} fontType="bold">
            Station Wallet
          </Text>
        </View>
      </View>
    )
  }

  // Production: Rive animations
  return (
    <View style={styles.container}>
      <Rive
        source={require('../../../assets/animations/agent_background_transition.riv')}
        style={StyleSheet.absoluteFill}
        autoplay
        onStop={goToHome}
      />
      <View style={styles.walletAnimation}>
        <Rive
          source={require('../../../assets/animations/station_wallet_animation.riv')}
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationText: {
    fontSize: 20,
    color: MIGRATION.stationBlue,
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
