import React, { useState, useRef, useCallback } from 'react'
import {
  Modal,
  Pressable,
  TextInput,
  View,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import { useKeyboardVisible } from 'hooks/useKeyboardVisible'
import { MIGRATION } from 'consts/migration'

function LockIcon(): React.ReactElement {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z"
        stroke={MIGRATION.textLink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
        stroke={MIGRATION.textLink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="16.5" r="1.5" fill={MIGRATION.textLink} />
    </Svg>
  )
}

function EyeOpenIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
        stroke={MIGRATION.textTertiary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={MIGRATION.textTertiary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function EyeClosedIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2048 20.84 15.19M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.481 9.80385 14.1962C9.51897 13.9113 9.29439 13.5719 9.14351 13.1984C8.99262 12.8248 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2218 9.18488 10.8538C9.34884 10.4859 9.58525 10.1546 9.88 9.88"
        stroke={MIGRATION.textTertiary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1L23 23"
        stroke={MIGRATION.textTertiary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  visible: boolean
  onSubmit: (password: string) => void
  onDismiss: () => void
  error?: string
  loading?: boolean
}

export default function DecryptPasswordSheet({
  visible,
  onSubmit,
  onDismiss,
  error,
  loading = false,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()
  const inputRef = useRef<TextInput>(null)
  const [secureText, setSecureText] = useState(true)
  const [password, setPassword] = useState('')

  const handleShow = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleSubmit = (): void => {
    if (password.trim()) {
      onSubmit(password.trim())
    }
  }

  const handleDismiss = (): void => {
    if (!loading) {
      setPassword('')
      onDismiss()
    }
  }

  const content = (
    <Pressable style={styles.overlay} onPress={handleDismiss}>
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 40) },
        ]}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <View style={styles.grabber} />

        <View style={styles.iconContainer}>
          <LockIcon />
        </View>

        <Text fontType="brockmann-medium" style={styles.title}>
          Enter Vault Share Password
        </Text>

        <Text fontType="brockmann-medium" style={styles.subtitle}>
          This password was set when the vault share was exported.
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            testID="decrypt-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={MIGRATION.textTertiary}
            secureTextEntry={secureText}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                borderColor: error
                  ? MIGRATION.errorRed
                  : MIGRATION.strokeInput,
              },
            ]}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setSecureText(!secureText)}
            hitSlop={8}
          >
            {secureText ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </Pressable>
        </View>

        {error ? (
          <Text fontType="brockmann-medium" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <Button
          testID="decrypt-continue"
          title={loading ? 'Decrypting...' : 'Continue'}
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          onPress={handleSubmit}
          disabled={!password.trim() || loading}
          containerStyle={styles.button}
        />
      </View>
    </Pressable>
  )

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onShow={handleShow}
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={
          Platform.OS === 'android' && keyboardVisible ? -100 : 0
        }
      >
        {content}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MIGRATION.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 16,
    paddingTop: 7,
    alignItems: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 9999,
    backgroundColor: '#333333',
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    width: 211,
    marginBottom: 10,
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: 8,
  },
  input: {
    backgroundColor: MIGRATION.surface1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingRight: 48,
    color: MIGRATION.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Brockmann-Medium',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.06,
    color: MIGRATION.errorRed,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  button: {
    width: '100%',
    marginTop: 8,
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
