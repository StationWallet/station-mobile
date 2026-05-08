import React, { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import type { NavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueries } from 'react-query'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { deleteWallet } from 'utils/wallet'
import {
  getVaultKind,
  hasBrokenDerivation,
} from 'services/migrateToVault'
import { MIGRATION } from 'consts/migration'
import { DevFlags } from 'config/env'
import Text from 'components/Text'
import Button from 'components/Button'
import WalletCard from 'components/WalletCard'
import DerivationWarningBanner from 'components/DerivationWarningBanner'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import AddWalletSheet from 'components/AddWalletSheet'

import type { MainStackParams } from 'navigation/MainNavigator'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

export default function WalletList(): React.ReactElement {
  // This screen is registered in both MainNavigator (as 'WalletList')
  // and MigrationNavigator (as 'WalletsFound'). We detect which
  // navigator we're in via route.name to use the correct navigation.
  const mainNav = useNavigation<NavigationProp<MainStackParams>>()
  const migrationNav =
    useNavigation<StackNavigationProp<MigrationStackParams>>()
  const route = useRoute()
  const inMigrationNav = route.name === 'WalletsFound'

  const {
    wallets,
    onWalletDisconnected,
    refreshWallets,
    startCreateVault,
    startSeedRecoveryInput,
    startImportVault,
    startImportPrivateKey,
  } = useWalletNav()

  // Refresh the list of wallets on focus so returning from the
  // migration flow (e.g. "Migrate another wallet" on MigrationSuccess)
  // reflects the just-migrated wallet without needing a remount.
  useFocusEffect(
    useCallback(() => {
      refreshWallets()
    }, [refreshWallets])
  )

  // Per-wallet vault-kind, cached by wallet name. react-query keeps data
  // across renders, so navigating back to this screen doesn't blink the
  // loading overlay — existing cards stay up while stale data revalidates
  // in the background.
  const vaultKindQueries = useQueries(
    wallets.map((w) => ({
      queryKey: ['vaultKind', w.name],
      queryFn: (): Promise<'none' | 'fast' | 'multi-share'> =>
        getVaultKind(w.name),
      staleTime: 30_000,
    }))
  )
  const vaultKindMap: Record<
    string,
    'none' | 'fast' | 'multi-share'
  > = {}
  wallets.forEach((w, i) => {
    const result = vaultKindQueries[i]
    if (result?.data !== undefined) vaultKindMap[w.name] = result.data
  })
  // Only show the blocking overlay on the very first resolve, not on
  // revalidations triggered by focus. isLoading is react-query's
  // "never-resolved-yet" signal; isFetching would fire on every refetch.
  const loading =
    wallets.length > 0 && vaultKindQueries.some((q) => q.isLoading)

  // Screen-level banner: show when ANY stored vault matches the pre-#93
  // broken derivation shape (DKLS, ECDSA-only, all-zeros chain code).
  // Per-card discrimination isn't possible — already-migrated legacy AD
  // entries land in the same on-disk shape as broken seed-recover / fresh
  // vaults, with no remaining provenance signal — so we only surface this
  // at the screen level with self-identification copy.
  const brokenDerivationQueries = useQueries(
    wallets.map((w) => ({
      queryKey: ['brokenDerivation', w.name],
      queryFn: (): Promise<boolean> => hasBrokenDerivation(w.name),
      staleTime: 30_000,
    }))
  )
  const hasAnyBrokenVault = brokenDerivationQueries.some(
    (q) => q.data === true
  )

  const [addSheetVisible, setAddSheetVisible] = useState(false)

  const walletSummaries = wallets.map((w) => ({
    name: w.name,
    address: w.address,
    ledger: w.ledger,
  }))

  const handlePress = async (wallet: LocalWallet): Promise<void> => {
    await settings.set({ walletName: wallet.name })

    if (
      vaultKindMap[wallet.name] === 'fast' ||
      vaultKindMap[wallet.name] === 'multi-share'
    ) {
      if (inMigrationNav) {
        migrationNav.navigate('MigrationSuccess', {
          migratedWalletName: wallet.name,
        })
      } else {
        mainNav.navigate('Migration', {
          screen: 'MigrationSuccess',
          params: { migratedWalletName: wallet.name },
        })
      }
    } else if (inMigrationNav) {
      migrationNav.navigate('VaultEmail', {
        walletName: wallet.name,
        wallets: walletSummaries,
        mode: 'migrate',
      })
    } else {
      mainNav.navigate('Migration', {
        screen: 'VaultEmail',
        params: {
          walletName: wallet.name,
          wallets: walletSummaries,
          mode: 'migrate',
        },
      })
    }
  }

  const handleExport = (wallet: LocalWallet): void => {
    mainNav.navigate('ExportPrivateKey', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const handleDelete = async (wallet: LocalWallet): Promise<void> => {
    await deleteWallet({ walletName: wallet.name })
    await onWalletDisconnected()
  }

  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <Text
            fontType="brockmann-medium"
            style={styles.loadingText}
          >
            Loading wallets...
          </Text>
        </View>
      )}
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar
          onBack={() => {
            if (inMigrationNav) {
              migrationNav.goBack()
            } else {
              mainNav.navigate('Migration', {
                screen: 'MigrationHome',
                params: {},
              })
            }
          }}
          testID="wallets-back"
        />
      </View>

      <Text fontType="brockmann-medium" style={styles.title}>
        Your wallets
      </Text>
      <Text fontType="brockmann" style={styles.subtitle}>
        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} on
        this device
      </Text>

      {hasAnyBrokenVault && <DerivationWarningBanner />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wallets.map((wallet, index) => (
          <WalletCard
            key={wallet.name}
            name={wallet.name}
            address={wallet.address}
            terraOnly={wallet.terraOnly === true}
            vaultKind={vaultKindMap[wallet.name] ?? 'none'}
            onPress={() => handlePress(wallet)}
            onExport={() => handleExport(wallet)}
            onDelete={() => handleDelete(wallet)}
            testID={`wallet-card-${index}`}
          />
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Button
          title="Add Wallet"
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          onPress={() => setAddSheetVisible(true)}
          containerStyle={styles.addButton}
        />
        {DevFlags.StateReset && !inMigrationNav && (
          <Button
            testID="dev-reset-state"
            title="Reset State (dev)"
            theme="secondaryDark"
            titleFontType="brockmann-medium"
            onPress={() => {
              mainNav.navigate('StateReset')
            }}
            containerStyle={styles.addButton}
          />
        )}
      </View>
      <AddWalletSheet
        visible={addSheetVisible}
        onDismiss={() => setAddSheetVisible(false)}
        // When this screen renders inside MigrationNavigator (route name
        // `WalletsFound`), the wallet-nav helpers' setRootRoute('Migration')
        // is a no-op (we're already on Migration root) so the navigator
        // doesn't remount and `initialRouteName` is never re-read — sheet
        // taps would silently no-op. Push the right Migration screen
        // directly via the local stack nav in that case. From `Main` root
        // the helpers still work the way they always have.
        onCreate={
          inMigrationNav
            ? (): void =>
                migrationNav.navigate('VaultName', { mode: 'create' })
            : startCreateVault
        }
        onRecover={
          inMigrationNav
            ? (): void => migrationNav.navigate('RecoverSeed')
            : startSeedRecoveryInput
        }
        onImport={
          inMigrationNav
            ? (): void => migrationNav.navigate('ImportVault')
            : startImportVault
        }
        onImportPrivateKey={
          inMigrationNav
            ? (): void =>
                migrationNav.navigate('VaultName', {
                  mode: 'import-private-key',
                })
            : startImportPrivateKey
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MIGRATION.bg,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: MIGRATION.textTertiary,
    fontSize: 15,
  },
  title: {
    color: MIGRATION.textPrimary,
    fontSize: 22,
    marginTop: 24,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  subtitle: {
    color: MIGRATION.textTertiary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: MIGRATION.cardGap,
    paddingBottom: 16,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  addButton: {
    width: '100%',
    height: MIGRATION.ctaHeight,
    borderRadius: MIGRATION.radiusPill,
  },
})
