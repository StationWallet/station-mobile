import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import GlassButton from 'components/migration/GlassButton'
import { MIGRATION } from 'consts/migration'

type Props = {
  onBack: () => void
  testID?: string
  children?: React.ReactNode
}

export default function MigrationToolbar({
  onBack,
  testID,
  children,
}: Props): React.ReactElement {
  return (
    <View style={styles.toolbar}>
      <GlassButton onPress={onBack} testID={testID}>
        <Text style={styles.chevron}>{'\u2039'}</Text>
      </GlassButton>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chevron: {
    fontSize: 24,
    color: MIGRATION.textPrimary,
    marginTop: -2,
  },
})
