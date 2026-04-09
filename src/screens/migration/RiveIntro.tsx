import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// TODO: Wire up Rive animations once artboard/state machine names are known
// and native asset bundling is configured. For now, static splash.

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
    // In dev/test builds, navigate quickly to avoid blocking Detox idle detection.
    // In production, show splash for 3 seconds.
    const delay = __DEV__ ? 100 : 3000
    const timer = setTimeout(goToHome, delay)
    return () => clearTimeout(timer)
  }, [goToHome])

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
})
