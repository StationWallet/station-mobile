import React from 'react'
import { Image, NativeModules, StyleSheet, View } from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Ellipse,
} from 'react-native-svg'

const SIZE = 200

// SVG viewport — tall enough to contain the upward cone glow
const SVG_W = 520
const SVG_H = 700

// Skip Rive under Detox — same pattern as RiveIntro
const isDetox = NativeModules.DetoxManager != null

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded Rive component
let Rive: any = null
let walletAnimUrl: string | null = null

if (!isDetox) {
  try {
    Rive = require('rive-react-native').default
    walletAnimUrl =
      Image.resolveAssetSource(
        require('../../../assets/animations/station_wallet_animation.riv')
      )?.uri ?? null
  } catch {
    // rive-react-native not available — static fallback
  }
}

/**
 * Station wallet Rive animation with a cone-shaped blue glow behind it.
 * Two vertically-elongated ellipses create a smooth upward glow,
 * matching the Figma "Migration Wizard - 2" design.
 */
export default function RocketWithGlow(): React.ReactElement {
  const cx = SVG_W / 2
  const rocketCenterY = SVG_H - SIZE / 2

  return (
    <View style={styles.container}>
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={styles.glow}
      >
        <Defs>
          {/* Wide cone glow */}
          <RadialGradient id="glowMain" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1850d4" stopOpacity="0.45" />
            <Stop offset="30%" stopColor="#1245b0" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#0c2d7a" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#02122b" stopOpacity="0" />
          </RadialGradient>
          {/* Bright core near rocket */}
          <RadialGradient id="glowCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#2563eb" stopOpacity="0.55" />
            <Stop offset="40%" stopColor="#1d4ed8" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#02122b" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Main cone — wide, tall ellipse centered above rocket */}
        <Ellipse
          cx={cx}
          cy={rocketCenterY - 140}
          rx={250}
          ry={340}
          fill="url(#glowMain)"
        />
        {/* Bright core — smaller ellipse near rocket center */}
        <Ellipse
          cx={cx}
          cy={rocketCenterY - 30}
          rx={110}
          ry={140}
          fill="url(#glowCore)"
        />
      </Svg>

      {/* Station wallet Rive animation — same as RiveIntro */}
      {Rive && walletAnimUrl ? (
        <View style={styles.riveWrapper}>
          <Rive
            url={walletAnimUrl}
            style={StyleSheet.absoluteFill}
            autoplay
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    left: (SIZE - SVG_W) / 2,
    top: -(SVG_H - SIZE),
  },
  riveWrapper: {
    width: SIZE,
    height: SIZE,
  },
})
