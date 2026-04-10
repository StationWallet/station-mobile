import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultName'>

export default function VaultName() {
  const navigation = useNavigation<Nav>()
  const [name, setName] = useState('')

  return (
    <SafeAreaView style={formStyles.container}>
      <KeyboardAvoidingView
        style={formStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <MigrationToolbar onBack={() => navigation.goBack()} />

        <StepProgressBar currentStep={1} />

        <View style={formStyles.content}>
          <Text style={formStyles.title} fontType="brockmann-medium">
            Name your vault
          </Text>
          <Text style={formStyles.subtitle} fontType="brockmann">
            No inspiration? You can always change the name later in your
            settings.
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              testID="vault-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Saving Vault"
              placeholderTextColor={MIGRATION.textInputPlaceholder}
              autoCorrect={false}
            />
            {name.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setName('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearIcon}>{'\u2715'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={formStyles.buttonContainer}>
          <Button
            testID="vault-name-next"
            title="Next"
            theme="ctaBlue"
            disabled={name.trim().length === 0}
            titleFontType="brockmann-medium"
            onPress={() => {
              navigation.navigate('VaultEmail', {
                walletName: name.trim(),
                mode: 'create',
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 14,
    color: MIGRATION.textPrimary,
    fontFamily: 'Brockmann-Regular',
  },
  clearButton: {
    marginLeft: 8,
  },
  clearIcon: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
})
