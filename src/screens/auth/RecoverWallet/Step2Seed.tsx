import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useSetRecoilState } from 'recoil'
import RecoverWalletStore from 'stores/RecoverWalletStore'
import { formatSeedStringToArray } from 'utils/wallet'

const COLORS = {
  bg: '#02122B',
  surface: '#061B3A',
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  accent: '#0B4EFF',
  border: '#11284A',
  error: '#FF5C5C',
  inputBg: 'rgba(6,27,58,0.8)',
  success: '#18D2C3',
}

const Step2Seed = ({ navigation }: any) => {
  const [seedText, setSeedText] = useState('')
  const setSeed = useSetRecoilState(RecoverWalletStore.seed)

  const words = seedText.trim()
    ? formatSeedStringToArray(seedText)
    : []
  const wordCount = words.length
  const isValid = wordCount === 12 || wordCount === 24

  const handleNext = () => {
    setSeed(words)
    navigation.navigate('Step4Seed')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Enter your seed phrase</Text>
        <Text style={styles.subtitle}>
          Enter 12 or 24 words separated by spaces
        </Text>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.seedInput}
            value={seedText}
            onChangeText={setSeedText}
            placeholder="Enter your seed phrase..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
          <Text
            style={[
              styles.wordCount,
              isValid ? styles.wordCountValid : wordCount > 0 ? styles.wordCountInvalid : null,
            ]}
          >
            {wordCount} word{wordCount !== 1 ? 's' : ''}
            {isValid ? ' (valid)' : wordCount > 0 ? ' (need 12 or 24)' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!isValid}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

Step2Seed.navigationOptions = {
  title: 'Seed Phrase',
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
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 24 },
  seedInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 24,
  },
  wordCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  wordCountValid: { color: COLORS.success },
  wordCountInvalid: { color: COLORS.error },
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

export default Step2Seed
