import React from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import Svg, { G, Path, Rect, ClipPath, Defs, LinearGradient, Stop } from 'react-native-svg'

import { UTIL } from 'consts'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'

function DownloadIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10M4.66667 6.66667L8 10M8 10L11.3333 6.66667M8 10V2"
        stroke={MIGRATION.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function CloudUploadIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Defs>
        <ClipPath id="cloudClip">
          <Rect width={16} height={16} fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#cloudClip)">
        <Path
          d="M7.99984 8.66671V14M7.99984 8.66671L5.33317 11.3334M7.99984 8.66671L10.6665 11.3334M2.66657 9.93272C2.17126 9.42667 1.79761 8.81453 1.57392 8.14268C1.35023 7.47083 1.28237 6.75688 1.37547 6.05492C1.46858 5.35296 1.7202 4.68139 2.1113 4.09108C2.50239 3.50077 3.02269 3.0072 3.63279 2.64776C4.24289 2.28831 4.92678 2.07242 5.63268 2.01644C6.33857 1.96046 7.04795 2.06585 7.70708 2.32463C8.36621 2.58341 8.9578 2.98879 9.43706 3.51008C9.91631 4.03136 10.2706 4.65488 10.4732 5.33339H11.6666C12.3102 5.33331 12.9369 5.54027 13.4539 5.92368C13.9709 6.30709 14.3509 6.84663 14.5377 7.46259C14.7246 8.07855 14.7084 8.73828 14.4915 9.3443C14.2746 9.95033 13.8685 10.4705 13.3332 10.8281"
          stroke={MIGRATION.textPrimary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  )
}

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

      {address ? (
        <Text fontType="brockmann" style={styles.address}>
          {UTIL.truncate(address, [14, 3])}
        </Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.buttonRow}>
        {onExport && (
          <Button
            title={
              <View style={styles.buttonContent}>
                <DownloadIcon />
                <Text
                  fontType="brockmann-medium"
                  style={styles.buttonLabel}
                >
                  Export
                </Text>
              </View>
            }
            theme="secondaryDark"
            onPress={onExport}
            containerStyle={styles.exportButton}
            testID={testID ? `${testID}-export` : undefined}
          />
        )}

        {isFastVault ? (
          <View style={styles.fastVaultChip}>
            <View style={styles.fastVaultIconCircle}>
              <Svg width={12} height={12} viewBox="0 0 15 15" fill="none">
                <Defs>
                  <LinearGradient id="chipBoltGrad" x1="7.165" y1="0.664" x2="9.263" y2="11.872" gradientUnits="userSpaceOnUse">
                    <Stop stopColor="#F2C375" />
                    <Stop offset="1" stopColor="#FFAA1C" />
                  </LinearGradient>
                </Defs>
                <Path d="M8.36 1.41232C8.36 0.679429 7.41436 0.384987 6.99833 0.988304L1.89113 8.39374C1.54944 8.88917 1.9041 9.56457 2.50595 9.56457H5.97005V12.9369C5.97005 13.6698 6.91564 13.9643 7.33173 13.361L12.4389 5.95557C12.7806 5.46012 12.4259 4.7847 11.8241 4.7847H8.36V1.41232Z" fill="url(#chipBoltGrad)" />
              </Svg>
            </View>
            <Text fontType="brockmann-medium" style={styles.fastVaultChipText}>
              Fast Vault
            </Text>
          </View>
        ) : (
          <Button
            title={
              <View style={styles.buttonContent}>
                <CloudUploadIcon />
                <Text
                  fontType="brockmann-medium"
                  style={styles.buttonLabel}
                >
                  Migrate to a vault
                </Text>
              </View>
            }
            theme="ctaBlue"
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
    fontSize: 18,
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
  fastVaultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MIGRATION.smallButtonHeight,
    backgroundColor: MIGRATION.buttonSecondary,
    borderRadius: MIGRATION.radiusPill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    gap: 8,
    marginLeft: 'auto',
  },
  fastVaultIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#03132C',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastVaultChipText: {
    color: MIGRATION.textPrimary,
    fontSize: 14,
  },
  migrateButton: {
    height: MIGRATION.smallButtonHeight,
    paddingHorizontal: 16,
    borderRadius: MIGRATION.radiusSmallButton,
    marginLeft: 'auto',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: {
    color: MIGRATION.textPrimary,
    fontSize: 14,
  },
})
