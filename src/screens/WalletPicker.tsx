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
      {item.ledger && (
        <View style={styles.ledgerBadge}>
          <Text style={styles.ledgerText}>Ledger</Text>
        </View>
      )}
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
  container: { flex: 1, backgroundColor: '#02122B', padding: 20 },
  title: { color: '#F0F4FC', fontSize: 24, fontWeight: '700', marginTop: 48 },
  subtitle: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  walletRow: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletInfo: { flex: 1 },
  walletName: { color: '#F0F4FC', fontSize: 16, fontWeight: '600' },
  walletAddress: { color: '#8295AE', fontSize: 13, marginTop: 4 },
  ledgerBadge: {
    backgroundColor: '#11284A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  ledgerText: { color: '#8295AE', fontSize: 11, fontWeight: '600' },
  footer: { paddingTop: 16 },
  addButton: { width: '100%' },
})
