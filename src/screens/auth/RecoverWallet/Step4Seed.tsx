import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import RecoverWalletStore from 'stores/RecoverWalletStore'
import { createWallet } from 'utils/wallet'
import { COLORS } from 'consts/theme'
import authStyles, { HEADER_TINT_COLOR } from '../authStyles'

const Step4Seed = ({
  navigation,
}: {
  navigation: {
    navigate: (
      screen: string,
      params?: Record<string, unknown>
    ) => void
  }
}): React.ReactElement => {
  const seed = useRecoilValue(RecoverWalletStore.seed)
  const setStoreName = useSetRecoilState(RecoverWalletStore.name)
  const setStorePassword = useSetRecoilState(
    RecoverWalletStore.password
  )

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tooShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && password !== confirm
  const canProceed =
    name.trim().length > 0 &&
    password.length >= 10 &&
    password === confirm

  const handleRecover = async (): Promise<void> => {
    setLoading(true)
    setError('')
    setStoreName(name.trim())
    setStorePassword(password)

    try {
      const mnemonic = seed.join(' ')
      const result = await createWallet({
        seed: mnemonic,
        name: name.trim(),
        password,
      })
      if (result.success) {
        navigation.navigate('WalletRecovered', {
          wallet: result.wallet,
        })
      } else {
        setError('Failed to recover wallet')
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Failed to recover wallet'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={authStyles.container}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>
          Set up your recovered wallet
        </Text>
        <Text style={authStyles.subtitle}>
          Choose a name and password for this wallet
        </Text>

        <View style={[authStyles.inputGroup, { marginBottom: 20 }]}>
          <Text style={authStyles.label}>Wallet Name</Text>
          <TextInput
            style={authStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Wallet"
            placeholderTextColor={COLORS.textSecondary}
            autoFocus
          />
        </View>

        <View style={[authStyles.inputGroup, { marginBottom: 20 }]}>
          <Text style={authStyles.label}>Password</Text>
          <TextInput
            style={[
              authStyles.input,
              tooShort && authStyles.inputError,
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="Min 10 characters"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
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
            style={[
              authStyles.input,
              mismatch && authStyles.inputError,
            ]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
          />
          {mismatch && (
            <Text style={authStyles.errorText}>
              Passwords do not match
            </Text>
          )}
        </View>

        {error ? (
          <Text style={styles.errorBanner}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            authStyles.button,
            (!canProceed || loading) && authStyles.buttonDisabled,
          ]}
          onPress={handleRecover}
          disabled={!canProceed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.buttonText}>Recover</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step4Seed.navigationOptions = {
  title: 'Wallet Details',
  headerStyle: authStyles.headerStyle,
  headerTintColor: HEADER_TINT_COLOR,
}

const styles = StyleSheet.create({
  errorBanner: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
})

export default Step4Seed
