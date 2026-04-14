import React, { useEffect, useMemo, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import {
  useNavigation,
  useRoute,
} from '@react-navigation/native'
import type { NavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { deleteWallet } from 'utils/wallet'
import { isVaultFastVault } from 'services/migrateToVault'
import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'
import WalletCard from 'components/WalletCard'
import MigrationToolbar from 'components/migration/MigrationToolbar'

import type { MainStackParams } from 'navigation/MainNavigator'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

export default function WalletList(): React.ReactElement {
  // This screen is registered in both MainNavigator (as 'WalletList')
  // and MigrationNavigator (as 'WalletsFound'). The available routes
  // differ at runtime — use separate typed navigations per mode.
  const mainNav = useNavigation<NavigationProp<MainStackParams>>()
  const migrationNav = useNavigation<StackNavigationProp<MigrationStackParams>>()
  const route = useRoute<{ key: string; name: string; params?: { wallets?: MigrationWallet[]; results?: MigrationResult[] } }>()

  // When wallets are passed via params we're in the migration flow
  const migrationWallets = route.params?.wallets
  const migrationResults = route.params?.results
  const isMigrationMode = migrationWallets != null

  // Main-mode wallet source
  const { wallets: localWallets, onWalletDisconnected } = useWalletNav()

  const [fastVaultMap, setFastVaultMap] = useState<
    Record<string, boolean>
  >({})

  // In migration mode, track which wallets have been migrated via results
  const migratedNames = useMemo(
    () =>
      new Set(
        (migrationResults ?? [])
          .filter((r) => r.success)
          .map((r) => r.wallet.name)
      ),
    [migrationResults]
  )

  // Main-mode: check fast-vault status for each wallet
  useEffect(() => {
    if (isMigrationMode || localWallets.length === 0) return
    let cancelled = false
    Promise.allSettled(
      localWallets.map((w) =>
        isVaultFastVault(w.name).then((isFast) => ({
          name: w.name,
          isFast,
        }))
      )
    ).then((settled) => {
      if (cancelled) return
      const map: Record<string, boolean> = {}
      for (const entry of settled) {
        if (entry.status === 'fulfilled') {
          map[entry.value.name] = entry.value.isFast
        }
      }
      setFastVaultMap((prev) => {
        const keys = Object.keys(map)
        if (
          keys.length === Object.keys(prev).length &&
          keys.every((k) => prev[k] === map[k])
        )
          return prev
        return map
      })
    })
    return (): void => {
      cancelled = true
    }
  }, [isMigrationMode, localWallets])

  // --- Main-mode handlers ---

  const handleMainPress = async (
    wallet: LocalWallet
  ): Promise<void> => {
    await settings.set({ walletName: wallet.name })

    if (fastVaultMap[wallet.name]) {
      mainNav.navigate('Migration', {
        screen: 'MigrationSuccess',
        params: { migratedWalletName: wallet.name },
      })
    } else {
      mainNav.navigate('Migration', {
        screen: 'VaultEmail',
        params: {
          walletName: wallet.name,
          wallets: [
            {
              name: wallet.name,
              address: wallet.address,
              ledger: wallet.ledger,
            },
          ],
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

  // --- Migration-mode handlers ---

  const handleMigrationPress = (wallet: MigrationWallet): void => {
    const migrated =
      migratedNames.has(wallet.name) || wallet.ledger
    if (migrated) {
      migrationNav.navigate('MigrationSuccess', {
        migratedWalletName: wallet.name,
        wallets: migrationWallets,
        results: migrationResults,
      })
    } else {
      migrationNav.navigate('VaultEmail', {
        walletName: wallet.name,
        wallets: migrationWallets,
        mode: 'migrate',
      })
    }
  }

  // --- Render ---

  return (
    <SafeAreaView style={styles.container}>
      <MigrationToolbar
        onBack={() => mainNav.goBack()}
        testID="wallets-back"
      />

      <Text fontType="brockmann-medium" style={styles.title}>
        Your wallets
      </Text>
      <Text fontType="brockmann" style={styles.subtitle}>
        {isMigrationMode
          ? 'Handle each one separately.'
          : `${localWallets.length} wallet${localWallets.length !== 1 ? 's' : ''} on this device`}
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isMigrationMode
          ? migrationWallets.map((wallet, index) => {
              const migrated =
                migratedNames.has(wallet.name) || wallet.ledger
              return (
                <WalletCard
                  key={wallet.name}
                  name={wallet.name}
                  address={wallet.address}
                  terraOnly={false}
                  isFastVault={migrated}
                  onPress={() => handleMigrationPress(wallet)}
                  testID={`wallet-card-${index}`}
                />
              )
            })
          : localWallets.map((wallet, index) => (
              <WalletCard
                key={wallet.name}
                name={wallet.name}
                address={wallet.address}
                terraOnly={wallet.terraOnly === true}
                isFastVault={fastVaultMap[wallet.name] === true}
                onPress={() => handleMainPress(wallet)}
                onExport={() => handleExport(wallet)}
                onDelete={() => handleDelete(wallet)}
                testID={`wallet-card-${index}`}
              />
            ))}
      </ScrollView>

      {!isMigrationMode && (
        <View style={styles.footer}>
          <Button
            title="Add Wallet"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={() => mainNav.navigate('AddWalletMenu')}
            containerStyle={styles.addButton}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  title: {
    color: MIGRATION.textPrimary,
    fontSize: 22,
    marginTop: 8,
  },
  subtitle: {
    color: MIGRATION.textTertiary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: MIGRATION.cardGap,
    paddingBottom: 16,
  },
  footer: {
    paddingVertical: 16,
  },
  addButton: {
    width: '100%',
    height: MIGRATION.ctaHeight,
    borderRadius: MIGRATION.radiusPill,
  },
})
