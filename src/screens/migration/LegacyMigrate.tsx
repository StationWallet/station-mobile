import React, { useState } from 'react'
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
  decryptLegacyWallet,
  WrongPasswordError,
  MalformedBlobError,
} from 'services/spaLegacyDecrypt'

type Nav = StackNavigationProp<MigrationStackParams, 'LegacyMigrate'>
type Route = RouteProp<MigrationStackParams, 'LegacyMigrate'>

export default function LegacyMigrate(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { walletName, address, encrypted } = route.params
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [decrypting, setDecrypting] = useState(false)

  const handleContinue = (): void => {
    if (!password) return
    setDecrypting(true)
    // Brief defer so the spinner state can render before sync PBKDF2 work.
    setTimeout(() => {
      try {
        const result = decryptLegacyWallet(encrypted, password)
        if (result.terraAddress !== address) {
          setError(
            'Decryption succeeded but the derived address did not match. Try again.'
          )
          setDecrypting(false)
          return
        }
        setError(null)
        setDecrypting(false)
        navigation.navigate('VaultEmail', {
          walletName,
          mode: 'import-private-key',
          privateKeyHex: result.privateKeyHex,
        })
      } catch (e) {
        if (e instanceof WrongPasswordError) {
          setError('Wrong password.')
        } else if (e instanceof MalformedBlobError) {
          setError(
            'This wallet entry is malformed and cannot be recovered here.'
          )
        } else {
          setError('Could not decrypt. Please try again.')
        }
        setDecrypting(false)
      }
    }, 30)
  }

  const showError = error !== null

  return (
    <View style={formStyles.container}>
      <View style={formStyles.flex}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={() => navigation.goBack()} />
        </View>

        <StepProgressBar currentStep={1} />

        <Animated.View
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(250)}
          style={formStyles.content}
        >
          <Text style={formStyles.title} fontType="brockmann-medium">
            Enter your Station password
          </Text>
          <Text style={formStyles.subtitle} fontType="brockmann">
            The password you used in the legacy Station app to unlock
            “{walletName}”. We use it once to import your wallet into
            a Fast Vault.
          </Text>

          <View style={styles.walletCard}>
            <Text
              fontType="brockmann-medium"
              style={styles.walletLabel}
            >
              Migrating
            </Text>
            <Text
              fontType="brockmann-medium"
              style={styles.walletName}
            >
              {walletName}
            </Text>
            <Text
              fontType="brockmann"
              style={styles.walletAddress}
              numberOfLines={2}
            >
              {address}
            </Text>
          </View>

          <TextInput
            testID="legacy-migrate-password-input"
            style={[styles.input, showError && styles.inputError]}
            value={password}
            onChangeText={(t) => {
              setPassword(t)
              if (error) setError(null)
            }}
            placeholder="Legacy Station password"
            placeholderTextColor={MIGRATION.textInputPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!decrypting}
          />

          {showError ? (
            <Text style={styles.errorText} fontType="brockmann">
              {error}
            </Text>
          ) : null}
        </Animated.View>

        <View
          style={[
            formStyles.buttonContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            testID="legacy-migrate-continue"
            title={decrypting ? 'Decrypting…' : 'Continue'}
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={!password || decrypting}
            onPress={handleContinue}
            containerStyle={formStyles.ctaButton}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  walletCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 12,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
  },
  walletLabel: {
    fontSize: 12,
    color: MIGRATION.textTertiary,
    marginBottom: 6,
  },
  walletName: {
    fontSize: 16,
    color: MIGRATION.textPrimary,
    marginBottom: 6,
  },
  walletAddress: {
    fontSize: 12,
    lineHeight: 16,
    color: MIGRATION.textTertiary,
  },
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
