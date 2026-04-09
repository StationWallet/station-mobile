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
import GlassButton from 'components/migration/GlassButton'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultName'>

export default function VaultName() {
  const navigation = useNavigation<Nav>()
  const [name, setName] = useState('')

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
        <StepProgressBar currentStep={1} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} fontType="brockmann-medium">
            Name your vault
          </Text>
          <Text style={styles.subtitle} fontType="brockmann">
            No inspiration? You can always change the name later in your
            settings.
          </Text>

          {/* Input with clear button */}
          <View style={styles.inputWrapper}>
            <TextInput
              testID="vault-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Saving Vault"
              placeholderTextColor={MIGRATION.textTertiary}
              autoCorrect={false}
            />
            {name.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setName('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Next button pinned to bottom */}
        <View style={styles.buttonContainer}>
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#061b3acc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff08',
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
