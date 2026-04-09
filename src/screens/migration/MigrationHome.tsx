import React, { useEffect, useState } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'
import InfoCard from 'components/migration/InfoCard'
import { discoverLegacyWallets, MigrationWallet } from 'services/migrateToVault'

// Minimal local type covering the screens this component navigates to.
// Task 12 will replace this with the canonical MigrationStackParams.
type MigrationHomeStackParams = {
  MigrationHome: undefined
  WalletsFound: { wallets: MigrationWallet[] }
  VaultName: undefined
  ImportVault: undefined
}

type Nav = StackNavigationProp<MigrationHomeStackParams, 'MigrationHome'>

/** Migration deadline — 30 days from a fixed launch date. */
const MIGRATION_DEADLINE = new Date('2026-05-09T00:00:00Z')

function computeDaysRemaining(): number {
  const now = new Date()
  const diff = MIGRATION_DEADLINE.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function MigrationHome() {
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  const [ready, setReady] = useState(false)
  const daysRemaining = computeDaysRemaining()

  useEffect(() => {
    discoverLegacyWallets()
      .then((found) => {
        setWallets(found)
        setReady(true)
      })
      .catch(() => {
        setReady(true)
      })
  }, [])

  const hasLegacyWallets = wallets.length > 0

  const handleCta = () => {
    if (hasLegacyWallets) {
      navigation.navigate('WalletsFound', { wallets })
    } else {
      navigation.navigate('VaultName')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(600)}
        style={styles.content}
      >
        {/* Rive wallet animation placeholder */}
        <View style={styles.animationPlaceholder} />

        {/* Title */}
        <Text fontType="brockmann-medium" style={styles.title}>
          {'Your seed phrase\nbecomes a Fast Vault'}
        </Text>

        {/* Info card */}
        <View style={styles.cardWrapper}>
          <InfoCard daysRemaining={daysRemaining} />
        </View>

        {/* Button group */}
        {ready && (
          <View style={styles.buttonGroup}>
            <Button
              title={hasLegacyWallets ? 'Start Migration' : 'Create a Fast Vault'}
              theme="ctaBlue"
              titleFontType="brockmann-medium"
              onPress={handleCta}
              containerStyle={styles.ctaButton}
              testID="migration-cta"
            />

            <Button
              title="I already have a Fast Vault"
              theme="secondaryDark"
              titleFontType="brockmann-medium"
              onPress={() => navigation.navigate('ImportVault')}
              containerStyle={styles.secondaryButton}
              testID="import-vault-button"
            />

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                // Placeholder — no-op for now
              }}
            >
              <Text fontType="brockmann" style={styles.linkText}>
                Learn more about Vault security
              </Text>
            </TouchableOpacity>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  animationPlaceholder: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginTop: 92,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
    lineHeight: 30,
  },
  cardWrapper: {
    marginBottom: 24,
  },
  buttonGroup: {
    marginTop: 'auto',
    paddingBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  ctaButton: {
    borderRadius: 99,
    height: 46,
    width: '100%',
  },
  secondaryButton: {
    borderRadius: 99,
    height: 46,
    width: '100%',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: MIGRATION.textLink,
    textDecorationLine: 'underline',
  },
})
