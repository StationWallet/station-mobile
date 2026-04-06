import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import authStyles, { HEADER_TINT_COLOR } from '../authStyles'

const Step1 = ({ navigation }: any) => {
  return (
    <View style={authStyles.container}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Recover Wallet</Text>
        <Text style={[authStyles.subtitle, { marginBottom: 40 }]}>
          Choose how to recover your wallet
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={authStyles.button}
            onPress={() => navigation.navigate('Step2Seed')}
          >
            <Text style={authStyles.buttonText}>
              Enter seed phrase
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  )
}

Step1.navigationOptions = {
  title: 'Recover Wallet',
  headerStyle: authStyles.headerStyle,
  headerTintColor: HEADER_TINT_COLOR,
}

const styles = StyleSheet.create({
  buttons: { gap: 14 },
})

export default Step1
