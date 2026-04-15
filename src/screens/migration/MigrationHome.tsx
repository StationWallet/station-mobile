import React, { useEffect, useState } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Svg, { Path } from 'react-native-svg'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import { DevFlags } from '../../config/env'
import Button from 'components/Button'
import InfoCard from 'components/migration/InfoCard'
import RocketWithGlow from 'components/migration/RocketWithGlow'
import PrimaryBackground from 'components/PrimaryBackground'
import {
  discoverLegacyWallets,
  MigrationWallet,
} from 'services/migrateToVault'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import { MIGRATION_FLOW_ENABLED } from 'config/env'

function CalendarClockIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v4H3V6a2 2 0 012-2z"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 10v8a2 2 0 002 2h6"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 22a4 4 0 100-8 4 4 0 000 8z"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 16.5v1.5l1 1"
        stroke="#4879fd"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationHome'>

/** Migration deadline — 30 days from a fixed launch date. */
const MIGRATION_DEADLINE = new Date('2026-05-09T00:00:00Z')

function computeDaysRemaining(): number {
  const now = new Date()
  const diff = MIGRATION_DEADLINE.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function MigrationHome(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setReady used to track loading state
  const [_ready, setReady] = useState(false)
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

  const handleCta = (): void => {
    if (hasLegacyWallets) {
      navigation.navigate('WalletsFound')
    } else {
      navigation.navigate('VaultSetup')
    }
  }

  return (
    <View
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <PrimaryBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Rive animation: 200x200, top ~92px from screen top */}
          <Animated.View
            entering={FadeIn.delay(0).duration(300)}
            style={[
              styles.animationPlaceholder,
              { marginTop: Math.max(20, 140 - insets.top) },
            ]}
          >
            <RocketWithGlow size={200} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(300)}>
            <Text fontType="brockmann-medium" style={styles.title}>
              {'Your seed phrase\nbecomes a Fast Vault'}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(1200).duration(300)}
            style={styles.cardWrapper}
          >
            <InfoCard
              daysRemaining={daysRemaining}
              connectedBottom={!MIGRATION_FLOW_ENABLED}
            />
            {!MIGRATION_FLOW_ENABLED && (
              <View
                style={styles.checkBackCard}
                testID="check-back-soon"
              >
                <CalendarClockIcon />
                <Text
                  fontType="brockmann-medium"
                  style={styles.checkBackText}
                >
                  Check back soon...
                </Text>
              </View>
            )}
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(1800).duration(300)}
            style={styles.buttonGroup}
          >
            {MIGRATION_FLOW_ENABLED && (
              <>
                <Button
                  title={
                    hasLegacyWallets
                      ? 'Start Migration'
                      : 'Create a Fast Vault'
                  }
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
              </>
            )}

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                Linking.openURL(
                  'https://docs.vultisig.com/getting-started/getting-started#what-makes-vultisig-different'
                )
              }}
            >
              <Text
                fontType="brockmann-medium"
                style={styles.linkText}
              >
                Learn more about Vault security
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Dev seed buttons — outside ready gate so they render immediately for E2E tests */}
          {DevFlags.SeedLegacyData && (
            <View style={styles.devButtons}>
              <TouchableOpacity
                testID="dev-seed-legacy"
                style={styles.devButton}
                onPress={() => navigation.navigate('SeedLegacyData')}
              >
                <Text style={styles.devButtonText}>
                  Seed Legacy Data (dev)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="dev-seed-corrupt"
                style={styles.devButton}
                onPress={() => navigation.navigate('SeedCorruptData')}
              >
                <Text style={styles.devButtonText}>
                  Seed Corrupt Data (dev)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  animationPlaceholder: {
    width: 200,
    height: DevFlags.SeedLegacyData ? 40 : 200,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 28,
    lineHeight: 24,
    letterSpacing: -0.36,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  buttonGroup: {
    marginTop: 'auto',
    paddingBottom: 24,
    gap: 16,
    alignItems: 'center',
  },
  checkBackCard: {
    backgroundColor: MIGRATION.surface1,
    borderBottomLeftRadius: MIGRATION.radiusCard,
    borderBottomRightRadius: MIGRATION.radiusCard,
    marginTop: -20,
    paddingTop: 32,
    paddingBottom: 14,
    paddingHorizontal: 32,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    zIndex: 0,
  },
  checkBackText: {
    fontSize: 12,
    color: MIGRATION.textPrimary,
    lineHeight: 16,
  },
  ctaButton: {
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
    width: '100%',
  },
  secondaryButton: {
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
    width: '100%',
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  devButtons: {
    marginTop: 12,
    gap: 8,
    width: '100%',
  },
  devButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  devButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
})
