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
import { useSetRecoilState } from 'recoil'
import RecoverWalletStore from 'stores/RecoverWalletStore'
import { formatSeedStringToArray } from 'utils/wallet'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { COLORS } from 'consts/theme'
import authStyles from '../authStyles'

const Step2Seed = ({
  navigation,
}: {
  navigation: { navigate: (screen: string) => void }
}): React.ReactElement => {
  const insets = useSafeAreaInsets()
  const nav = useNavigation()
  const [seedText, setSeedText] = useState('')
  const setSeed = useSetRecoilState(RecoverWalletStore.seed)

  const words = seedText.trim()
    ? formatSeedStringToArray(seedText)
    : []
  const wordCount = words.length
  const isValid = wordCount === 12 || wordCount === 24

  const handleNext = (): void => {
    setSeed(words)
    navigation.navigate('Step4Seed')
  }

  return (
    <View style={authStyles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={() => nav.goBack()} />
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

Step2Seed.navigationOptions = {
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

export default Step2Seed
