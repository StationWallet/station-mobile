import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// TODO: Wire up Rive animations once artboard/state machine names are known.
// The .riv files are in assets/animations/ but need Metro running to resolve.
// For now, show a static splash that transitions from light to dark.

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
    const timer = setTimeout(goToHome, 3000)
    return () => clearTimeout(timer)
  }, [goToHome])

  return (
    <View style={styles.container}>
      {/* Phase 1: Station logo on white (fades out) */}
      <Animated.View
        entering={FadeIn.duration(500)}
        exiting={FadeOut.delay(1500).duration(800)}
        style={styles.lightPhase}
      >
        <Text style={styles.stationText} fontType="bold">
          Station Wallet
        </Text>
      </Animated.View>

      {/* Phase 2: Dark Vultisig background (fades in) */}
      <Animated.View
        entering={FadeIn.delay(1800).duration(800)}
        style={styles.darkPhase}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  lightPhase: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  stationText: {
    fontSize: 20,
    color: MIGRATION.stationBlue,
  },
  darkPhase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MIGRATION.bg,
  },
})
