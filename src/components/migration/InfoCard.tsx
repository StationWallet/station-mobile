import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'

function ShieldCheckIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="#5ca7ff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke="#5ca7ff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ClockIcon() {
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

export default function InfoCard({ daysRemaining }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <ShieldCheckIcon />
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
        what's coming to Station.
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

      <View style={styles.countdownRow}>
        <ClockIcon />
        <Text fontType="brockmann" style={styles.countdown}>
          The window closes in {daysRemaining} days.
        </Text>
      </View>
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
