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

type Nav = StackNavigationProp<MigrationStackParams, 'VaultEmail'>
type Route = RouteProp<MigrationStackParams, 'VaultEmail'>

function isValidEmail(email: string): boolean {
  const atIndex = email.indexOf('@')
  if (atIndex < 1) return false
  const afterAt = email.slice(atIndex + 1)
  const dotIndex = afterAt.indexOf('.')
  return dotIndex > 0 && dotIndex < afterAt.length - 1
}

export default function VaultEmail() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName, walletIndex, totalWallets, wallets, results, email: prefillEmail } = route.params

  const [email, setEmail] = useState(prefillEmail ?? '')
  const [touched, setTouched] = useState(false)

  const valid = isValidEmail(email)
  const showError = touched && !valid

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
            Step 1 of 2
          </Text>

          <Text style={styles.walletLabel} fontType="book">
            Wallet {walletIndex}/{totalWallets}: {walletName}
          </Text>

          <Text style={styles.title} fontType="bold">
            Enter your email
          </Text>

          <Text style={styles.subtitle} fontType="book">
            Your email is used for vault recovery. You'll receive a verification
            link to confirm access to your new fast vault.
          </Text>

          <TextInput
            testID="vault-email-input"
            style={[styles.input, showError && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            placeholderTextColor={VULTISIG.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          {showError && (
            <Text style={styles.errorText} fontType="book">
              Please enter a valid email address.
            </Text>
          )}

          <View style={styles.buttonContainer}>
            <Button
              testID="vault-email-next"
              title="Next"
              theme="sapphire"
              disabled={!valid}
              onPress={() => {
                navigation.navigate('VaultPassword', {
                  walletName,
                  walletIndex,
                  totalWallets,
                  wallets,
                  results,
                  email,
                })
              }}
              containerStyle={styles.nextButton}
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
  nextButton: {
    width: '100%',
  },
})
