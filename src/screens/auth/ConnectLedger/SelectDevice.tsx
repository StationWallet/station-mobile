import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const SelectDevice = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Connect Ledger - Coming Soon</Text>
  </View>
)

SelectDevice.navigationOptions = {
  title: 'Connect Ledger',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#8295AE', fontSize: 16 },
})

export default SelectDevice
