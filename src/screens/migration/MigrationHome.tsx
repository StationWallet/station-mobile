import React, { useEffect, useState } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  useWindowDimensions,
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
import { getWallets } from 'utils/wallet'
import { useWalletNav } from 'navigation/hooks'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import AddWalletSheet from 'components/AddWalletSheet'

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationHome'>

export default function MigrationHome(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { height: viewportHeight } = useWindowDimensions()
  // Compact sizing for short viewports — primarily iPad-letterbox (667pt)
  // and small iPhones (SE 1st gen 568pt). Modern iPhones (≥812pt) keep the
  // generous default sizing.
  const isShort = viewportHeight < 700
  const heroSize = isShort ? 140 : 200
  const titleMargin = isShort ? 16 : 28
  const [wallets, setWallets] = useState<MigrationWallet[]>([])
  const [totalWalletCount, setTotalWalletCount] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setReady used to track loading state
  const [_ready, setReady] = useState(false)
  const [importSheetVisible, setImportSheetVisible] = useState(false)
  // We're already inside the Migration navigator here, so the root-route
  // dance in `useWalletNav` is a no-op (setRootRoute('Migration') doesn't
  // re-mount the navigator, and `initialRouteName` is only read once at
  // mount). Push the right screen directly via the local stack nav.
  const startSeedRecoveryFromHere = (): void => {
    navigation.navigate('RecoverSeed')
  }
  const startImportVaultFromHere = (): void => {
    navigation.navigate('ImportVault')
  }
  const startCreateVaultFromHere = (): void => {
    navigation.navigate('VaultName', { mode: 'create' })
  }

  const { goHome } = useWalletNav()

  useEffect(() => {
    Promise.all([discoverLegacyWallets(), getWallets()])
      .then(([found, all]) => {
        setWallets(found)
        setTotalWalletCount(all.length)
        setReady(true)
      })
      .catch(() => {
        setReady(true)
      })
  }, [])

  const hasUnmigratedLegacy = wallets.length > 0
  const hasAnyVaults = totalWalletCount > 0

  // CTA copy:
  // - has unmigrated legacy AND has vaults → "Continue migration"
  // - has unmigrated legacy, no vaults yet → "Start Migration"
  // - no unmigrated legacy, has vaults → "See my vaults"
  // - nothing → "Create a Fast Vault"
  const ctaTitle =
    hasUnmigratedLegacy && hasAnyVaults
      ? 'Continue migration'
      : hasUnmigratedLegacy
      ? 'Start Migration'
      : hasAnyVaults
      ? 'See my vaults'
      : 'Create a Fast Vault'

  const handleCta = (): void => {
    if (hasUnmigratedLegacy) {
      navigation.navigate('WalletsFound')
    } else if (hasAnyVaults) {
      // MigrationHome can be mounted at two depths:
      //  1. Root → Migration → MigrationHome (post-init when legacyDataFound)
      //  2. Root → Main → Migration → MigrationHome (when user back-navs from
      //     WalletList into the nested Migration stack)
      // In case 2 the root is already 'Main', so goHome's setRootRoute('Main')
      // is a no-op and the screen looks frozen. Pop the parent stack to
      // WalletList directly when nested; otherwise fall back to the root swap.
      const parent = navigation.getParent()
      if (parent) {
        parent.navigate('WalletList' as never)
      } else {
        goHome()
      }
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
            style={[
              styles.animationPlaceholder,
              { width: heroSize, height: heroSize },
            ]}
          >
            <RocketWithGlow size={heroSize} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(300)}>
            <Text
              fontType="brockmann-medium"
              style={[
                styles.title,
                { marginTop: titleMargin, marginBottom: titleMargin },
              ]}
            >
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
              title={ctaTitle}
              theme="ctaBlue"
              titleFontType="brockmann-medium"
              onPress={handleCta}
              containerStyle={styles.ctaButton}
              testID="migration-cta"
            />

            <Button
              title="Import wallet"
              theme="secondaryDark"
              titleFontType="brockmann-medium"
              onPress={() => setImportSheetVisible(true)}
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

      <AddWalletSheet
        visible={importSheetVisible}
        onDismiss={() => setImportSheetVisible(false)}
        onCreate={startCreateVaultFromHere}
        onRecover={startSeedRecoveryFromHere}
        onImport={startImportVaultFromHere}
        // MigrationHome's "Import wallet" entry is for users who already
        // have a wallet — Create would just be a misroute. The shared sheet
        // still defaults to showing it for the WalletList entry.
        showCreate={false}
      />
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
    // width/height applied inline so they scale with viewport; the dev-flag
    // fallback (40pt) is preserved by the conditional below.
    height: DevFlags.SeedLegacyData ? 40 : undefined,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    // marginTop/marginBottom applied inline (viewport-driven)
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
