import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const SelectPath = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Select Path - Coming Soon</Text>
  </View>
)

SelectPath.navigationOptions = {
  title: 'Select Path',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#8295AE', fontSize: 16 },
})

export default SelectPath
