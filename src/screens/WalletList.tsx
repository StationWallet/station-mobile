import React, { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import {
  NavigationProp,
  useNavigation,
} from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { deleteWallet } from 'utils/wallet'
import { isVaultFastVault } from 'services/migrateToVault'
import { MIGRATION } from 'consts/migration'
import Text from 'components/Text'
import Button from 'components/Button'
import WalletCard from 'components/WalletCard'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletList(): React.ReactElement {
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const { wallets, onWalletDisconnected } = useWalletNav()
  const [fastVaultMap, setFastVaultMap] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    if (wallets.length === 0) return
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
    })
    return (): void => {
      cancelled = true
    }
  }, [wallets])

  const handlePress = async (wallet: LocalWallet): Promise<void> => {
    await settings.set({ walletName: wallet.name })

    if (fastVaultMap[wallet.name]) {
      navigation.navigate('Migration', {
        screen: 'MigrationSuccess',
        params: { migratedWalletName: wallet.name },
      })
    } else {
      navigation.navigate('Migration', {
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
    navigation.navigate('ExportPrivateKey', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const handleDelete = async (wallet: LocalWallet): Promise<void> => {
    await deleteWallet({ walletName: wallet.name })
    await onWalletDisconnected()
  }

  return (
    <SafeAreaView style={styles.container}>
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

      <View style={styles.footer}>
        <Button
          title="Add Wallet"
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          onPress={() => navigation.navigate('AddWalletMenu')}
          containerStyle={styles.addButton}
        />
      </View>
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
    marginTop: 24,
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
