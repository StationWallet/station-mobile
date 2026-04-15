import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import {
  View,
  StyleSheet,
  TextInput,
  Keyboard,
  Alert,
  Pressable,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'
import Svg, { Path } from 'react-native-svg'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import { verifyVaultEmail } from 'services/fastVaultServer'
import { advanceToNextWallet } from 'utils/migrationNav'
import { getErrorMessage } from 'utils/getErrorMessage'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'VerifyEmail'>
type Route = RouteProp<MigrationStackParams, 'VerifyEmail'>

function EmailCircleIcon(): React.ReactElement {
  return (
    <View style={styles.emailIconOuter}>
      <View style={styles.emailIconGlow} />
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M16.6673 1.66406C14.8264 1.66406 13.334 3.15645 13.334 4.9974C13.334 6.83835 14.8264 8.33073 16.6673 8.33073C18.5082 8.33073 20.0007 6.83835 20.0007 4.9974C20.0007 3.15645 18.5082 1.66406 16.6673 1.66406ZM14.584 4.9974C14.584 3.8468 15.5167 2.91406 16.6673 2.91406C17.8179 2.91406 18.7507 3.8468 18.7507 4.9974C18.7507 6.14799 17.8179 7.08073 16.6673 7.08073C15.5167 7.08073 14.584 6.14799 14.584 4.9974Z"
          fill={MIGRATION.ctaBlue}
        />
        <Path
          d="M16.666 9.63808C16.3344 9.63808 16.011 9.60325 15.6992 9.53708C13.9753 10.3694 12.0418 10.836 9.99935 10.836C6.83519 10.836 3.93255 9.71633 1.66602 7.85156V14.3777C1.66602 15.6433 2.69203 16.6693 3.95768 16.6693H16.041C17.3067 16.6693 18.3327 15.6433 18.3327 14.3777V9.32941C17.8154 9.52883 17.2535 9.63808 16.666 9.63808Z"
          fill={MIGRATION.ctaBlue}
        />
        <Path
          d="M12.0306 5.0026C12.0306 4.41511 12.1399 3.85315 12.3393 3.33594H3.95768C2.69203 3.33594 1.66602 4.36195 1.66602 5.6276V6.17091C3.80976 8.28276 6.75237 9.58594 9.99935 9.58594C11.4389 9.58594 12.8187 9.32977 14.0954 8.8606C12.8506 8.02944 12.0306 6.61178 12.0306 5.0026Z"
          fill={MIGRATION.ctaBlue}
        />
      </Svg>
    </View>
  )
}

export default function VerifyEmail(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const {
    walletName,
    walletIndex = 0,
    wallets = [],
    results = [],
    email,
    publicKey,
  } = route.params

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150)
    return (): void => {
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = useCallback(
    async (verifyCode: string) => {
      if (verifyCode.length !== 4 || verifying) return
      Keyboard.dismiss()
      setVerifying(true)

      try {
        await verifyVaultEmail({
          public_key: publicKey,
          code: verifyCode,
        })
        advanceToNextWallet(navigation, {
          wallets,
          results,
          newResult: {
            wallet: wallets[walletIndex] ?? {
              name: walletName,
              address: '',
              ledger: false,
            },
            success: true,
          },
        })
      } catch (err) {
        const msg = getErrorMessage(err)
        Alert.alert('Verification Failed', msg)
        setCode('')
        setVerifying(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    },
    [publicKey, verifying, wallets, walletIndex, navigation, results]
  )

  const handleChangeText = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, 4)
      setCode(digits)
      if (digits.length === 4) {
        setTimeout(() => handleSubmit(digits), 100)
      }
    },
    [handleSubmit]
  )

  const handlePaste = useCallback(async (): Promise<void> => {
    const clip = await Clipboard.getStringAsync()
    const digits = clip.replace(/\D/g, '').slice(0, 4)
    if (digits.length > 0) {
      setCode(digits)
      if (digits.length === 4) {
        setTimeout(() => handleSubmit(digits), 100)
      }
    }
  }, [handleSubmit])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.content}
      >
        <EmailCircleIcon />

        <Text style={styles.title} fontType="brockmann-bold">
          4-digit code received{'\n'}via email
        </Text>

        <Text style={styles.subtitle} fontType="brockmann">
          This will activate the co-signer
        </Text>

        {/* Code input row */}
        <View style={styles.codeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter verification code"
            onPress={() => inputRef.current?.focus()}
            style={styles.digitsRow}
          >
            {[0, 1, 2, 3].map((i) => {
              const digit = code[i]
              const isActive = i === code.length && !verifying

              return (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    isActive && styles.digitBoxActive,
                  ]}
                >
                  {digit ? (
                    <Text
                      style={styles.digitText}
                      fontType="brockmann-bold"
                    >
                      {digit}
                    </Text>
                  ) : isActive ? (
                    <View style={styles.cursor} />
                  ) : null}
                </View>
              )
            })}
          </Pressable>

          <Pressable
            testID="verify-paste"
            accessibilityRole="button"
            accessibilityLabel="Paste verification code"
            onPress={handlePaste}
            style={styles.pasteButton}
          >
            <Text
              style={styles.pasteText}
              fontType="brockmann-medium"
            >
              Paste
            </Text>
          </Pressable>
        </View>

        {/* Hidden TextInput for keyboard */}
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

        {verifying && (
          <Text style={styles.verifyingText} fontType="brockmann">
            Verifying...
          </Text>
        )}

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          <Text style={styles.sendToText} fontType="brockmann">
            Send to {email}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use a different email"
            onPress={() => {
              navigation.goBack()
            }}
            style={styles.differentEmailButton}
          >
            <Text
              style={styles.differentEmailText}
              fontType="brockmann-medium"
            >
              Use a different email
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  // Email circle icon
  emailIconOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MIGRATION.ctaBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    overflow: 'hidden',
    marginBottom: 34,
  },
  emailIconGlow: {
    position: 'absolute',
    bottom: -12,
    width: 20,
    height: 10,
    borderRadius: 50,
  },
  // Title & subtitle
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    marginBottom: 36,
  },
  // Code row
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  digitBox: {
    width: 58,
    height: 46,
    borderRadius: MIGRATION.radiusSmallButton,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: MIGRATION.surface1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxActive: {
    borderWidth: 1.5,
    borderColor: MIGRATION.ctaBlue,
  },
  digitText: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
  },
  cursor: {
    width: 1.5,
    height: 22,
    borderRadius: 999,
    backgroundColor: MIGRATION.ctaBlue,
  },
  pasteButton: {
    width: 76,
    height: 46,
    borderRadius: MIGRATION.radiusSmallButton,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteText: {
    fontSize: 14,
    color: MIGRATION.ctaBlue,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.02,
    width: 1,
    height: 1,
  },
  verifyingText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    marginBottom: 16,
  },
  // Bottom
  bottomSection: {
    marginTop: 60,
    alignItems: 'center',
  },
  sendToText: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    marginBottom: 12,
  },
  differentEmailButton: {
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  differentEmailText: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
  },
})
