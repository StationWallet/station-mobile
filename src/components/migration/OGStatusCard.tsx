import React from 'react'
import { View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'

export default function OGStatusCard(): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text fontType="brockmann-medium" style={styles.label}>
        Status:{' '}
        <Text fontType="brockmann-bold" style={styles.value}>
          Station OG
        </Text>
      </Text>
      <Text fontType="brockmann-medium" style={styles.label}>
        $VULT Airdrop:{' '}
        <Text fontType="brockmann-bold" style={styles.value}>
          Eligible
        </Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 225,
    alignSelf: 'center',
    backgroundColor: MIGRATION.surface1,
    borderColor: MIGRATION.borderLight,
    borderWidth: 1,
    borderRadius: MIGRATION.radiusCard,
    padding: MIGRATION.cardPadding,
    gap: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
  value: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
  },
})
