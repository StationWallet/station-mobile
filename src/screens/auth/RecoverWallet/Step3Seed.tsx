import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from 'consts/theme'

// Step3Seed is referenced by the navigator but not needed for the POC flow.
// The flow goes Step2Seed -> Step4Seed directly.
const Step3Seed = (): React.ReactElement => (
  <View style={styles.container}>
    <Text style={styles.text}>Verify Seed - Skipped in POC</Text>
  </View>
)

Step3Seed.navigationOptions = {
  title: 'Verify Seed',
  headerStyle: {
    backgroundColor: COLORS.bg,
    shadowColor: 'transparent',
  },
  headerTintColor: COLORS.textPrimary,
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: COLORS.textSecondary, fontSize: 16 },
})

export default Step3Seed
