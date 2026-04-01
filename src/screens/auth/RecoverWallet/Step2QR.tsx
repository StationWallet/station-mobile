import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const Step2QR = () => (
  <View style={styles.container}>
    <Text style={styles.text}>QR Recovery - Coming Soon</Text>
  </View>
)

Step2QR.navigationOptions = {
  title: 'Scan QR',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#8295AE', fontSize: 16 },
})

export default Step2QR
