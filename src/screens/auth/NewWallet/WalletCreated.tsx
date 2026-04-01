import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { CommonActions } from '@react-navigation/native'
import { createWallet } from 'utils/wallet'

const COLORS = {
  bg: '#02122B',
  surface: '#061B3A',
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  accent: '#0B4EFF',
  border: '#11284A',
  success: '#18D2C3',
  error: '#FF5C5C',
}

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

  const handleDone = () => {
    // Reset the entire navigation stack back to AuthMenu
    // The App component will detect the wallet and show the main screen
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'AuthMenu' }],
      })
    )
  }

  if (saving) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.savingText}>Creating wallet...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, styles.centered]}>
      <View style={styles.successCircle}>
        <Text style={styles.checkmark}>&#10003;</Text>
      </View>
      <Text style={styles.title}>Wallet Created!</Text>
      <Text style={styles.walletName}>{wallet?.name}</Text>
      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>Address</Text>
        <Text style={styles.address} selectable>
          {wallet?.address}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: { color: '#fff', fontSize: 36, fontWeight: '700' },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  walletName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 24,
  },
  addressBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 40,
  },
  addressLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  address: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
})

export default WalletCreated
