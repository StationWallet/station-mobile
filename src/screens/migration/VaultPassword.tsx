import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import Animated, { FadeInRight } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import Button from 'components/Button'
import { VULTISIG } from 'consts/vultisig'
import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// @ts-ignore — VaultPassword added in Task 10
type Nav = StackNavigationProp<MigrationStackParams, 'VaultPassword'>
// @ts-ignore — VaultPassword added in Task 10
type Route = RouteProp<MigrationStackParams, 'VaultPassword'>

export default function VaultPassword() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName, walletIndex, totalWallets, wallets, results, email } =
    route.params as {
      walletName: string
      walletIndex: number
      totalWallets: number
      wallets: MigrationWallet[]
      results: MigrationResult[]
      email: string
    }

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 6
  const passwordsDontMatch = confirm.length > 0 && confirm !== password

  const showPasswordError = passwordTouched && passwordTooShort
  const showConfirmError = confirmTouched && passwordsDontMatch

  const isValid =
    password.length >= 6 && confirm === password

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          entering={FadeInRight.duration(400)}
          style={styles.content}
        >
          <Text style={styles.stepIndicator} fontType="medium">
            Step 2 of 2
          </Text>

          <Text style={styles.walletLabel} fontType="book">
            Wallet {walletIndex}/{totalWallets}: {walletName}
          </Text>

          <Text style={styles.title} fontType="bold">
            Choose a password
          </Text>

          <Text style={styles.subtitle} fontType="book">
            Your password encrypts your vault on the server. Choose something
            strong — you'll need it to sign transactions.
          </Text>

          <TextInput
            testID="vault-password-input"
            style={[styles.input, showPasswordError && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setPasswordTouched(true)}
            placeholder="At least 6 characters"
            placeholderTextColor={VULTISIG.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {showPasswordError && (
            <Text style={styles.errorText} fontType="book">
              Password must be at least 6 characters.
            </Text>
          )}

          <TextInput
            testID="vault-password-confirm"
            style={[
              styles.input,
              styles.inputSpacing,
              showConfirmError && styles.inputError,
            ]}
            value={confirm}
            onChangeText={setConfirm}
            onBlur={() => setConfirmTouched(true)}
            placeholder="Confirm password"
            placeholderTextColor={VULTISIG.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {showConfirmError && (
            <Text style={styles.errorText} fontType="book">
              Passwords do not match.
            </Text>
          )}

          <View style={styles.buttonContainer}>
            <Button
              testID="vault-password-continue"
              title="Continue"
              theme="sapphire"
              disabled={!isValid}
              onPress={() => {
                // @ts-ignore — KeygenProgress added in Task 10
                navigation.navigate('KeygenProgress', {
                  walletName,
                  walletIndex,
                  totalWallets,
                  wallets,
                  results,
                  email,
                  password,
                })
              }}
              containerStyle={styles.continueButton}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  stepIndicator: {
    fontSize: 13,
    color: VULTISIG.accent,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  walletLabel: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: VULTISIG.textPrimary,
    fontFamily: 'Gotham-Book',
  },
  inputSpacing: {
    marginTop: 16,
  },
  inputError: {
    borderColor: VULTISIG.error,
  },
  errorText: {
    fontSize: 13,
    color: VULTISIG.error,
    marginTop: 6,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingBottom: 24,
    paddingTop: 16,
  },
  continueButton: {
    width: '100%',
  },
})
