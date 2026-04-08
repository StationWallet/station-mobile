import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSetRecoilState } from 'recoil'
import NewWalletStore from 'stores/NewWalletStore'
import { COLORS } from 'consts/theme'
import authStyles, { HEADER_TINT_COLOR } from '../authStyles'

const Step2 = ({ navigation }: any) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const setStorePassword = useSetRecoilState(NewWalletStore.password)

  const tooShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && password !== confirm
  const canProceed =
    password.length >= 10 && password === confirm

  const handleNext = () => {
    setStorePassword(password)
    navigation.navigate('NewWalletStep3')
  }

  return (
    <View style={authStyles.container}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Set a password</Text>
        <Text style={authStyles.subtitle}>
          Must be at least 10 characters
        </Text>

        <View style={[authStyles.inputGroup, { marginBottom: 20 }]}>
          <Text style={authStyles.label}>Password</Text>
          <TextInput
            style={[authStyles.input, tooShort && authStyles.inputError]}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            autoFocus
          />
          {tooShort && (
            <Text style={authStyles.errorText}>
              Password must be at least 10 characters
            </Text>
          )}
        </View>

        <View style={[authStyles.inputGroup, { marginBottom: 20 }]}>
          <Text style={authStyles.label}>Confirm Password</Text>
          <TextInput
            style={[authStyles.input, mismatch && authStyles.inputError]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
          />
          {mismatch && (
            <Text style={authStyles.errorText}>Passwords do not match</Text>
          )}
        </View>

        <TouchableOpacity
          style={[authStyles.button, !canProceed && authStyles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={authStyles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step2.navigationOptions = {
  title: 'Set Password',
  headerStyle: authStyles.headerStyle,
  headerTintColor: HEADER_TINT_COLOR,
}

export default Step2
