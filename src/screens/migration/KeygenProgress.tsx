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
import { VULTISIG } from 'consts/vultisig'
import { importKeyToFastVault, KeyImportResult, KeyImportProgress } from 'services/dklsKeyImport'
import { storeFastVault } from 'services/migrateToVault'
import { getAuthDataValue, AuthDataValueType } from 'utils/authData'
import { decrypt } from 'utils/crypto'
import type { MigrationResult } from 'services/migrateToVault'
import { advanceToNextWallet } from 'utils/migrationNav'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'KeygenProgress'>
type Route = RouteProp<MigrationStackParams, 'KeygenProgress'>

export default function KeygenProgress() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const {
    walletName,
    walletIndex,
    totalWallets,
    wallets,
    results,
    email,
    password,
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
      advanceToNextWallet(navigation, wallets, walletIndex, totalWallets, results, email, newResult)
    },
    [navigation, results, walletIndex, wallets, totalWallets, email],
  )

  const runCeremony = useCallback(async () => {
    setError(null)
    setProgress(0)
    progressValue.value = 0

    const controller = new AbortController()
    abortRef.current = controller

    try {
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

      const result: KeyImportResult = await importKeyToFastVault({
        name: walletName,
        email,
        password,
        privateKeyHex,
        onProgress: updateProgress,
        signal: controller.signal,
      })

      await storeFastVault(walletName, result)

      navigation.navigate('VerifyEmail', {
        walletName,
        walletIndex,
        totalWallets,
        wallets,
        results,
        email,
        publicKey: result.publicKey,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }, [walletName, email, password, wallets, walletIndex, updateProgress, progressValue])

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
        <Text style={styles.walletLabel} fontType="book">
          Wallet {walletIndex + 1}/{totalWallets}: {walletName}
        </Text>

        <Text style={styles.title} fontType="bold">
          Fast Vault Setup
        </Text>

        <View style={styles.phaseContainer}>
          <Text style={styles.phaseText} fontType="medium">
            {error ? 'Failed' : phaseText}
          </Text>
          <Text style={styles.progressPercent} fontType="book">
            {Math.round(progress)}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressBarStyle]} />
        </View>

        {error && (
          <View style={styles.errorSection}>
            <View style={styles.errorCard}>
              <Text style={styles.errorText} fontType="book">
                {error}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Button
                testID="keygen-skip"
                title="Skip"
                theme="transparent"
                onPress={handleSkip}
                containerStyle={styles.skipButton}
              />
              <Button
                testID="keygen-retry"
                title="Retry"
                theme="sapphire"
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
    backgroundColor: VULTISIG.bg,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
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
    color: VULTISIG.accent,
  },
  progressPercent: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    backgroundColor: VULTISIG.card,
    borderRadius: VULTISIG.radiusPill,
    overflow: 'hidden',
    marginBottom: 40,
  },
  progressFill: {
    height: '100%',
    backgroundColor: VULTISIG.accent,
    borderRadius: VULTISIG.radiusPill,
  },
  errorSection: {
    alignSelf: 'stretch',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 92, 92, 0.1)',
    borderRadius: VULTISIG.radiusMd,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: VULTISIG.error,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
  },
  retryButton: {
    flex: 2,
  },
})
