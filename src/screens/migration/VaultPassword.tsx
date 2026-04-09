import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import GlassButton from 'components/migration/GlassButton'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultPassword'>
type Route = RouteProp<MigrationStackParams, 'VaultPassword'>

export default function VaultPassword() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName, mode, walletIndex, totalWallets, wallets, results, email } =
    route.params

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

  // In create mode: step 0=vault, 1=name, 2=email, 3=password (currentStep=3)
  // In migrate mode: step 0=vault, 1=email, 2=password (currentStep=2)
  const stepBarCurrentStep = mode === 'create' ? 3 : 2

  const buttonText = mode === 'create' ? 'Create vault' : 'Continue'

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <GlassButton onPress={() => navigation.goBack()}>
            <Text style={styles.chevron}>{'‹'}</Text>
          </GlassButton>
        </View>

        {/* Step progress */}
        <StepProgressBar currentStep={stepBarCurrentStep} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} fontType="brockmann-medium">
            Choose a password
          </Text>

          <Text style={styles.subtitle} fontType="brockmann">
            If you want an extra layer of security, choose a password. Password
            cannot be recovered. 🔑
          </Text>

          <TextInput
            testID="vault-password-input"
            style={[styles.input, showPasswordError && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setPasswordTouched(true)}
            placeholder="At least 6 characters"
            placeholderTextColor={MIGRATION.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {showPasswordError && (
            <Text style={styles.errorText} fontType="brockmann">
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
            placeholderTextColor={MIGRATION.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {showConfirmError && (
            <Text style={styles.errorText} fontType="brockmann">
              Passwords do not match.
            </Text>
          )}
        </View>

        {/* Button pinned to bottom */}
        <View style={styles.buttonContainer}>
          <Button
            testID="vault-password-continue"
            title={buttonText}
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={!isValid}
            onPress={() => {
              navigation.navigate('KeygenProgress', {
                walletName,
                mode,
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
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chevron: {
    fontSize: 24,
    color: MIGRATION.textPrimary,
    marginTop: -2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 20,
    marginBottom: 32,
  },
  input: {
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.borderLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: MIGRATION.textPrimary,
    fontFamily: 'Brockmann-Regular',
  },
  inputSpacing: {
    marginTop: 16,
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  errorText: {
    fontSize: 13,
    color: '#e53e3e',
    marginTop: 6,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  continueButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
