import React, { useCallback } from 'react'
import {
  Alert,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useQuery } from 'react-query'
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native'

import useLCD from 'hooks/useLCD'
import { deleteWallet } from 'utils/wallet'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'
import Loading from 'components/Loading'
import { useWalletNav } from 'navigation'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletHome() {
  const lcd = useLCD()
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const route = useRoute<RouteProp<MainStackParams, 'WalletHome'>>()
  const { wallets, onWalletDisconnected } = useWalletNav()

  const wallet = route.params?.wallet
  if (!wallet) return <Loading />

  // Save last-used wallet
  React.useEffect(() => {
    settings.set({ walletName: wallet.name })
  }, [wallet.name])

  const {
    data: balance,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery(
    ['balance', wallet.address],
    async () => {
      const [coins] = await lcd.bank.balance(wallet.address)
      const luna = coins.get('uluna')
      return luna ? UTIL.demicrofy(luna.amount as any) : '0'
    },
  )

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(wallet.address)
  }, [wallet.address])

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove Wallet',
      'This will remove the wallet from this device. Make sure you have your seed phrase backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteWallet({ walletName: wallet.name })
            await onWalletDisconnected()
          },
        },
      ]
    )
  }, [wallet.name, onWalletDisconnected])

  const truncated = UTIL.truncate(wallet.address, [10, 6])
  const hasMultipleWallets = wallets.length > 1

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
      }
    >
      <Text style={styles.walletName}>{wallet.name}</Text>
      <TouchableOpacity onPress={copyAddress}>
        <Text style={styles.address}>{truncated}</Text>
      </TouchableOpacity>

      <View style={styles.balanceCard}>
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <Text style={styles.balanceLabel}>LUNA</Text>
            <Text style={styles.balanceAmount}>{balance || '0'}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title="Receive"
          onPress={() => navigation.navigate('Receive', { address: wallet.address })}
          containerStyle={styles.actionButton}
          theme="sapphire"
        />
        <Button
          title="History"
          onPress={() => navigation.navigate('History', { address: wallet.address })}
          containerStyle={styles.actionButton}
          theme="transparent"
        />
      </View>

      <View style={styles.management}>
        {hasMultipleWallets && (
          <TouchableOpacity
            style={styles.managementRow}
            onPress={() => navigation.navigate('WalletPicker')}
          >
            <Text style={styles.managementText}>Switch Wallet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.managementRow}
          onPress={() => navigation.navigate('AddWalletMenu')}
        >
          <Text style={styles.managementText}>Add Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.managementRow} onPress={handleRemove}>
          <Text style={styles.removeText}>Remove Wallet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  walletName: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginTop: 24 },
  address: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  balanceCard: {
    backgroundColor: '#061B3A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: { color: '#8295AE', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#F0F4FC', fontSize: 32, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 32 },
  actionButton: { flex: 1 },
  management: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#11284A',
    paddingTop: 16,
  },
  managementRow: { paddingVertical: 14, alignItems: 'center' },
  managementText: { color: '#8295AE', fontSize: 15 },
  removeText: { color: '#FF5C5C', fontSize: 15 },
})
