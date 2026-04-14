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
    // Embossed shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  layerHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 296,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
})
