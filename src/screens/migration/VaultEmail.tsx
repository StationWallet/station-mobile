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
  const {
    walletName,
    mode,
    wallets,
    email: prefillEmail,
  } = route.params

  const [email, setEmail] = useState(prefillEmail ?? '')
  const [touched, setTouched] = useState(false)

  const valid = isValidEmail(email)
  const showError = touched && !valid

  // In create mode: step 0=vault, 1=name, 2=email (3-step bar, currentStep=2)
  // In migrate mode: step 0=vault, 1=email (2-step bar, currentStep=1)
  const stepBarCurrentStep = mode === 'create' ? 2 : 1

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
            Enter your email
          </Text>

          <Text style={styles.subtitle} fontType="brockmann">
            This will only be used once to send your backup file. Vultisig
            doesn't store any data.
          </Text>

          <TextInput
            testID="vault-email-input"
            style={[styles.input, showError && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            placeholderTextColor={MIGRATION.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          {showError && (
            <Text style={styles.errorText} fontType="brockmann">
              Please enter a valid email address.
            </Text>
          )}
        </View>

        {/* Next button pinned to bottom */}
        <View style={styles.buttonContainer}>
          <Button
            testID="vault-email-next"
            title="Next"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={!valid}
            onPress={() => {
              navigation.navigate('VaultPassword', {
                walletName,
                mode,
                wallets,
                email,
              })
            }}
            containerStyle={styles.nextButton}
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
  nextButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
