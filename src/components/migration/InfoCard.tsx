import React from 'react'
import { View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'

type Props = {
  daysRemaining: number
}

export default function InfoCard({ daysRemaining }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.icon}>{'⚡'}</Text>
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
        <Text style={styles.clockIcon}>{'🕐'}</Text>
        <Text fontType="brockmann" style={styles.countdown}>
          The window closes in {daysRemaining} days.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MIGRATION.surface1,
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
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 16,
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
  clockIcon: {
    fontSize: 16,
  },
  countdown: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
  },
})
