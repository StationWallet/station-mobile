import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// Step3Seed is referenced by the navigator but not needed for the POC flow.
// The flow goes Step2Seed -> Step4Seed directly.
const Step3Seed = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Verify Seed - Skipped in POC</Text>
  </View>
)

Step3Seed.navigationOptions = {
  title: 'Verify Seed',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#8295AE', fontSize: 16 },
})

export default Step3Seed
