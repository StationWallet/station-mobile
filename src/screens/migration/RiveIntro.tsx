import React, { useCallback, useRef, useState } from 'react'
import {
  Animated,
  NativeModules,
  PanResponder,
  PixelRatio,
  Pressable,
  StatusBar,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// Skip Rive only under Detox — its native runtime keeps the iOS main
// run loop busy, blocking Detox idle detection. Normal dev mode loads it.
const isDetox = NativeModules.DetoxManager != null

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded Rive component with no TS definitions
let Rive: any = null
let walletAnimSource: number | null = null
let backgroundAnimSource: number | null = null

if (!isDetox) {
  try {
    Rive = require('rive-react-native').default
    walletAnimSource = require('../../../assets/animations/station_wallet_animation.riv')
    backgroundAnimSource = require('../../../assets/animations/agent_background_transition.riv')
  } catch {
    // rive-react-native not available — will render static fallback
  }
}

const SWIPE_THRESHOLD = 50
const ANIM_INITIAL_TOP = 179
const ANIM_INITIAL_SIZE = 300
const ANIM_FINAL_SIZE = 200
const ANIM_FINAL_TOP = 90

type Nav = StackNavigationProp<MigrationStackParams, 'RiveIntro'>

export default function RiveIntro(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const navigated = useRef(false)
  const { width: screenWidth } = useWindowDimensions()

  // Animated values for the exit transition
  const textOpacity = useRef(new Animated.Value(1)).current
  const textTranslateY = useRef(new Animated.Value(0)).current
  const animScale = useRef(new Animated.Value(1)).current
  const animTop = useRef(new Animated.Value(ANIM_INITIAL_TOP)).current
  const bgOpacity = useRef(new Animated.Value(0)).current

  // Show the background Rive only after gesture starts
  const [showBgTransition, setShowBgTransition] = useState(false)

  const goToHome = useCallback(() => {
    if (navigated.current) return
    navigated.current = true

    // Start the background transition Rive
    setShowBgTransition(true)

    // Run exit animations per Figma annotations
    Animated.parallel([
      // Text dissolves upward: fade out, 300ms linear
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
      // Wallet animation scales down: 300→200 (scale 0.667), 380ms, 40ms delay
      Animated.sequence([
        Animated.delay(40),
        Animated.parallel([
          Animated.timing(animScale, {
            toValue: ANIM_FINAL_SIZE / ANIM_INITIAL_SIZE,
            duration: 380,
            useNativeDriver: false,
          }),
          Animated.timing(animTop, {
            toValue: ANIM_FINAL_TOP,
            duration: 380,
            useNativeDriver: false,
          }),
        ]),
      ]),
      // Dark background fades in
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.replace('MigrationHome')
    })
  }, [
    navigation,
    textOpacity,
    textTranslateY,
    animScale,
    animTop,
    bgOpacity,
  ])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          goToHome()
        }
      },
    })
  ).current

  const animWidth = animScale.interpolate({
    inputRange: [ANIM_FINAL_SIZE / ANIM_INITIAL_SIZE, 1],
    outputRange: [ANIM_FINAL_SIZE, ANIM_INITIAL_SIZE],
  })
  const animHeight = animWidth

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar barStyle="dark-content" />
      {/* Wallet Rive animation */}
      {Rive && walletAnimSource ? (
        <Animated.View
          style={[
            styles.walletAnimation,
            {
              top: animTop,
              width: animWidth,
              height: animHeight,
              left: Animated.subtract(
                screenWidth / 2,
                Animated.divide(animWidth, 2)
              ),
            },
          ]}
        >
          <Rive
            source={walletAnimSource}
            style={StyleSheet.absoluteFill}
            autoplay
            layoutScaleFactor={PixelRatio.get()}
          />
        </Animated.View>
      ) : (
        <View style={styles.animationPlaceholder} />
      )}

      {/* Text area — dissolves upward on transition */}
      <Animated.View
        style={[
          styles.textArea,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.title} fontType="bold">
          {'Station is entering\nthe Vultiverse'}
        </Text>
        <Text style={styles.subtitle} fontType="medium">
          {
            'Your wallet is evolving into something new. Your funds. Better security.\nA whole new experience.'
          }
        </Text>
      </Animated.View>

      {/* CTA — also dissolves out */}
      <Animated.View
        style={[
          styles.ctaWrap,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Pressable onPress={goToHome} testID="enter-vultiverse-cta">
          <Text style={styles.ctaText} fontType="brockmann-semibold">
            Enter the Vultiverse
          </Text>
        </Pressable>
      </Animated.View>

      {/* Dark background transition — rendered on top, fades in */}
      {showBgTransition && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}
          pointerEvents="none"
        >
          {Rive && backgroundAnimSource ? (
            <Rive
              source={backgroundAnimSource}
              style={StyleSheet.absoluteFill}
              autoplay
              layoutScaleFactor={PixelRatio.get()}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: MIGRATION.bg },
              ]}
            />
          )}
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  animationPlaceholder: {
    flex: 1,
  },
  walletAnimation: {
    position: 'absolute',
  },
  textArea: {
    position: 'absolute',
    bottom: 140,
    left: MIGRATION.screenPadding,
    right: MIGRATION.screenPadding,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: MIGRATION.stationBlue,
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.stationBlue,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 18,
  },
})
