import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { View, StyleSheet, Dimensions, PixelRatio } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import {
  useNavigation,
  useRoute,
  useIsFocused,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import RiveComponent, {
  useRive,
  useRiveBoolean,
  useRiveNumber,
  Fit as RiveFitEnum,
  AutoBind as AutoBindFn,
} from 'rive-react-native'

import Text from 'components/Text'
import Button from 'components/Button'
import { MIGRATION } from 'consts/migration'
import {
  importKeyToFastVault,
  KeyImportResult,
  KeyImportProgress,
} from 'services/dklsKeyImport'
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function KeygenProgress(): React.ReactElement {
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

  const isFocused = useIsFocused()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  // Rive data binding state
  const [autoBind, setAutoBind] = useState(false)
  const [setRiveRef, riveRef] = useRive()
  const [, setConnected] = useRiveBoolean(riveRef, 'Connected')
  const [, setRiveProgress] = useRiveNumber(riveRef, 'progessPercentage')
  const [, setPosX] = useRiveNumber(riveRef, 'posXcircles')

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Set initial position once autoBind is ready
  useEffect(() => {
    if (riveRef && autoBind && mountedRef.current) {
      try {
        setPosX(SCREEN_WIDTH / 2)
        if (riveRef.setNumber) {
          riveRef.setNumber('posXcircles', SCREEN_WIDTH / 2)
          if (riveRef.play) riveRef.play()
        }
      } catch {
        /* Rive view may have unmounted */
      }
    }
  }, [riveRef, autoBind, setPosX])

  // Update Connected boolean based on progress
  useEffect(() => {
    if (riveRef && mountedRef.current) {
      try {
        const isConnected = progress >= 35
        setConnected(isConnected)
        if (riveRef.setBoolean) {
          riveRef.setBoolean('Connected', isConnected)
          if (riveRef.play) riveRef.play()
        }
      } catch {
        // Rive native view not ready yet
      }
    }
  }, [progress, riveRef, setConnected])

  // Update progress in Rive
  useEffect(() => {
    if (riveRef && autoBind && mountedRef.current) {
      try {
        setRiveProgress(progress)
        if (riveRef.setNumber) {
          riveRef.setNumber('progessPercentage', progress)
          if (riveRef.play) riveRef.play()
        }
      } catch {
        // Rive native view may not be ready
      }
    }
  }, [progress, riveRef, autoBind, setRiveProgress])

  const updateProgress = useCallback(
    (p: KeyImportProgress) => {
      setProgress(p.progress)
    },
    []
  )

  const advance = useCallback(
    (newResult: MigrationResult) => {
      advanceToNextWallet(navigation, { wallets, results, newResult })
    },
    [navigation, results, wallets]
  )

  const runCeremony = useCallback(async (): Promise<void> => {
    setError(null)
    setProgress(0)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let result: KeyImportResult

      if (mode === 'create') {
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
        const authEntry = await getAuthDataValue(walletName)
        if (!authEntry || authEntry.ledger) {
          throw new Error('No auth data found for wallet')
        }
        const standardData = authEntry as AuthDataValueType
        const privateKeyHex = decrypt(
          standardData.encryptedKey,
          standardData.password
        )
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
  }, [
    walletName,
    email,
    password,
    mode,
    wallets,
    walletIndex,
    updateProgress,
  ])

  useEffect(() => {
    runCeremony()
    return (): void => {
      abortRef.current?.abort()
    }
  }, []) // Run ceremony once on mount — runCeremony intentionally excluded

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
    <View style={styles.container}>
      {/* Full-screen Rive animation — unmount when navigated away to stop audio */}
      <View style={styles.riveContainer}>
        {isFocused && (
          <RiveComponent
            ref={setRiveRef}
            source={require('../../../assets/animations/keygen_fast.riv')}
            autoplay
            fit={RiveFitEnum.Layout}
            layoutScaleFactor={PixelRatio.get()}
            style={styles.riveView}
            dataBinding={AutoBindFn(autoBind)}
            onStateChanged={() => {
              if (!autoBind) {
                setAutoBind(true)
              }
            }}
          />
        )}
      </View>

      {/* Error overlay */}
      {error && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.errorOverlay}
        >
          <View style={styles.errorCard}>
            <Text
              testID="keygen-error-text"
              style={styles.errorText}
              fontType="brockmann"
            >
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
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  riveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  riveView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
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
