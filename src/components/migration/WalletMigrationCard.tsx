import React from 'react'
import { View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'

type Props = {
  name: string
  address: string
  migrated: boolean
  onMigrate: () => void
  testID?: string
}

export default function WalletMigrationCard({
  name,
  address,
  migrated,
  onMigrate,
  testID,
}: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.headerRow}>
        <Text fontType="brockmann-medium" style={styles.name}>
          {name}
        </Text>
        <Text fontType="satoshi-medium" style={styles.balance}>
          $0.00
        </Text>
      </View>

      <Text fontType="brockmann" style={styles.address}>
        {UTIL.truncate(address, [14, 3])}
      </Text>

      <View style={styles.divider} />

      <View style={styles.buttonRow}>
        {migrated ? (
          <View style={styles.migratedBadge}>
            <Text fontType="brockmann-medium" style={styles.migratedText}>
              {'\u2713'} Fast Vault
            </Text>
          </View>
        ) : (
          <Button
            title="Migrate to a vault"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={onMigrate}
            containerStyle={styles.migrateButton}
            titleStyle={styles.migrateButtonText}
            testID={testID ? `${testID}-migrate` : undefined}
          />
        )}
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    color: MIGRATION.textPrimary,
  },
  balance: {
    fontSize: 20,
    color: MIGRATION.textPrimary,
    letterSpacing: 0.2,
  },
  address: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: MIGRATION.borderLight,
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  migrateButton: {
    height: MIGRATION.smallButtonHeight,
    borderRadius: MIGRATION.radiusSmallButton,
    paddingHorizontal: 20,
  },
  migrateButtonText: {
    fontSize: 14,
  },
  migratedBadge: {
    height: MIGRATION.smallButtonHeight,
    borderRadius: MIGRATION.radiusSmallButton,
    backgroundColor: MIGRATION.buttonSecondary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  migratedText: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
  },
})
