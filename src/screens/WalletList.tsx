import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NavigationProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { deleteWallet } from 'utils/wallet'
import { isVaultFastVault } from 'services/migrateToVault'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'
import WalletCard from 'components/WalletCard'
import MigrationToolbar from 'components/migration/MigrationToolbar'

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

  const { wallets, onWalletDisconnected } = useWalletNav()

  const [fastVaultMap, setFastVaultMap] = useState<
    Record<string, boolean>
  >({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (wallets.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    Promise.allSettled(
      wallets.map((w) =>
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
      setLoading(false)
    })
    return (): void => {
      cancelled = true
    }
  }, [wallets])

  const walletSummaries = wallets.map((w) => ({
    name: w.name,
    address: w.address,
    ledger: w.ledger,
  }))

  const handlePress = async (wallet: LocalWallet): Promise<void> => {
    await settings.set({ walletName: wallet.name })

    if (fastVaultMap[wallet.name]) {
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
            isFastVault={fastVaultMap[wallet.name] === true}
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
          onPress={() => {
            if (inMigrationNav) {
              migrationNav.navigate('VaultSetup')
            } else {
              mainNav.navigate('Migration', {
                screen: 'VaultSetup',
                params: undefined,
              } as { screen: 'VaultSetup'; params: undefined })
            }
          }}
          containerStyle={styles.addButton}
        />
      </View>
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
