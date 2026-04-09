import React, { useCallback, useState, useEffect, useMemo } from 'react'
import {
  Alert,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { LCDClient } from '@terra-money/terra.js'
import { useQuery } from 'react-query'
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native'

import { SafeAreaView } from 'react-native-safe-area-context'
import { useConfig, useIsClassic } from 'lib/contexts/ConfigContext'
import { deleteWallet } from 'utils/wallet'
import { getAuthDataValue } from 'utils/authData'
import { settings } from 'utils/storage'
import { UTIL } from 'consts'
import { COLORS } from 'consts/theme'
import Text from 'components/Text'
import Button from 'components/Button'
import Loading from 'components/Loading'
import VaultieComingSoonCard from 'components/VaultieComingSoonCard'
import { useWalletNav } from 'navigation/hooks'
import { isVaultFastVault } from 'services/migrateToVault'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function WalletHome() {
  const { chain } = useConfig()
  const isClassic = useIsClassic()
  const { chainID, lcd: URL } = chain.current
  const lcd = useMemo(
    () => new LCDClient({ chainID, URL, isClassic }),
    [chainID, URL, isClassic]
  )
  const navigation = useNavigation<NavigationProp<MainStackParams>>()
  const route = useRoute<RouteProp<MainStackParams, 'WalletHome'>>()
  const { wallets, onWalletDisconnected } = useWalletNav()

  const wallet = route.params?.wallet

  const [isLedger, setIsLedger] = useState(true)
  const [isFastVault, setIsFastVault] = useState<boolean | null>(null)

  useEffect(() => {
    if (!wallet) return
    Promise.all([
      getAuthDataValue(wallet.name),
      settings.get(),
      isVaultFastVault(wallet.name),
    ]).then(([data, saved, fastVault]) => {
      setIsLedger(data?.ledger === true)
      setIsFastVault(fastVault)
      if (saved.walletName !== wallet.name) {
        settings.set({ walletName: wallet.name })
      }
    })
  }, [wallet?.name])

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
    if (!wallet) return
    await Clipboard.setStringAsync(wallet.address)
  }, [wallet?.address])

  const handleRemove = useCallback(() => {
    if (!wallet) return
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
  }, [wallet?.name, onWalletDisconnected])

  if (!wallet) return <Loading />

  const truncated = UTIL.truncate(wallet.address, [10, 6])
  const hasMultipleWallets = wallets.length > 1

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView
      testID="wallet-home-scroll"
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
      }
    >
      <VaultieComingSoonCard />
      <View style={styles.walletNameRow}>
        <Text style={styles.walletName}>{wallet.name}</Text>
        {isFastVault === false && (
          <View style={styles.legacyBadge}>
            <Text style={styles.legacyBadgeText}>Legacy</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={copyAddress}>
        <Text style={styles.address}>{truncated}</Text>
      </TouchableOpacity>
      {isFastVault === false && (
        <TouchableOpacity
          testID="upgrade-to-fast-vault"
          style={styles.upgradeButton}
          onPress={() =>
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
        >
          <Text style={styles.upgradeButtonText}>Upgrade to Fast Vault</Text>
        </TouchableOpacity>
      )}

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
        <TouchableOpacity
          style={styles.managementRow}
          onPress={() => navigation.navigate('WalletPicker')}
        >
          <Text style={styles.managementText}>
            {hasMultipleWallets ? 'Switch Wallet' : 'All Wallets'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.managementRow}
          onPress={() => navigation.navigate('AddWalletMenu')}
        >
          <Text style={styles.managementText}>Add Wallet</Text>
        </TouchableOpacity>
        {!isLedger && (
          <TouchableOpacity
            testID="export-key-button"
            style={styles.managementRow}
            onPress={() => navigation.navigate('ExportPrivateKey', { wallet })}
          >
            <Text style={styles.managementText}>
              {isFastVault ? 'Export Vault Share' : 'Export Private Key'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.managementRow} onPress={handleRemove}>
          <Text style={styles.removeText}>Remove Wallet</Text>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity
            testID="dev-verify-vault"
            style={styles.managementRow}
            onPress={() => navigation.navigate('VerifyVault')}
          >
            <Text style={styles.managementText}>Verify Vault (dev)</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, alignItems: 'center' },
  walletNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  walletName: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600' },
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.4)',
  },
  upgradeButtonText: {
    color: '#FFB340',
    fontSize: 13,
    fontWeight: '600',
  },
  address: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 24 },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 32 },
  actionButton: { flex: 1 },
  management: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  managementRow: { paddingVertical: 14, alignItems: 'center' },
  managementText: { color: COLORS.textSecondary, fontSize: 15 },
  removeText: { color: COLORS.error, fontSize: 15 },
})
