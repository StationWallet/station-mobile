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

const AuthMenu = ({ navigation }: any) => {
  const navState = navigation.getState()
  const isAddMode = navState?.routes?.some((r: any) => r.name === 'AddWalletMenu')

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.title}>Station Wallet</Text>
          <Text style={styles.subtitle}>
            Create or recover your Terra wallet
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate(isAddMode ? 'AddNewWallet' : 'NewWallet')}
          >
            <Text style={styles.primaryButtonText}>Create New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate(isAddMode ? 'AddRecoverWallet' : 'RecoverWallet')}
          >
            <Text style={styles.secondaryButtonText}>
              Recover Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.disabledButton]}
            disabled
          >
            <Text style={[styles.secondaryButtonText, styles.disabledText]}>
              Connect Ledger (coming soon)
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              testID="dev-crypto-test"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('CryptoTest')}
            >
              <Text style={styles.secondaryButtonText}>Crypto Tests (dev)</Text>
            </TouchableOpacity>
          )}

          {__DEV__ && (
            <TouchableOpacity
              testID="dev-migration-test"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('MigrationTest')}
            >
              <Text style={styles.secondaryButtonText}>Migration Tests (dev)</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      {isAddMode && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

AuthMenu.navigationOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  buttons: {
    gap: 14,
  },
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
  cancelButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
})

export default AuthMenu
