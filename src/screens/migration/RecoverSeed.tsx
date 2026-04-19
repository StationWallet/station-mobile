import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useSetRecoilState } from 'recoil'
import RecoverWalletStore from 'stores/RecoverWalletStore'
import { formatSeedStringToArray } from 'utils/wallet'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { COLORS } from 'consts/theme'
import { useWalletNav } from 'navigation/hooks'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import authStyles from '../auth/authStyles'

type Nav = StackNavigationProp<MigrationStackParams, 'RecoverSeed'>

const RecoverSeed = (): React.ReactElement => {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [seedText, setSeedText] = useState('')
  const setSeed = useSetRecoilState(RecoverWalletStore.seed)
  const { goHome } = useWalletNav()

  const words = seedText.trim()
    ? formatSeedStringToArray(seedText)
    : []
  const wordCount = words.length
  const isValid = wordCount === 12 || wordCount === 24

  const handleNext = (): void => {
    setSeed(words)
    nav.navigate('VaultName', { mode: 'recover-seed' })
  }

  const handleBack = (): void => {
    if (nav.canGoBack()) {
      nav.goBack()
    } else {
      goHome()
    }
  }

  return (
    <View style={authStyles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={handleBack} />
      </View>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Enter your seed phrase</Text>
        <Text style={[authStyles.subtitle, { marginBottom: 24 }]}>
          Enter 12 or 24 words separated by spaces
        </Text>

        <View style={authStyles.inputGroup}>
          <TextInput
            style={styles.seedInput}
            value={seedText}
            onChangeText={setSeedText}
            placeholder="Enter your seed phrase..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
          <Text
            style={[
              styles.wordCount,
              isValid
                ? styles.wordCountValid
                : wordCount > 0
                ? styles.wordCountInvalid
                : null,
            ]}
          >
            {wordCount} word{wordCount !== 1 ? 's' : ''}
            {isValid
              ? ' (valid)'
              : wordCount > 0
              ? ' (need 12 or 24)'
              : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            authStyles.button,
            !isValid && authStyles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={!isValid}
        >
          <Text style={authStyles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

RecoverSeed.navigationOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  seedInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 24,
  },
  wordCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  wordCountValid: { color: COLORS.success },
  wordCountInvalid: { color: COLORS.error },
})

export default RecoverSeed
