import React from 'react'
import { View, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'

function WarningIcon(): React.ReactElement {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={MIGRATION.warningYellow}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 9v4M12 17h.01"
        stroke={MIGRATION.warningYellow}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

interface Props {
  style?: StyleProp<ViewStyle>
}

export default function DerivationWarningBanner({
  style,
}: Props): React.ReactElement {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconRow}>
        <WarningIcon />
        <Text fontType="brockmann-medium" style={styles.title}>
          Some vaults need to be re-created
        </Text>
      </View>
      <Text fontType="brockmann" style={styles.body}>
        Vaults marked with a warning icon were created before our
        latest update and may show incorrect addresses on non-Terra
        chains in Vultisig. Re-create or re-import your seed phrase to
        fix.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: MIGRATION.screenPadding,
    marginBottom: 16,
    padding: MIGRATION.cardPadding,
    borderRadius: MIGRATION.radiusCard,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.warningYellow,
    gap: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: MIGRATION.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  body: {
    color: MIGRATION.textTertiary,
    fontSize: 13,
    lineHeight: 18,
  },
})
