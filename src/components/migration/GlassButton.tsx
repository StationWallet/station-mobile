import React from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'

type Props = {
  onPress: () => void
  children: React.ReactNode
  testID?: string
}

export default function GlassButton({ onPress, children, testID }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} testID={testID}>
      <View style={styles.fill} />
      {children}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 296,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MIGRATION.buttonSecondary,
    opacity: 0.67,
    borderRadius: 296,
  },
})
