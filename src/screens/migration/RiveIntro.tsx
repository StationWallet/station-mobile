import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, StyleSheet, NativeModules } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { Asset } from 'expo-asset'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// Detox sets DetoxManager native module. When running under Detox,
// skip Rive to avoid blocking idle detection.
const isDetox = NativeModules.DetoxManager != null

// Lazy-load rive-react-native only when needed
const Rive = isDetox ? null : require('rive-react-native').default

// Pre-resolve asset modules (Metro asset IDs)
const bgAssetModule = require('../../../assets/animations/agent_background_transition.riv')
const walletAssetModule = require('../../../assets/animations/station_wallet_animation.riv')

type Nav = StackNavigationProp<MigrationStackParams, 'RiveIntro'>

export default function RiveIntro() {
  const navigation = useNavigation<Nav>()
  const navigated = useRef(false)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [walletUrl, setWalletUrl] = useState<string | null>(null)

  const goToHome = useCallback(() => {
    if (navigated.current) return
    navigated.current = true
    navigation.replace('MigrationHome')
  }, [navigation])

  // Resolve .riv assets to local file URIs via expo-asset
  useEffect(() => {
    if (!Rive) return
    async function loadAssets() {
      try {
        const [bgAsset, walletAsset] = await Promise.all([
          Asset.fromModule(bgAssetModule).downloadAsync(),
          Asset.fromModule(walletAssetModule).downloadAsync(),
        ])
        setBgUrl(bgAsset.localUri ?? bgAsset.uri)
        setWalletUrl(walletAsset.localUri ?? walletAsset.uri)
      } catch (err) {
        console.warn('[RiveIntro] Failed to load assets:', err)
        goToHome()
      }
    }
    loadAssets()
  }, [goToHome])

  useEffect(() => {
    // Under Detox, skip animation and navigate immediately.
    // Otherwise, safety timeout in case animation doesn't fire onStop.
    const delay = isDetox ? 500 : 8000
    const timer = setTimeout(goToHome, delay)
    return () => clearTimeout(timer)
  }, [goToHome])

  if (!Rive) {
    return <View style={styles.container} />
  }

  // Wait for assets to resolve before rendering Rive
  if (!bgUrl || !walletUrl) {
    return <View style={styles.container} />
  }

  return (
    <View style={styles.container}>
      <Rive
        url={bgUrl}
        style={StyleSheet.absoluteFill}
        autoplay
        onStop={goToHome}
      />
      <View style={styles.walletAnimation}>
        <Rive
          url={walletUrl}
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
