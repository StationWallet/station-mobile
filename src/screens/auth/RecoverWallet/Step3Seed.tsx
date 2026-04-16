import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { COLORS } from 'consts/theme'

// Step3Seed is referenced by the navigator but not needed for the POC flow.
// The flow goes Step2Seed -> Step4Seed directly.
const Step3Seed = (): React.ReactElement => {
  const insets = useSafeAreaInsets()
  const nav = useNavigation()

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={() => nav.goBack()} />
      </View>
      <Text style={styles.text}>Verify Seed - Skipped in POC</Text>
    </View>
  )
}

Step3Seed.navigationOptions = {
  headerShown: false,
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
