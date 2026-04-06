import React from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { NavigationProp, useNavigation } from '@react-navigation/native'

import { useWalletNav } from 'navigation'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import { COLORS } from 'consts/theme'
import Text from 'components/Text'
import Button from 'components/Button'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletPicker() {
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const { wallets } = useWalletNav()

  const selectWallet = async (wallet: LocalWallet) => {
    await settings.set({ walletName: wallet.name })
    navigation.navigate('WalletHome', {
      wallet: { name: wallet.name, address: wallet.address },
    })
  }

  const renderItem = ({ item }: { item: LocalWallet }) => (
    <TouchableOpacity style={styles.walletRow} onPress={() => selectWallet(item)}>
      <View style={styles.walletInfo}>
        <Text style={styles.walletName}>{item.name}</Text>
        <Text style={styles.walletAddress}>
          {UTIL.truncate(item.address, [10, 6])}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
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
    </View>
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
  walletInfo: { flex: 1 },
  walletName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  walletAddress: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  footer: { paddingTop: 16 },
  addButton: { width: '100%' },
})
