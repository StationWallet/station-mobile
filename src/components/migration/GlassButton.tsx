import React from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'

type Props = {
  onPress: () => void
  children: React.ReactNode
  testID?: string
}

export default function GlassButton({
  onPress,
  children,
  testID,
}: Props): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      testID={testID}
    >
      <View style={styles.layerBase} />
      <View style={styles.layerMain} />
      <View style={styles.layerHighlight} />
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
  layerBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(204,204,204,0.5)',
    borderRadius: 296,
  },
  layerMain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#11284a',
    borderRadius: 296,
  },
  layerHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 296,
  },
})
