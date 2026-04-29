import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import GlassButton from 'components/migration/GlassButton'
import { MIGRATION } from 'consts/migration'

function ChevronLeftIcon(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.9997 20L8.41391 13.4142C7.63286 12.6332 7.63286 11.3669 8.41391 10.5858L14.9997 4"
        stroke={MIGRATION.textInputPlaceholder}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  onBack?: () => void
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
      {onBack ? (
        <GlassButton onPress={onBack} testID={testID}>
          <ChevronLeftIcon />
        </GlassButton>
      ) : (
        <View />
      )}
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
})
