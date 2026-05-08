import React, { useMemo, useState } from 'react'
import { View, StyleSheet, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import {
  validatePrivateKey,
  type ValidatedPrivateKey,
} from 'services/privateKeyImport'

type Nav = StackNavigationProp<
  MigrationStackParams,
  'ImportPrivateKey'
>
type Route = RouteProp<MigrationStackParams, 'ImportPrivateKey'>

export default function ImportPrivateKey(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName } = route.params
  const insets = useSafeAreaInsets()
  const [value, setValue] = useState('')

  const validated = useMemo<ValidatedPrivateKey | null>(() => {
    if (!value.trim()) return null
    try {
      return validatePrivateKey(value)
    } catch {
      return null
    }
  }, [value])

  const showError = value.trim().length > 0 && !validated

  return (
    <View style={formStyles.container}>
      <View style={formStyles.flex}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={() => navigation.goBack()} />
        </View>

        <StepProgressBar currentStep={2} />

        <Animated.View
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(250)}
          style={formStyles.content}
        >
          <Text style={formStyles.title} fontType="brockmann-medium">
            Import private key
          </Text>
          <Text style={formStyles.subtitle} fontType="brockmann">
            This imports a Terra private key only. Use seed phrase
            recovery for a multichain wallet.
          </Text>

          <TextInput
            testID="private-key-input"
            style={[styles.input, showError && styles.inputError]}
            value={value}
            onChangeText={setValue}
            placeholder="Paste private key"
            placeholderTextColor={MIGRATION.textInputPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {showError ? (
            <Text style={styles.errorText} fontType="brockmann">
              Enter a valid 64-character hex private key.
            </Text>
          ) : null}

          {validated ? (
            <View style={styles.preview}>
              <Text
                fontType="brockmann-medium"
                style={styles.previewLabel}
              >
                Terra address
              </Text>
              <Text
                fontType="brockmann"
                style={styles.previewAddress}
                numberOfLines={2}
              >
                {validated.terraAddress}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        <View
          style={[
            formStyles.buttonContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            testID="private-key-next"
            title="Continue"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={!validated}
            onPress={() => {
              if (!validated) return
              navigation.navigate('VaultEmail', {
                walletName,
                mode: 'import-private-key',
                privateKeyHex: validated.privateKeyHex,
              })
            }}
            containerStyle={formStyles.ctaButton}
          />
        </View>
      </View>
    </View>
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
  preview: {
    marginTop: 18,
    padding: 16,
    borderRadius: 12,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
  },
  previewLabel: {
    fontSize: 12,
    color: MIGRATION.textTertiary,
    marginBottom: 8,
  },
  previewAddress: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textPrimary,
  },
})
