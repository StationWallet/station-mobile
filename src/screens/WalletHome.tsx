import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { NavigationProp, useNavigation } from '@react-navigation/native'

import useLCD from 'hooks/useLCD'
import { getWallets } from 'utils/wallet'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Button from 'components/Button'
import Loading from 'components/Loading'

type MainStackParams = {
  WalletHome: undefined
  Receive: { address: string }
  History: { address: string }
}

export default function WalletHome(): React.ReactElement {
  const { t } = useTranslation()
  const lcd = useLCD()
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const [wallet, setWallet] = useState<{ name: string; address: string } | null>(null)

  useEffect(() => {
    getWallets().then((wallets) => {
      if (wallets.length > 0) {
        setWallet({ name: wallets[0].name, address: wallets[0].address })
      }
    })
  }, [])

  const {
    data: balance,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery(
    ['balance', wallet?.address],
    async () => {
      if (!wallet) return '0'
      const [coins] = await lcd.bank.balance(wallet.address)
      const luna = coins.get('uluna')
      return luna ? UTIL.demicrofy(luna.amount as any) : '0'
    },
    { enabled: !!wallet }
  )

  const copyAddress = useCallback(async () => {
    if (wallet) {
      await Clipboard.setStringAsync(wallet.address)
    }
  }, [wallet])

  if (!wallet) return <Loading />

  const truncated = UTIL.truncate(wallet.address, [10, 6])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#fff"
        />
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
          title={t('Wallet:Receive')}
          onPress={() =>
            navigation.navigate('Receive', { address: wallet.address })
          }
          containerStyle={styles.actionButton}
          theme="sapphire"
        />
        <Button
          title={t('Wallet:History')}
          onPress={() =>
            navigation.navigate('History', { address: wallet.address })
          }
          containerStyle={styles.actionButton}
          theme="transparent"
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  walletName: {
    color: '#F0F4FC',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
  },
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
  actions: { flexDirection: 'row', gap: 16, width: '100%' },
  actionButton: { flex: 1 },
})
