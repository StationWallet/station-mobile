import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSetRecoilState } from 'recoil'
import NewWalletStore from 'stores/NewWalletStore'
import { COLORS } from 'consts/theme'

const Step1 = ({ navigation }: any) => {
  const [name, setName] = useState('')
  const setStoreName = useSetRecoilState(NewWalletStore.name)

  const canProceed = name.trim().length > 0

  const handleNext = () => {
    setStoreName(name.trim())
    navigation.navigate('NewWalletStep2')
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create a wallet</Text>
        <Text style={styles.subtitle}>
          Choose a name for your wallet
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
            returnKeyType="next"
            onSubmitEditing={() => canProceed && handleNext()}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, !canProceed && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step1.navigationOptions = {
  title: 'Create Wallet',
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
  inputGroup: { marginBottom: 24 },
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
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default Step1
