import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, {
  Circle,
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
    <Svg width={25} height={25} viewBox="24 7 32 32" fill="none">
      <Defs>
        <LinearGradient
          id="boltGrad"
          x1="39.57"
          y1="16.07"
          x2="41.67"
          y2="27.27"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#F2C375" />
          <Stop offset="1" stopColor="#FFAA1C" />
        </LinearGradient>
      </Defs>
      <Circle cx={39.57} cy={22.57} r={12.9} fill="#03132C" />
      <Circle
        cx={39.57}
        cy={22.57}
        r={12.9}
        stroke="white"
        strokeOpacity={0.1}
        strokeWidth={2.87}
        fill="none"
      />
      <Path
        d="M40.765 16.8133C40.765 16.0804 39.8194 15.786 39.4034 16.3893L34.2962 23.7947C33.9545 24.2902 34.3091 24.9656 34.911 24.9656H38.3751V28.3379C38.3751 29.0708 39.3207 29.3653 39.7368 28.762L44.8439 21.3566C45.1856 20.8611 44.831 20.1857 44.2291 20.1857H40.765V16.8133Z"
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
        <View style={styles.titleRow}>
          <View style={styles.lightningIconContainer}>
            <LightningIcon />
          </View>
          <Text fontType="brockmann-medium" style={styles.title}>
            A new type of wallet
          </Text>
        </View>

        <Text fontType="brockmann-medium" style={styles.body}>
          Faster transactions. Stronger security.{'\n'}
          One password instead of 12 words.
        </Text>

        <Text fontType="brockmann-medium" style={styles.body}>
          Fast Vaults are the next evolution of self-custody, built
          for what&apos;s coming to Station.
        </Text>

        <Text fontType="brockmann-medium" style={styles.body}>
          Early explorers get{' '}
          <Text fontType="brockmann-bold" style={styles.bodyBold}>
            Station OG
          </Text>{' '}
          status and a{' '}
          <Text fontType="brockmann-bold" style={styles.bodyBold}>
            $VULT airdrop
          </Text>
          .
        </Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lightningIconContainer: {
    shadowColor: '#FFAA1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
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
