import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  Easing,
  NativeModules,
  PanResponder,
  PixelRatio,
  Pressable,
  StatusBar,
  View,
  StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Svg, { Path } from 'react-native-svg'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

function ChevronUpIcon(): React.ReactElement {
  return (
    <Svg width={20} height={12} viewBox="0 0 20 12" fill="none">
      <Path
        d="M2 10L10 2L18 10"
        stroke={MIGRATION.textTertiary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

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
const WALLET_ANIM_SIZE = 300
const WALLET_EXIT_SCALE = 200 / 300 // 0.667

type Nav = StackNavigationProp<MigrationStackParams, 'RiveIntro'>

export default function RiveIntro(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const navigated = useRef(false)

  // Animated values for the exit transition — all native-driver compatible
  const textOpacity = useRef(new Animated.Value(1)).current
  const textTranslateY = useRef(new Animated.Value(0)).current
  const walletScale = useRef(new Animated.Value(1)).current
  const walletTranslateY = useRef(new Animated.Value(0)).current
  const bgOpacity = useRef(new Animated.Value(0)).current

  // Show the background Rive only after gesture starts
  const [showBgTransition, setShowBgTransition] = useState(false)

  // Looping bob for the swipe-up hint chevron
  const chevronBob = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronBob, {
          toValue: -6,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(chevronBob, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return (): void => {
      loop.stop()
    }
  }, [chevronBob])

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
      // Wallet animation scales down and moves up, 380ms, 40ms delay
      Animated.sequence([
        Animated.delay(40),
        Animated.parallel([
          Animated.timing(walletScale, {
            toValue: WALLET_EXIT_SCALE,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(walletTranslateY, {
            toValue: -60,
            duration: 380,
            useNativeDriver: true,
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
    walletScale,
    walletTranslateY,
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

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar barStyle="dark-content" />

      {/* Top spacer pushes wallet to roughly center-upper area */}
      <View style={styles.topSpacer} />

      {/* Wallet Rive animation — in normal flow, centered */}
      {Rive && walletAnimSource ? (
        <Animated.View
          style={[
            styles.walletAnimation,
            {
              transform: [
                { scale: walletScale },
                { translateY: walletTranslateY },
              ],
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
        <View style={styles.walletAnimation} />
      )}

      {/* Flexible space between wallet and text */}
      <View style={styles.flex1} />

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
          <Animated.View
            style={[
              styles.chevron,
              { transform: [{ translateY: chevronBob }] },
            ]}
          >
            <ChevronUpIcon />
          </Animated.View>
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
    alignItems: 'center',
  },
  topSpacer: {
    flex: 1.2,
  },
  walletAnimation: {
    width: WALLET_ANIM_SIZE,
    height: WALLET_ANIM_SIZE,
    alignSelf: 'center',
  },
  flex1: {
    flex: 1,
  },
  textArea: {
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 16,
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
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 60,
  },
  ctaText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 18,
  },
  chevron: {
    alignItems: 'center',
    marginBottom: 6,
  },
})
