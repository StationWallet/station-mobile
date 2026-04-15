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
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultPassword'>
type Route = RouteProp<MigrationStackParams, 'VaultPassword'>

export default function VaultPassword(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName, mode, wallets, email } = route.params

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const isPasswordValid = password.length >= 6
  const showPasswordError = password.length > 0 && !isPasswordValid
  const showConfirmError = confirm.length > 0 && confirm !== password

  const isValid = isPasswordValid && confirm === password

  const stepBarCurrentStep = mode === 'create' ? 3 : 2
  const buttonText = mode === 'create' ? 'Create vault' : 'Continue'

  return (
    <SafeAreaView style={formStyles.container}>
      <KeyboardAvoidingView
        style={formStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <MigrationToolbar onBack={() => navigation.goBack()} />

        <StepProgressBar currentStep={stepBarCurrentStep} />

        <Animated.View
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(250)}
          style={formStyles.content}
        >
          <Text style={formStyles.title} fontType="brockmann-medium">
            Choose a password
          </Text>

          <Text style={formStyles.subtitle} fontType="brockmann">
            If you want an extra layer of security, choose a password.
            Password cannot be recovered.
          </Text>

          <TextInput
            testID="vault-password-input"
            style={[
              styles.input,
              showPasswordError && styles.inputError,
            ]}
            value={password}
            onChangeText={setPassword}
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
        </Animated.View>

        <View style={formStyles.buttonContainer}>
          <Button
            testID="vault-password-continue"
            title={buttonText}
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={!isValid}
            onPress={() => {
              const walletIndex = wallets
                ? wallets.findIndex((w) => w.name === walletName)
                : undefined
              navigation.navigate('KeygenProgress', {
                walletName,
                mode,
                walletIndex:
                  walletIndex != null && walletIndex >= 0
                    ? walletIndex
                    : undefined,
                wallets,
                email,
                password,
              })
            }}
            containerStyle={formStyles.ctaButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
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
    borderColor: MIGRATION.errorRed,
  },
  errorText: {
    fontSize: 13,
    color: MIGRATION.errorRed,
    marginTop: 6,
  },
})
