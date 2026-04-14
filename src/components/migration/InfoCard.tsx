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
    <Svg width={24} height={24} viewBox="24 7 32 32" fill="none">
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
        strokeWidth={1.4}
        fill="none"
      />
      <Path
        d="M40.765 16.8133C40.765 16.0804 39.8194 15.786 39.4034 16.3893L34.2962 23.7947C33.9545 24.2902 34.3091 24.9656 34.911 24.9656H38.3751V28.3379C38.3751 29.0708 39.3207 29.3653 39.7368 28.762L44.8439 21.3566C45.1856 20.8611 44.831 20.1857 44.2291 20.1857H40.765V16.8133Z"
        fill="url(#boltGrad)"
      />
    </Svg>
  )
}

function ClockIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6v6l4 2"
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
}

export default function InfoCard({
  daysRemaining,
}: Props): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <LightningIcon />
        <Text fontType="brockmann-medium" style={styles.title}>
          A new type of wallet
        </Text>
      </View>

      <Text fontType="brockmann" style={styles.body}>
        Faster transactions. Stronger security.{'\n'}
        One password instead of 12 words.
      </Text>

      <Text fontType="brockmann" style={styles.body}>
        Fast Vaults are the next evolution of self-custody, built for
        what&apos;s coming to Station.
      </Text>

      <Text fontType="brockmann" style={styles.body}>
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

      {MIGRATION_FLOW_ENABLED && (
        <View style={styles.countdownRow}>
          <ClockIcon />
          <Text fontType="brockmann" style={styles.countdown}>
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
    padding: MIGRATION.cardPadding,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    color: MIGRATION.textPrimary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
  },
  bodyBold: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textPrimary,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: MIGRATION.borderLight,
  },
  countdown: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
  },
})
