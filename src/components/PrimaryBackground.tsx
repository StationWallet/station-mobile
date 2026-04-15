import React from 'react'
import { View, Dimensions, StyleSheet } from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Ellipse,
} from 'react-native-svg'

const { width: SW, height: SH } = Dimensions.get('window')
const MIN_SIZE = Math.min(SW, SH)

/**
 * Vultisig primary background with blue radial glow.
 * Mirrors vultiagent-app's PrimaryBackground component.
 */
export default function PrimaryBackground(): React.ReactElement {
  const svgW = SW * 1.5
  const svgH = MIN_SIZE * 1.4
  const pad = 50

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Primary glow */}
      <View
        style={{
          position: 'absolute',
          width: svgW,
          height: svgH,
          top: -(MIN_SIZE / 2.8) - pad,
          left: -(SW * 0.25),
          opacity: 0.85,
        }}
      >
        <Svg width={svgW} height={svgH}>
          <Defs>
            <RadialGradient
              id="glow"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop
                offset="0%"
                stopColor="rgb(8, 60, 255)"
                stopOpacity="1"
              />
              <Stop
                offset="45%"
                stopColor="rgb(5, 45, 210)"
                stopOpacity="0.5"
              />
              <Stop
                offset="70%"
                stopColor="rgb(3, 30, 150)"
                stopOpacity="0.25"
              />
              <Stop
                offset="100%"
                stopColor="rgb(2, 18, 43)"
                stopOpacity="0"
              />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={svgW / 2}
            cy={svgH / 2}
            rx={(svgW / 2) * 0.95}
            ry={(svgH / 2) * 0.95}
            fill="url(#glow)"
          />
        </Svg>
      </View>

      {/* Secondary glow layer */}
      <View
        style={{
          position: 'absolute',
          width: SW * 2,
          height: MIN_SIZE * 1.5,
          top: -(MIN_SIZE / 2.4),
          left: -(SW * 0.5),
          opacity: 0.4,
        }}
      >
        <Svg width={SW * 2} height={MIN_SIZE * 1.5}>
          <Defs>
            <RadialGradient
              id="glow2"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop
                offset="0%"
                stopColor="rgb(12, 65, 255)"
                stopOpacity="1"
              />
              <Stop
                offset="55%"
                stopColor="rgb(6, 45, 190)"
                stopOpacity="0.4"
              />
              <Stop
                offset="100%"
                stopColor="rgb(2, 18, 43)"
                stopOpacity="0"
              />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={SW}
            cy={MIN_SIZE * 0.72}
            rx={SW * 0.95}
            ry={MIN_SIZE * 0.65}
            fill="url(#glow2)"
          />
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#02122B',
    overflow: 'hidden',
  },
})
