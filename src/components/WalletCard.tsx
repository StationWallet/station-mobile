import React from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { UTIL } from 'consts'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'

function TrashIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
        stroke={MIGRATION.errorRed}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  name: string
  address: string
  terraOnly: boolean
  isFastVault: boolean
  onPress: () => void
  onExport?: () => void
  onDelete?: () => void
  testID?: string
}

export default function WalletCard({
  name,
  address,
  terraOnly,
  isFastVault,
  onPress,
  onExport,
  onDelete,
  testID,
}: Props): React.ReactElement {
  const confirmDelete = (): void => {
    Alert.alert(
      'Remove Wallet',
      'This will remove the wallet from this device. Make sure you have your seed phrase backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onDelete },
      ]
    )
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={styles.nameRow}>
          <Text fontType="brockmann-medium" style={styles.name}>
            {name}
          </Text>
          {terraOnly && (
            <View style={styles.terraOnlyBadge}>
              <Text fontType="brockmann" style={styles.terraOnlyText}>
                Terra only
              </Text>
            </View>
          )}
        </View>
        {onDelete && (
          <TouchableOpacity
            onPress={confirmDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={testID ? `${testID}-delete` : undefined}
          >
            <TrashIcon />
          </TouchableOpacity>
        )}
      </View>

      <Text fontType="brockmann" style={styles.address}>
        {UTIL.truncate(address, [14, 3])}
      </Text>

      <View style={styles.divider} />

      <View style={styles.buttonRow}>
        {onExport && (
          <Button
            title="Export"
            theme="secondaryDark"
            titleFontType="brockmann-medium"
            onPress={onExport}
            containerStyle={styles.exportButton}
            testID={testID ? `${testID}-export` : undefined}
          />
        )}

        {isFastVault ? (
          <View style={styles.fastVaultBadge}>
            <Text fontType="brockmann" style={styles.fastVaultText}>
              {'\u2713'} Fast Vault
            </Text>
          </View>
        ) : (
          <Button
            title="Migrate to a vault"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={onPress}
            containerStyle={styles.migrateButton}
            testID={testID ? `${testID}-migrate` : undefined}
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MIGRATION.surface1,
    borderRadius: MIGRATION.radiusCard,
    padding: MIGRATION.cardPadding,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    color: MIGRATION.textPrimary,
    fontSize: 16,
  },
  terraOnlyBadge: {
    backgroundColor: 'rgba(100, 160, 255, 0.2)',
    borderRadius: MIGRATION.radiusSmallButton,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  terraOnlyText: {
    color: '#64A0FF',
    fontSize: 11,
  },
  address: {
    color: MIGRATION.textTertiary,
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: MIGRATION.borderLight,
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    height: MIGRATION.smallButtonHeight,
    paddingHorizontal: 16,
    borderRadius: MIGRATION.radiusSmallButton,
  },
  fastVaultBadge: {
    backgroundColor: MIGRATION.buttonSecondary,
    borderRadius: MIGRATION.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 'auto',
  },
  fastVaultText: {
    color: MIGRATION.successGreen,
    fontSize: 13,
  },
  migrateButton: {
    height: MIGRATION.smallButtonHeight,
    paddingHorizontal: 16,
    borderRadius: MIGRATION.radiusSmallButton,
    marginLeft: 'auto',
  },
})
