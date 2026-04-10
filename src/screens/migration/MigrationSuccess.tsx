import React, { useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Svg, { Path, Rect } from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import OGStatusCard from 'components/migration/OGStatusCard'
import { MIGRATION } from 'consts/migration'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import { useMigrationComplete } from 'navigation/MigrationContext'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

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

const DevVerifyVault = __DEV__
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
  const results = params.results ?? []
  const hasUnmigrated = wallets != null && wallets.length > 0

  // Write the flag eagerly when this screen mounts (not just on tap)
  // so it persists even if the app is killed before the user taps Continue.
  // vaultsUpgraded means "user has been through the migration flow",
  // not "all wallets are upgraded" — set it regardless of partial failure.
  useEffect(() => {
    preferences.setBool(PreferencesEnum.vaultsUpgraded, true)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <MigrationToolbar
        onBack={onMigrationComplete}
        testID="success-back"
      />

      <Text fontType="brockmann-medium" style={styles.title}>
        You are aboard, Station OG!
      </Text>

      <Text fontType="brockmann" style={styles.subtitle}>
        {
          'Your vault is secured. No single key.\nNo single point of failure.'
        }
      </Text>

      <View style={styles.cardContainer}>
        <OGStatusCard />
      </View>

      <Text fontType="medium" style={styles.orbitText}>
        [ Entering orbit soon... ]
      </Text>

      <View style={styles.bottomActions}>
        <Button
          title={
            <View style={styles.shareRow}>
              <CopyIcon />
              <Text
                fontType="brockmann-medium"
                style={styles.shareText}
              >
                Share your OG status
              </Text>
              <ChevronRight />
            </View>
          }
          theme="ctaBlue"
          onPress={() => {}}
          containerStyle={styles.shareButton}
          titleFontType="brockmann-medium"
          testID="share-og-status"
        />

        {hasUnmigrated && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('WalletsFound', {
                wallets,
                results,
              })
            }
            testID="migrate-another-wallet"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.migrateAnother}
            >
              Migrate another wallet
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onMigrationComplete}
          style={styles.continueLink}
          testID="continue-button"
        >
          <Text
            fontType="brockmann-medium"
            style={styles.continueLinkText}
          >
            Continue to wallets
          </Text>
        </TouchableOpacity>
      </View>

      {__DEV__ && DevVerifyVault && (
        <DevVerifyVault
          importedVaultName={
            params.importedVaultName ?? params.migratedWalletName
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    paddingLeft: MIGRATION.screenPadding,
    lineHeight: 24,
    marginTop: 50,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    paddingLeft: 17,
    marginTop: 8,
    lineHeight: 20,
  },
  cardContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  orbitText: {
    fontSize: 14,
    color: MIGRATION.textLink,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  shareButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
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
    fontSize: 14,
    color: MIGRATION.textTertiary,
    textDecorationLine: 'underline',
  },
  continueLink: {
    paddingVertical: 4,
  },
  continueLinkText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
})
