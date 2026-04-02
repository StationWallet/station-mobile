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

const Step4Seed = ({ navigation }: any) => {
  const seed = useRecoilValue(RecoverWalletStore.seed)
  const setStoreName = useSetRecoilState(RecoverWalletStore.name)
  const setStorePassword = useSetRecoilState(RecoverWalletStore.password)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tooShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && password !== confirm
  const canProceed =
    name.trim().length > 0 && password.length >= 10 && password === confirm

  const handleRecover = async () => {
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
        navigation.navigate('WalletRecovered', { wallet: result.wallet })
      } else {
        setError('Failed to recover wallet')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to recover wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Set up your recovered wallet</Text>
        <Text style={styles.subtitle}>
          Choose a name and password for this wallet
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wallet Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Wallet"
            placeholderTextColor={COLORS.textSecondary}
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, tooShort && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            placeholder="Min 10 characters"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
          />
          {tooShort && (
            <Text style={styles.errorText}>
              Password must be at least 10 characters
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, mismatch && styles.inputError]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
          />
          {mismatch && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}
        </View>

        {error ? (
          <Text style={styles.errorBanner}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (!canProceed || loading) && styles.buttonDisabled]}
          onPress={handleRecover}
          disabled={!canProceed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Recover</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step4Seed.navigationOptions = {
  title: 'Wallet Details',
  headerStyle: { backgroundColor: '#02122B', shadowColor: 'transparent' },
  headerTintColor: '#F0F4FC',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 32,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
  errorBanner: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default Step4Seed
