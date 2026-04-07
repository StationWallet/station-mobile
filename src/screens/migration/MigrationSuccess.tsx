import React from 'react'
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

export default function MigrationSuccess() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const onMigrationComplete = useMigrationComplete()
  const results: MigrationResult[] = params.results

  const successCount = results.filter((r) => r.success).length
  const allFailed = successCount === 0

  const handleContinue = async () => {
    if (!allFailed) {
      await preferences.setBool(PreferencesEnum.vaultsUpgraded, true)
    }
    onMigrationComplete()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={BounceIn.delay(200).duration(600)} style={[styles.iconContainer, allFailed && styles.iconContainerFailed]}>
          <Text style={styles.icon}>{allFailed ? '!' : '✓'}</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)}>
          <Text style={styles.title} fontType="bold">
            {allFailed ? 'Migration Failed' : 'Wallets Upgraded'}
          </Text>
          <Text style={styles.subtitle} fontType="book">
            {allFailed
              ? 'Unable to migrate your wallets. Please restart the app to try again.'
              : `${successCount} ${successCount === 1 ? 'wallet' : 'wallets'} successfully migrated to Vultisig format.`}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(700).duration(400)}
          style={styles.walletList}
        >
          {results.map((result, index) => (
            <View key={result.wallet.name} style={styles.walletRow} testID={`success-wallet-${index}`}>
              <Text style={styles.checkMark}>{result.success ? '✓' : '✗'}</Text>
              <Text
                style={[
                  styles.walletName,
                  !result.success && styles.walletNameFailed,
                ]}
                fontType="medium"
              >
                {result.wallet.name}
              </Text>
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
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkMark: {
    fontSize: 16,
    color: VULTISIG.accent,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  walletName: {
    fontSize: 15,
    color: VULTISIG.textPrimary,
  },
  walletNameFailed: {
    color: VULTISIG.error,
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
