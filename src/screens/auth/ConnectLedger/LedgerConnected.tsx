import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const LedgerConnected = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Ledger Connected - Coming Soon</Text>
  </View>
)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#8295AE', fontSize: 16 },
})

export default LedgerConnected
