import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import { UTIL } from 'consts'
import { VULTISIG } from 'consts/vultisig'
import { discoverLegacyWallets, MigrationWallet } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'WalletDiscovery'>

export default function WalletDiscovery() {
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  const [ready, setReady] = useState(false)

  const [error, setError] = useState(false)

  useEffect(() => {
    discoverLegacyWallets()
      .then((found) => {
        setWallets(found)
        setReady(true)
      })
      .catch(() => {
        setError(true)
        setReady(true)
      })
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.header}>
          <Text style={styles.title} fontType="bold">
            Wallets Found
          </Text>
          <Text style={styles.subtitle} fontType="book">
            We discovered your existing wallets and they're ready to upgrade to Vultisig.
          </Text>
        </Animated.View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText} fontType="book">
              Something went wrong reading your wallets. Please restart the app and try again.
            </Text>
          </View>
        )}

        <View style={styles.walletList}>
          {wallets.map((wallet, index) => (
            <Animated.View
              key={wallet.name}
              entering={FadeInDown.delay(400 + index * 150).duration(400)}
              style={styles.walletCard}
              testID={`wallet-card-${index}`}
            >
              <View style={styles.walletInfo}>
                <Text style={styles.walletName} fontType="medium">
                  {wallet.name}
                </Text>
                <Text style={styles.walletAddress} fontType="book">
                  {UTIL.truncate(wallet.address, [10, 4])}
                </Text>
              </View>
              {wallet.ledger && (
                <View style={styles.ledgerBadge}>
                  <Text style={styles.ledgerText} fontType="medium">Ledger</Text>
                </View>
              )}
            </Animated.View>
          ))}
        </View>

        {ready && (
          <Animated.View
            entering={FadeInDown.delay(400 + wallets.length * 150 + 200).duration(500)}
            style={styles.buttonContainer}
          >
            <Button
              title="Upgrade"
              theme="sapphire"
              onPress={() => navigation.navigate('MigrationProgress', { wallets })}
              containerStyle={styles.upgradeButton}
              testID="upgrade-button"
            />
          </Animated.View>
        )}
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
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 92, 92, 0.1)',
    borderRadius: VULTISIG.radiusMd,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: VULTISIG.error,
    lineHeight: 20,
  },
  walletList: {
    flex: 1,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderColor: VULTISIG.cardBorder,
    borderRadius: VULTISIG.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    color: VULTISIG.textPrimary,
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 13,
    color: VULTISIG.textSecondary,
  },
  ledgerBadge: {
    backgroundColor: VULTISIG.accentDim,
    borderRadius: VULTISIG.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ledgerText: {
    fontSize: 11,
    color: VULTISIG.accent,
  },
  buttonContainer: {
    paddingBottom: 24,
  },
  upgradeButton: {
    width: '100%',
  },
})
