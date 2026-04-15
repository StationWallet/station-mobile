import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg'
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'

type Props = {
  onPress: () => void
  children: React.ReactNode
  testID?: string
  size?: number
}

/**
 * Glass-effect circular button matching vultiagent-app's BackButton.
 * iOS: SVG gradient fill + gradient stroke overlay for "liquid" look.
 * Android: flat dark button with subtle border.
 */
export default function GlassButton({
  onPress,
  children,
  testID,
  size = 44,
}: Props): React.ReactElement {
  const radius = size / 2
  const scale = useSharedValue(1)

  const tap = Gesture.Tap()
    .onBegin(() => {
      'worklet'
      scale.value = withSpring(0.9, { damping: 15, stiffness: 300 })
    })
    .onFinalize(() => {
      'worklet'
      scale.value = withSpring(1, { damping: 15, stiffness: 300 })
    })
    .onEnd(() => {
      'worklet'
      runOnJS(onPress)()
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  if (Platform.OS === 'ios') {
    return (
      <GestureDetector gesture={tap}>
        <Animated.View
          testID={testID}
          accessibilityRole="button"
          style={[
            {
              width: size,
              height: size,
              borderRadius: radius,
              overflow: 'visible',
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedStyle,
          ]}
        >
          {/* Background fill gradient — subtle glass effect */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: radius,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          {/* Highlight layer — brighter at top */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: radius,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          />

          {/* Icon content */}
          {children}

          {/* SVG gradient stroke overlay — diagonal white fade */}
          <Svg
            width={size}
            height={size}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <Defs>
              <SvgLinearGradient
                id="glassStroke"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor="white" stopOpacity="1" />
                <Stop
                  offset="35%"
                  stopColor="white"
                  stopOpacity="0"
                />
                <Stop
                  offset="65%"
                  stopColor="white"
                  stopOpacity="0"
                />
                <Stop
                  offset="100%"
                  stopColor="white"
                  stopOpacity="1"
                />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={radius}
              cy={radius}
              r={radius - 0.5}
              stroke="url(#glassStroke)"
              strokeWidth="1"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </GestureDetector>
    )
  }

  // Android: flat dark button with subtle border
  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={testID}
        accessibilityRole="button"
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: 'rgba(11,26,58,0.8)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  )
}
