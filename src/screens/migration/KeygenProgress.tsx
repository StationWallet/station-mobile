import React, { useEffect, useRef, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import Button from 'components/Button'
import { MIGRATION } from 'consts/migration'
import { importKeyToFastVault, KeyImportResult, KeyImportProgress } from 'services/dklsKeyImport'
import { storeFastVault } from 'services/migrateToVault'
import { getAuthDataValue, AuthDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'
import { randomHex } from 'utils/mpcCrypto'
import type { MigrationResult } from 'services/migrateToVault'
import { advanceToNextWallet } from 'utils/migrationNav'
import { getErrorMessage } from 'utils/getErrorMessage'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'KeygenProgress'>
type Route = RouteProp<MigrationStackParams, 'KeygenProgress'>

export default function KeygenProgress() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const {
    walletName,
    walletIndex = 0,
    wallets = [],
    results = [],
    email,
    password,
    mode,
  } = route.params

  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const progressValue = useSharedValue(0)

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%` as `${number}%`,
  }))

  const updateProgress = useCallback((p: KeyImportProgress) => {
    setProgress(p.progress)
    progressValue.value = withTiming(p.progress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    })
  }, [progressValue])

  const advance = useCallback(
    (newResult: MigrationResult) => {
      advanceToNextWallet(navigation, { wallets, results, newResult })
    },
    [navigation, results, wallets],
  )

  const runCeremony = useCallback(async () => {
    setError(null)
    setProgress(0)
    progressValue.value = 0

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let result: KeyImportResult

      if (mode === 'create') {
        // Fresh vault creation — generate a new random secp256k1 private key
        // and import it into a 2-of-2 DKLS fast vault.
        const privateKeyHex = randomHex(32)
        result = await importKeyToFastVault({
          name: walletName,
          email,
          password,
          privateKeyHex,
          onProgress: updateProgress,
          signal: controller.signal,
        })
      } else {
        // mode === 'migrate' — import existing key into fast vault
        const authEntry = await getAuthDataValue(walletName)
        if (!authEntry || authEntry.ledger) {
          throw new Error('No auth data found for wallet')
        }
        const standardData = authEntry as AuthDataValueType
        // Legacy stored password (for decrypting the old key) — NOT the new vault password
        const privateKeyHex = decrypt(standardData.encryptedKey, standardData.password)
        if (!privateKeyHex) {
          throw new Error('Failed to decrypt private key')
        }
        result = await importKeyToFastVault({
          name: walletName,
          email,
          password,
          privateKeyHex,
          onProgress: updateProgress,
          signal: controller.signal,
        })
      }

      await storeFastVault(walletName, result)

      navigation.navigate('VerifyEmail', {
        walletName,
        walletIndex,
        wallets,
        results,
        mode,
        email,
        publicKey: result.publicKey,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = getErrorMessage(err)
      setError(msg)
    }
  }, [walletName, email, password, mode, wallets, walletIndex, updateProgress, progressValue])

  useEffect(() => {
    runCeremony()
    return () => {
      abortRef.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const phaseText = progress < 35 ? 'Connecting...' : 'Generating...'

  const handleSkip = useCallback(() => {
    abortRef.current?.abort()
    const wallet = wallets[walletIndex]
    advance({ wallet, success: false, error: 'Skipped by user' })
  }, [wallets, walletIndex, advance])

  const handleRetry = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    runCeremony()
  }, [runCeremony])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <Text style={styles.walletLabel} fontType="brockmann">
          Wallet {walletIndex + 1}/{wallets.length}: {walletName}
        </Text>

        <Text style={styles.title} fontType="brockmann-bold">
          Fast Vault Setup
        </Text>

        <View style={styles.phaseContainer}>
          <Text style={styles.phaseText} fontType="brockmann-medium">
            {error ? 'Failed' : phaseText}
          </Text>
          <Text style={styles.progressPercent} fontType="brockmann">
            {Math.round(progress)}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressBarStyle]} />
        </View>

        {error && (
          <View style={styles.errorSection}>
            <View style={styles.errorCard}>
              <Text testID="keygen-error-text" style={styles.errorText} fontType="brockmann">
                {error}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Button
                testID="keygen-skip"
                title="Skip"
                theme="secondaryDark"
                titleFontType="brockmann-medium"
                onPress={handleSkip}
                containerStyle={styles.skipButton}
              />
              <Button
                testID="keygen-retry"
                title="Retry"
                theme="ctaBlue"
                titleFontType="brockmann-medium"
                onPress={handleRetry}
                containerStyle={styles.retryButton}
              />
            </View>
          </View>
        )}
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
  walletLabel: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    color: MIGRATION.textPrimary,
    marginBottom: 40,
    alignSelf: 'flex-start',
  },
  phaseContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  phaseText: {
    fontSize: 15,
    color: MIGRATION.ctaBlue,
  },
  progressPercent: {
    fontSize: 15,
    color: MIGRATION.textTertiary,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    backgroundColor: MIGRATION.surface1,
    borderRadius: MIGRATION.radiusPill,
    overflow: 'hidden',
    marginBottom: 40,
  },
  progressFill: {
    height: '100%',
    backgroundColor: MIGRATION.ctaBlue,
    borderRadius: MIGRATION.radiusPill,
  },
  errorSection: {
    alignSelf: 'stretch',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 92, 92, 0.1)',
    borderRadius: MIGRATION.radiusCard,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: MIGRATION.errorRed,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    borderRadius: MIGRATION.radiusPill,
  },
  retryButton: {
    flex: 2,
    borderRadius: MIGRATION.radiusPill,
  },
})
