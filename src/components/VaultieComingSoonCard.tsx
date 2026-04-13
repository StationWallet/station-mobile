import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from 'components/Text'
import { VULTISIG } from 'consts/vultisig'

export default function VaultieComingSoonCard(): React.ReactElement {
  return (
    <View style={styles.card} testID="vaultie-coming-soon">
      <Text style={styles.title} fontType="bold">
        Vultisig Agent
      </Text>
      <Text style={styles.subtitle} fontType="book">
        Your AI-powered crypto companion is coming to this app. Stay
        tuned.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: VULTISIG.accentGlow,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusLg,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    color: VULTISIG.accent,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
    lineHeight: 18,
  },
})
