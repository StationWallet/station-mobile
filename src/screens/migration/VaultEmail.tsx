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
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { MIGRATION } from 'consts/migration'
import { isValidEmail } from 'utils/isValidEmail'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultEmail'>
type Route = RouteProp<MigrationStackParams, 'VaultEmail'>

export default function VaultEmail(): React.ReactElement {
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

  const stepBarCurrentStep = mode === 'create' ? 2 : 1

  return (
    <SafeAreaView style={formStyles.container}>
      <KeyboardAvoidingView
        style={formStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <MigrationToolbar onBack={() => navigation.goBack()} />

        <StepProgressBar currentStep={stepBarCurrentStep} />

        <Animated.View
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(250)}
          style={formStyles.content}
        >
          <Text style={formStyles.title} fontType="brockmann-medium">
            Enter your email
          </Text>

          <Text style={formStyles.subtitle} fontType="brockmann">
            This will only be used once to send your backup file.
            Vultisig doesn&apos;t store any data.
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
        </Animated.View>

        <View style={formStyles.buttonContainer}>
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
  inputError: {
    borderColor: MIGRATION.errorRed,
  },
  errorText: {
    fontSize: 13,
    color: MIGRATION.errorRed,
    marginTop: 6,
  },
})
