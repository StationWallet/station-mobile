import React, { useEffect, useState } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { NavigationProp, useNavigation } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useWalletNav } from 'navigation/hooks'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import { COLORS } from 'consts/theme'
import Text from 'components/Text'
import Button from 'components/Button'
import { isVaultFastVault } from 'services/migrateToVault'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletPicker() {
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const { wallets } = useWalletNav()
  const [fastVaultMap, setFastVaultMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (wallets.length === 0) return
    Promise.all(
      wallets.map((w) =>
        isVaultFastVault(w.name).then((isFast) => ({ name: w.name, isFast }))
      )
    ).then((results) => {
      const map: Record<string, boolean> = {}
      results.forEach(({ name, isFast }) => {
        map[name] = isFast
      })
      setFastVaultMap(map)
    })
  }, [wallets])

  const selectWallet = async (wallet: LocalWallet) => {
    await settings.set({ walletName: wallet.name })
    navigation.navigate('WalletHome', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const upgradeWallet = (wallet: LocalWallet) => {
    navigation.navigate('Migration', {
      screen: 'VaultEmail',
      params: {
        walletName: wallet.name,
        walletIndex: 0,
        totalWallets: 1,
        wallets: [{ name: wallet.name, address: wallet.address, ledger: false }],
        results: [],
      },
    })
  }

  const renderItem = ({ item }: { item: LocalWallet }) => {
    const isLegacy = fastVaultMap[item.name] === false

    return (
      <TouchableOpacity style={styles.walletRow} onPress={() => selectWallet(item)}>
        <View style={styles.walletTopRow}>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>{item.name}</Text>
            <Text style={styles.walletAddress}>
              {UTIL.truncate(item.address, [10, 6])}
            </Text>
          </View>
          {isLegacy && (
            <View style={styles.legacyBadge}>
              <Text style={styles.legacyBadgeText}>Legacy</Text>
            </View>
          )}
        </View>
        {isLegacy && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => upgradeWallet(item)}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Fast Vault</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Select Wallet</Text>
      <Text style={styles.subtitle}>
        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} on this device
      </Text>

      <FlatList
        data={wallets}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <Button
          title="Add Wallet"
          onPress={() => navigation.navigate('AddWalletMenu')}
          containerStyle={styles.addButton}
          theme="sapphire"
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 48 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 24 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  walletRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletTopRow: { flexDirection: 'row', alignItems: 'center' },
  walletInfo: { flex: 1 },
  walletName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  walletAddress: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  legacyBadge: {
    backgroundColor: 'rgba(255, 179, 64, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  legacyBadgeText: {
    color: '#FFB340',
    fontSize: 11,
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: 'rgba(255, 179, 64, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.4)',
  },
  upgradeButtonText: {
    color: '#FFB340',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: { paddingTop: 16 },
  addButton: { width: '100%' },
})
