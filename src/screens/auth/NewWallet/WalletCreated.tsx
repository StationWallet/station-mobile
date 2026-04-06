import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createWallet } from 'utils/wallet'
import { COLORS } from 'consts/theme'
import WalletSuccessScreen from '../WalletSuccessScreen'

const WalletCreated = ({ navigation, route }: any) => {
  const { mnemonic, name, password } = route.params
  const [wallet, setWallet] = useState<LocalWallet | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(true)

  useEffect(() => {
    const persist = async () => {
      try {
        const result = await createWallet({
          seed: mnemonic,
          name,
          password,
        })
        if (result.success) {
          setWallet(result.wallet)
        } else {
          setError('Failed to create wallet')
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to create wallet')
      } finally {
        setSaving(false)
      }
    }
    persist()
  }, [])

  if (saving) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.savingText}>Creating wallet...</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <WalletSuccessScreen
      title="Wallet Created!"
      wallet={wallet!}
      navigation={navigation}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  savingText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
  errorIcon: {
    color: COLORS.error,
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorTitle: {
    color: COLORS.error,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default WalletCreated
