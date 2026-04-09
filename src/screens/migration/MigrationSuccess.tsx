import React, { useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import Button from 'components/Button'
import GlassButton from 'components/migration/GlassButton'
import OGStatusCard from 'components/migration/OGStatusCard'
import { MIGRATION } from 'consts/migration'
import preferences, { PreferencesEnum } from 'nativeModules/preferences'
import { useMigrationComplete } from 'navigation/MigrationContext'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

const DevVerifyVault = __DEV__
  ? require('components/DevVerifyVault').default
  : null

export default function MigrationSuccess() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationSuccess'>>()
  const navigation = useNavigation<StackNavigationProp<MigrationStackParams, 'MigrationSuccess'>>()
  const onMigrationComplete = useMigrationComplete()

  const wallets = params.wallets
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
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <GlassButton onPress={onMigrationComplete} testID="success-back">
          <Text style={styles.chevron}>{'\u2039'}</Text>
        </GlassButton>
        <GlassButton onPress={() => {}} testID="success-cube">
          <View />
        </GlassButton>
      </View>

      {/* Title */}
      <Text fontType="brockmann-medium" style={styles.title}>
        You are aboard, Station OG!
      </Text>

      {/* Subtitle */}
      <Text fontType="brockmann" style={styles.subtitle}>
        {'Your vault is secured. No single key.\nNo single point of failure.'}
      </Text>

      {/* OG Status Card */}
      <View style={styles.cardContainer}>
        <OGStatusCard />
      </View>

      {/* Orbit text */}
      <Text fontType="medium" style={styles.orbitText}>
        [ Entering orbit soon... ]
      </Text>

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        {/* Share OG status button */}
        <Button
          title="Share your OG status"
          theme="ctaBlue"
          onPress={() => {}}
          containerStyle={styles.shareButton}
          titleFontType="brockmann-medium"
          testID="share-og-status"
        />

        {/* Migrate another wallet link */}
        {hasUnmigrated && (
          <TouchableOpacity
            onPress={() => navigation.navigate('WalletsFound', { wallets })}
            testID="migrate-another-wallet"
          >
            <Text fontType="brockmann-medium" style={styles.migrateAnother}>
              Migrate another wallet
            </Text>
          </TouchableOpacity>
        )}

        {/* Continue to wallets */}
        <TouchableOpacity
          onPress={onMigrationComplete}
          style={styles.continueLink}
          testID="continue-button"
        >
          <Text fontType="brockmann-medium" style={styles.continueLinkText}>
            Continue to wallets
          </Text>
        </TouchableOpacity>
      </View>

      {__DEV__ && DevVerifyVault && <DevVerifyVault />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chevron: {
    fontSize: 24,
    color: MIGRATION.textPrimary,
    marginTop: -2,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    paddingLeft: 17,
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
    color: '#4879fd',
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
