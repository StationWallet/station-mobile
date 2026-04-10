import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useSetRecoilState, useRecoilValue } from 'recoil'
import NewWalletStore from 'stores/NewWalletStore'
import TerraWallet from 'nativeModules/terraWallet'
import { COLORS } from 'consts/theme'
import authStyles, { HEADER_TINT_COLOR } from '../authStyles'

const Step3 = ({
  navigation,
}: {
  navigation: {
    navigate: (
      screen: string,
      params?: Record<string, unknown>
    ) => void
  }
}): React.ReactElement => {
  const [mnemonic, setMnemonic] = useState('')
  const [loading, setLoading] = useState(true)
  const setSeed = useSetRecoilState(NewWalletStore.seed)
  const name = useRecoilValue(NewWalletStore.name)
  const password = useRecoilValue(NewWalletStore.password)

  useEffect(() => {
    TerraWallet.getNewWallet().then((wallet) => {
      setMnemonic(wallet.mnemonic)
      setSeed(wallet.mnemonic.split(' '))
      setLoading(false)
    })
  }, [])

  const words = mnemonic.split(' ')

  const handleNext = (): void => {
    navigation.navigate('WalletCreated', {
      mnemonic,
      name,
      password,
    })
  }

  if (loading) {
    return (
      <View style={[authStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Generating wallet...</Text>
      </View>
    )
  }

  return (
    <View style={authStyles.container}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[authStyles.title, { marginBottom: 16 }]}>
          Write down your seed phrase
        </Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Write these 24 words down in order and store them in a
            safe place. Anyone with your seed phrase can access your
            wallet. Do not share it with anyone.
          </Text>
        </View>

        <View style={styles.grid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordCell}>
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={authStyles.button}
          onPress={handleNext}
        >
          <Text style={authStyles.buttonText}>
            I&apos;ve saved it
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step3.navigationOptions = {
  title: 'Seed Phrase',
  headerStyle: authStyles.headerStyle,
  headerTintColor: HEADER_TINT_COLOR,
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  warningBox: {
    backgroundColor: 'rgba(255,179,64,0.1)',
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 20,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  wordCell: {
    width: '23%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordNum: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    minWidth: 14,
  },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
})

export default Step3
