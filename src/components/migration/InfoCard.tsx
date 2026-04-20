import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import { MIGRATION_FLOW_ENABLED } from 'config/env'

function LightningIcon(): React.ReactElement {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Defs>
        <LinearGradient
          id="boltGrad"
          x1="7.165"
          y1="0.664"
          x2="9.263"
          y2="11.872"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#F2C375" />
          <Stop offset="1" stopColor="#FFAA1C" />
        </LinearGradient>
      </Defs>
      <Path
        d="M8.36 1.41232C8.36 0.679429 7.41436 0.384987 6.99833 0.988304L1.89113 8.39374C1.54944 8.88917 1.9041 9.56457 2.50595 9.56457H5.97005V12.9369C5.97005 13.6698 6.91564 13.9643 7.33173 13.361L12.4389 5.95557C12.7806 5.46012 12.4259 4.7847 11.8241 4.7847H8.36V1.41232Z"
        fill="url(#boltGrad)"
      />
    </Svg>
  )
}

function CalendarClockIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      {/* Calendar body */}
      <Path
        d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v4H3V6a2 2 0 012-2z"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Calendar bottom left */}
      <Path
        d="M3 10v8a2 2 0 002 2h6"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Clock circle */}
      <Path
        d="M18 22a4 4 0 100-8 4 4 0 000 8z"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Clock hands */}
      <Path
        d="M18 16.5v1.5l1 1"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  daysRemaining: number
  connectedBottom?: boolean
}

export default function InfoCard({
  daysRemaining,
  connectedBottom = false,
}: Props): React.ReactElement {
  return (
    <View>
      {/* Main card — zIndex 1 so it sits on top of the countdown strip */}
      <View
        style={[
          styles.card,
          connectedBottom && styles.cardConnectedBottom,
          MIGRATION_FLOW_ENABLED && styles.cardWithCountdown,
        ]}
      >
        <View style={styles.contentRow}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: '#03132C',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <LightningIcon />
            <View
              style={{
                position: 'absolute',
                bottom: -12,
                width: 20,
                height: 10,
                borderRadius: 50,
                boxShadow: '0 -6px 16px 0 rgba(255, 170, 28, 0.4)',
              }}
            />
          </View>
          <View style={styles.textColumn}>
            <Text fontType="brockmann-medium" style={styles.title}>
              A new type of wallet
            </Text>

            <Text fontType="brockmann-medium" style={styles.body}>
              Faster transactions. Stronger security.{'\n'}
              One password instead of 12 words.
            </Text>

            <Text fontType="brockmann-medium" style={styles.body}>
              Fast Vaults are the next evolution of self-custody,
              built for what&apos;s coming to Station.
            </Text>

            <Text fontType="brockmann-medium" style={styles.body}>
              Be an early explorer and increase your chance for{' '}
              <Text fontType="brockmann-bold" style={styles.bodyBold}>
                rewards
              </Text>
              .
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom strip with countdown — sits behind the main card */}
      {MIGRATION_FLOW_ENABLED && (
        <View style={styles.countdownStrip}>
          <CalendarClockIcon />
          <Text fontType="brockmann-medium" style={styles.countdown}>
            The window closes in {daysRemaining} days.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MIGRATION.bg,
    borderColor: MIGRATION.borderLight,
    borderWidth: 1,
    borderRadius: MIGRATION.radiusCard,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 1,
  },
  cardConnectedBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  cardWithCountdown: {
    // Keep full border-radius — the card sits ON TOP of the strip
    // so its bottom border-radius creates a nice curved overlap effect
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textColumn: {
    flex: 1,
    gap: 12,
  },
  title: {
    fontSize: 15,
    lineHeight: 17,
    letterSpacing: -0.18,
    color: MIGRATION.textPrimary,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
    letterSpacing: 0.06,
  },
  bodyBold: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textPrimary,
  },
  countdownStrip: {
    backgroundColor: MIGRATION.surface1,
    borderBottomLeftRadius: MIGRATION.radiusCard,
    borderBottomRightRadius: MIGRATION.radiusCard,
    marginTop: -20,
    paddingTop: 32,
    paddingBottom: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 0,
  },
  countdown: {
    fontSize: 12,
    lineHeight: 16,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
  },
})
