import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  TextInput,
  Keyboard,
  Alert,
  TouchableOpacity,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import { VULTISIG } from 'consts/vultisig'
import { verifyVaultEmail } from 'services/fastVaultServer'
import { advanceToNextWallet } from 'utils/migrationNav'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VerifyEmail'>
type Route = RouteProp<MigrationStackParams, 'VerifyEmail'>

export default function VerifyEmail() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const {
    walletName,
    walletIndex,
    totalWallets,
    wallets,
    results,
    email,
    publicKey,
  } = route.params

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = useCallback(async (verifyCode: string) => {
    if (verifyCode.length !== 4 || verifying) return
    Keyboard.dismiss()
    setVerifying(true)

    try {
      await verifyVaultEmail({ public_key: publicKey, code: verifyCode })
      advanceToNextWallet(
        navigation, wallets, walletIndex, totalWallets, results, email,
        { wallet: wallets[walletIndex], success: true },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      Alert.alert('Verification Failed', msg)
      setCode('')
      setVerifying(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [publicKey, verifying, wallets, walletIndex, navigation, totalWallets, results, email])

  const handleChangeText = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4)
    setCode(digits)
    if (digits.length === 4) {
      setTimeout(() => handleSubmit(digits), 100)
    }
  }, [handleSubmit])

  const handlePaste = useCallback(async () => {
    const clip = await Clipboard.getStringAsync()
    const digits = clip.replace(/\D/g, '').slice(0, 4)
    if (digits.length > 0) {
      setCode(digits)
      if (digits.length === 4) {
        setTimeout(() => handleSubmit(digits), 100)
      }
    }
  }, [handleSubmit])

  const digitBoxes = [0, 1, 2, 3].map((i) => {
    const isActive = i === code.length && !verifying
    const isFilled = i < code.length
    return (
      <View
        key={i}
        style={[
          styles.digitBox,
          isActive && styles.digitBoxActive,
          isFilled && styles.digitBoxFilled,
        ]}
      >
        <Text style={styles.digitText} fontType="bold">
          {isFilled ? code[i] : ''}
        </Text>
        {isActive && <View style={styles.cursor} />}
      </View>
    )
  })

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <Text style={styles.walletLabel} fontType="book">
          Wallet {walletIndex + 1}/{totalWallets}: {walletName}
        </Text>

        <Text style={styles.title} fontType="bold">
          Verify your email
        </Text>
        <Text style={styles.subtitle} fontType="book">
          Enter the 4-digit code sent to {email} to activate the co-signer.
        </Text>

        <View style={styles.codeRow}>
          {digitBoxes}
          <TouchableOpacity
            style={styles.pasteButton}
            onPress={handlePaste}
            testID="verify-paste"
          >
            <Text style={styles.pasteText} fontType="medium">Paste</Text>
          </TouchableOpacity>
        </View>

        {verifying && (
          <Text style={styles.verifyingText} fontType="book">
            Verifying...
          </Text>
        )}

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="number-pad"
          maxLength={4}
          value={code}
          onChangeText={handleChangeText}
          autoFocus={false}
          testID="verify-code-input"
        />

        <Text style={styles.emailNote} fontType="book">
          Sent to {email}
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VULTISIG.bg, justifyContent: 'center' },
  content: { paddingHorizontal: 24, alignItems: 'center' },
  walletLabel: { fontSize: 13, color: VULTISIG.textSecondary, marginBottom: 12, alignSelf: 'flex-start' },
  title: { fontSize: 28, color: VULTISIG.textPrimary, marginBottom: 8, alignSelf: 'flex-start' },
  subtitle: { fontSize: 15, color: VULTISIG.textSecondary, lineHeight: 22, marginBottom: 32, alignSelf: 'flex-start' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  digitBox: {
    width: 58,
    height: 46,
    borderRadius: VULTISIG.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: VULTISIG.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxActive: { borderColor: VULTISIG.accent },
  digitBoxFilled: { borderColor: 'rgba(255,255,255,0.12)' },
  digitText: { fontSize: 22, color: VULTISIG.textPrimary },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 2,
    height: 20,
    backgroundColor: VULTISIG.accent,
  },
  pasteButton: {
    width: 76,
    height: 46,
    borderRadius: VULTISIG.radiusMd,
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteText: { fontSize: 14, color: VULTISIG.accent },
  verifyingText: { fontSize: 14, color: VULTISIG.textSecondary, marginBottom: 16 },
  hiddenInput: { position: 'absolute', opacity: 0.02, width: 1, height: 1 },
  emailNote: { fontSize: 13, color: VULTISIG.textSecondary, marginTop: 24 },
})
