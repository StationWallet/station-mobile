import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  BounceIn,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp, useRoute } from '@react-navigation/native'

import Text from 'components/Text'
import Button from 'components/Button'
import VaultieComingSoonCard from 'components/VaultieComingSoonCard'
import { VULTISIG } from 'consts/vultisig'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'
import { useMigrationComplete } from 'navigation/MigrationContext'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationResult } from 'services/migrateToVault'

const DevVerifyVault = __DEV__
  ? require('components/DevVerifyVault').default
  : null

export default function MigrationSuccess() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const onMigrationComplete = useMigrationComplete()
  const results: MigrationResult[] = params.results

  const successCount = results.filter((r) => r.success).length
  const allSucceeded = successCount === results.length
  const allFailed = successCount === 0

  // Write the flag eagerly when this screen mounts (not just on tap)
  // so it persists even if the app is killed before the user taps Continue.
  // vaultsUpgraded means "user has been through the migration flow",
  // not "all wallets are upgraded" — set it regardless of partial failure.
  useEffect(() => {
    preferences.setBool(PreferencesEnum.vaultsUpgraded, true)
  }, [])

  const handleContinue = () => {
    onMigrationComplete()
  }

  const titleText = allFailed
    ? 'Migration Failed'
    : allSucceeded
      ? 'Wallets Upgraded!'
      : 'Migration Complete'

  const subtitleText = allFailed
    ? 'Unable to migrate your wallets. Please restart the app to try again.'
    : `${successCount} of ${results.length} ${results.length === 1 ? 'wallet' : 'wallets'} successfully upgraded to fast vault.`

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={BounceIn.delay(200).duration(600)} style={[styles.iconContainer, allFailed && styles.iconContainerFailed]}>
          <Text style={styles.icon}>{allFailed ? '!' : '✓'}</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)}>
          <Text style={styles.title} fontType="bold">
            {titleText}
          </Text>
          <Text style={styles.subtitle} fontType="book">
            {subtitleText}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(700).duration(400)}
          style={styles.walletList}
        >
          {results.map((result, index) => (
            <View key={result.wallet.name} style={styles.walletRow} testID={`success-wallet-${index}`}>
              {result.success ? (
                <Text style={styles.successIcon}>✓</Text>
              ) : (
                <Text style={styles.warningIcon}>⚠</Text>
              )}
              <View style={styles.walletInfo}>
                <Text
                  style={[
                    styles.walletName,
                    !result.success && styles.walletNameLegacy,
                  ]}
                  fontType="medium"
                >
                  {result.wallet.name}
                </Text>
                {!result.success && (
                  <Text style={styles.legacyLabel} fontType="book">
                    Legacy — upgrade in wallet list
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(900).duration(400)}>
          <VaultieComingSoonCard />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(1200).duration(400)}
          style={styles.buttonContainer}
        >
          <Button
            title="Continue"
            theme="sapphire"
            onPress={handleContinue}
            containerStyle={styles.continueButton}
            testID="continue-button"
          />
        </Animated.View>

        {__DEV__ && DevVerifyVault && <DevVerifyVault />}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: VULTISIG.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconContainerFailed: {
    backgroundColor: VULTISIG.error,
  },
  icon: {
    fontSize: 36,
    color: VULTISIG.bg,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  walletList: {
    width: '100%',
    marginBottom: 24,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  successIcon: {
    fontSize: 16,
    color: VULTISIG.success,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  warningIcon: {
    fontSize: 16,
    color: VULTISIG.warning,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 15,
    color: VULTISIG.textPrimary,
  },
  walletNameLegacy: {
    color: VULTISIG.warning,
  },
  legacyLabel: {
    fontSize: 12,
    color: VULTISIG.warning,
    marginTop: 2,
    opacity: 0.85,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 24,
    marginTop: 'auto',
  },
  continueButton: {
    width: '100%',
  },
})
