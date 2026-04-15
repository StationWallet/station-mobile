import React, { useEffect } from 'react'
import {
  View,
  NativeModules,
  PixelRatio,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Ellipse,
} from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { MIGRATION } from 'consts/migration'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import { useMigrationComplete } from 'navigation/MigrationContext'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

// Skip Rive only under Detox — its native runtime keeps the iOS main
// run loop busy, blocking Detox idle detection.
const isDetox = NativeModules.DetoxManager != null

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded Rive component with no TS definitions
let Rive: any = null
let orbAnimSource: number | null = null

if (!isDetox) {
  try {
    Rive = require('rive-react-native').default
    orbAnimSource = require('assets/rive/vulti_orb_loading.riv')
  } catch {
    // rive-react-native not available — will render static fallback
  }
}

function CopyIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect
        x={9}
        y={9}
        width={13}
        height={13}
        rx={2}
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
      />
      <Path
        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ChevronRight(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function CheckmarkIcon(): React.ReactElement {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={8} r={8} fill={MIGRATION.successGreen} />
      <Path
        d="M4.5 8.2l2.2 2.2 4.8-4.8"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

import { DevFlags } from '../../config/env'

const DevVerifyVault = DevFlags.VerifyVault
  ? require('components/DevVerifyVault').default
  : null

export default function MigrationSuccess(): React.ReactElement {
  const { params } =
    useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const navigation =
    useNavigation<
      StackNavigationProp<MigrationStackParams, 'MigrationSuccess'>
    >()
  const onMigrationComplete = useMigrationComplete()

  const wallets = params.wallets
  const hasUnmigrated = wallets != null && wallets.length > 0

  const handleBack = (): void => {
    // If nested inside MainNavigator (tapped a migrated wallet from WalletList),
    // pop the Migration screen to return to WalletList.
    const parent = navigation.getParent()
    if (parent?.canGoBack()) {
      onMigrationComplete()
      parent.goBack()
    } else {
      // Root MigrationNavigator — complete migration and go to Main/WalletList
      onMigrationComplete()
    }
  }

  // Write the flag eagerly when this screen mounts (not just on tap)
  // so it persists even if the app is killed before the user taps Continue.
  // vaultsUpgraded means "user has been through the migration flow",
  // not "all wallets are upgraded" — set it regardless of partial failure.
  useEffect(() => {
    preferences.setBool(PreferencesEnum.vaultsUpgraded, true)
  }, [])

  return (
    <View style={styles.screen}>
    <SafeAreaView style={styles.container}>
      <MigrationToolbar onBack={handleBack} testID="success-back" />

      <Text fontType="brockmann-bold" style={styles.title}>
        You are aboard, Station OG!
      </Text>

      <Text fontType="brockmann-medium" style={styles.subtitle}>
        {
          'Your vault is secured. No single key.\nNo single point of failure.'
        }
      </Text>

      <View style={styles.badge}>
        <CheckmarkIcon />
        <Text fontType="brockmann-medium" style={styles.badgeText}>
          Eligible for $VULT Airdrop
        </Text>
      </View>

      <View style={styles.orbitContainer}>
        {/* Blue radial glow behind the orb animation */}
        <Svg width={360} height={360} style={styles.glowSvg}>
          <Defs>
            <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#0B4EFF" stopOpacity={0.3} />
              <Stop offset="35%" stopColor="#0B4EFF" stopOpacity={0.12} />
              <Stop offset="100%" stopColor="#02122b" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={180} cy={180} rx={180} ry={180} fill="url(#orbGlow)" />
        </Svg>
        {Rive && orbAnimSource ? (
          <Rive
            source={orbAnimSource}
            style={styles.orbAnimation}
            autoplay
            layoutScaleFactor={PixelRatio.get()}
          />
        ) : (
          <View style={styles.orbAnimation} />
        )}
      </View>

      <Text fontType="gotham" style={styles.orbitText}>
        {'[ Entering orbit soon... ]'}
      </Text>

      <View style={styles.bottomActions}>
        <Button
          title="Share your OG status"
          theme="ctaBlue"
          onPress={() => {}}
          containerStyle={styles.shareButton}
          titleFontType="brockmann-bold"
          titleStyle={styles.shareButtonText}
          testID="share-og-status"
        />

        {hasUnmigrated ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('WalletsFound')}
            testID="migrate-another-wallet"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.migrateAnother}
            >
              Migrate another wallet
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            testID="continue-to-wallets"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.migrateAnother}
            >
              Continue to wallets
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {DevVerifyVault && (
        <DevVerifyVault
          importedVaultName={
            params.importedVaultName ?? params.migratedWalletName
          }
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  title: {
    fontSize: 24,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.36,
    lineHeight: 28,
    marginTop: 12,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: `${MIGRATION.successGreen}14`,
    borderColor: `${MIGRATION.successGreen}26`,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 21,
  },
  badgeText: {
    fontSize: 12,
    color: MIGRATION.textPrimary,
    lineHeight: 16,
  },
  orbitContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  glowSvg: {
    position: 'absolute',
  },
  orbAnimation: {
    width: 360,
    height: 360,
  },
  orbitText: {
    fontSize: 14,
    color: MIGRATION.textLink,
    textAlign: 'center',
    marginBottom: 32,
  },
  bottomActions: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  shareButton: {
    width: '100%',
    height: MIGRATION.ctaHeight,
    borderRadius: MIGRATION.radiusPill,
  },
  shareButtonText: {
    fontSize: 14,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareText: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
    lineHeight: 18,
  },
  migrateAnother: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
    textDecorationLine: 'underline',
    lineHeight: 18,
  },
})
