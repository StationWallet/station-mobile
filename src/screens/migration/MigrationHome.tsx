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

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationHome'>

export default function MigrationHome(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setReady used to track loading state
  const [_ready, setReady] = useState(false)

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
    <View style={styles.container}>
      <PrimaryBackground />

      {/*
       * ScrollView with flexGrow: 1 on contentContainerStyle makes the inner
       * content flex to fill the full viewport on both iPhone and iPad.
       * No magic number top-margin: we respect insets.top via paddingTop on
       * the content view so the animation sits naturally below the status bar
       * on every device.
       */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View
            entering={FadeIn.delay(0).duration(300)}
            style={styles.animationPlaceholder}
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
            <InfoCard />
          </Animated.View>

          {/*
           * marginTop: 'auto' pushes the button group to the bottom of the
           * flex column on both small (iPhone) and large (iPad) viewports —
           * no fixed positioning needed.
           */}
          <Animated.View
            entering={FadeIn.delay(1800).duration(300)}
            style={styles.buttonGroup}
          >
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
    gap: 16,
    alignItems: 'center',
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
