import React from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

/**
 * Three blurred gradient ellipses that create the subtle blue glow
 * behind the MigrationHome screen, matching the Figma design.
 *
 * Since React Native lacks CSS blur/blend-modes, we approximate with
 * SVG radial/linear gradients and opacity.
 */
export default function BackgroundGlow(): React.ReactElement {
  const SVG_H = 500
  const cx = SCREEN_WIDTH / 2

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg
        width={SCREEN_WIDTH}
        height={SVG_H}
        viewBox={`0 0 ${SCREEN_WIDTH} ${SVG_H}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Ellipse 2922 — largest, dark navy glow */}
          <RadialGradient
            id="glow1"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop offset="0%" stopColor="#061B3A" stopOpacity="1" />
            <Stop
              offset="70%"
              stopColor="#061B3A"
              stopOpacity="0.4"
            />
            <Stop offset="100%" stopColor="#02122B" stopOpacity="0" />
          </RadialGradient>

          {/* Ellipse 2924 — medium, dark-to-blue gradient */}
          <LinearGradient id="glow2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#000409" stopOpacity="0.6" />
            <Stop
              offset="100%"
              stopColor="#052E6F"
              stopOpacity="0.5"
            />
          </LinearGradient>

          {/* Ellipse 2923 — smallest, bright blue glow (color-dodge approx) */}
          <RadialGradient
            id="glow3"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop
              offset="0%"
              stopColor="#084BFF"
              stopOpacity="0.35"
            />
            <Stop
              offset="60%"
              stopColor="#084BFF"
              stopOpacity="0.15"
            />
            <Stop
              offset="85%"
              stopColor="#9EB8FF"
              stopOpacity="0.05"
            />
            <Stop offset="100%" stopColor="#02122B" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ellipse 2922: 564x1272, centered, top: -956 -> visible portion starts near top */}
        <Ellipse
          cx={cx}
          cy={-220}
          rx={282}
          ry={636}
          fill="url(#glow1)"
        />

        {/* Ellipse 2924: 513x619.5, centered, top: -374 */}
        <Ellipse
          cx={cx}
          cy={-65}
          rx={256}
          ry={310}
          fill="url(#glow2)"
        />

        {/* Ellipse 2923: 189x223.5, centered, top: 44.5 — the bright blue core */}
        <Ellipse
          cx={cx}
          cy={156}
          rx={95}
          ry={112}
          fill="url(#glow3)"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
})
