import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const SelectWallet = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Select Wallet</Text>
    </View>
  )
}

SelectWallet.navigationOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02122B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#F0F4FC', fontSize: 18 },
})

export default SelectWallet
