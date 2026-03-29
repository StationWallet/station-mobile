import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'

const COLORS = {
  bg: '#02122B',
  surface: '#061B3A',
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  accent: '#0B4EFF',
  border: '#11284A',
  disabled: '#1a2d4d',
  disabledText: '#4a5a72',
}

const Step1 = ({ navigation }: any) => {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Recover Wallet</Text>
        <Text style={styles.subtitle}>
          Choose how to recover your wallet
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Step2Seed')}
          >
            <Text style={styles.primaryButtonText}>
              Enter seed phrase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.disabledButton]}
            disabled
          >
            <Text style={[styles.secondaryButtonText, styles.disabledText]}>
              Scan QR code (coming soon)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

Step1.navigationOptions = {
  title: 'Recover Wallet',
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
    marginBottom: 40,
  },
  buttons: { gap: 14 },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
    borderColor: COLORS.disabled,
  },
  disabledText: {
    color: COLORS.disabledText,
  },
})

export default Step1
