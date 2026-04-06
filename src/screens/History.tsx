import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useConfig } from 'lib/contexts/ConfigContext'
import { UTIL } from 'consts'
import { COLORS, EXPLORER_URL } from 'consts/theme'
import Text from 'components/Text'
import Loading from 'components/Loading'

type RouteParams = { History: { address: string } }

interface TxResponse {
  height: string
  txhash: string
  code?: number
  timestamp: string
  tx: {
    '@type': string
    body: { messages: any[]; memo: string }
    auth_info: any
    signatures: string[]
  }
}

interface CosmosTxSearchResult {
  tx_responses: TxResponse[]
  total: string
  pagination: { next_key: string | null; total: string } | null
}

const PAGE_SIZE = 20

export default function History() {
  const { params } = useRoute<RouteProp<RouteParams, 'History'>>()
  const { address } = params
  const { chain } = useConfig()
  const lcdUrl = chain.current.lcd

  const [txs, setTxs] = useState<TxResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sentOffset, setSentOffset] = useState(0)
  const [receivedOffset, setReceivedOffset] = useState(0)
  const [hasMoreSent, setHasMoreSent] = useState(false)
  const [hasMoreReceived, setHasMoreReceived] = useState(false)
  const seenHashes = useRef(new Set<string>())

  const fetchByQuery = useCallback(
    async (query: string, offset: number) => {
      // Single quotes must be %27 for Cosmos SDK — use fetch to avoid
      // axios re-encoding %27 back to literal quotes
      const encodedQuery = encodeURIComponent(query).replace(/'/g, '%27')
      const qs = `query=${encodedQuery}&order_by=ORDER_BY_DESC&pagination.limit=${PAGE_SIZE}&pagination.offset=${offset}`
      const url = `${lcdUrl}/cosmos/tx/v1beta1/txs?${qs}`

      // Public LCD nodes can return inconsistent results across load-balanced
      // backends, so retry once if the first attempt returns empty
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(url)
        const data: CosmosTxSearchResult = await res.json()
        if ((data.tx_responses?.length ?? 0) > 0 || attempt === 1) return data
      }
      return { tx_responses: [], total: '0', pagination: null } as CosmosTxSearchResult
    },
    [lcdUrl]
  )

  const fetchAll = useCallback(
    async (sOffset: number, rOffset: number) => {
      const [sent, received] = await Promise.all([
        fetchByQuery(`message.sender='${address}'`, sOffset),
        fetchByQuery(`coin_received.receiver='${address}'`, rOffset),
      ])

      const sentTxs = sent.tx_responses || []
      const receivedTxs = received.tx_responses || []

      const seen = new Set<string>()
      const merged = [...sentTxs, ...receivedTxs]
        .filter((tx) => {
          if (seen.has(tx.txhash)) return false
          seen.add(tx.txhash)
          return true
        })
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

      return {
        txs: merged,
        hasMoreSent: sentTxs.length === PAGE_SIZE,
        hasMoreReceived: receivedTxs.length === PAGE_SIZE,
      }
    },
    [fetchByQuery, address]
  )

  const resetFromResult = useCallback((result: { txs: TxResponse[]; hasMoreSent: boolean; hasMoreReceived: boolean }) => {
    seenHashes.current = new Set(result.txs.map((tx) => tx.txhash))
    setTxs(result.txs)
    setHasMoreSent(result.hasMoreSent)
    setHasMoreReceived(result.hasMoreReceived)
    setSentOffset(PAGE_SIZE)
    setReceivedOffset(PAGE_SIZE)
  }, [])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      resetFromResult(await fetchAll(0, 0))
    } catch {
      setTxs([])
    } finally {
      setLoading(false)
    }
  }, [fetchAll, resetFromResult])

  const loadMore = useCallback(async () => {
    if (!hasMoreSent && !hasMoreReceived) return
    try {
      const [sent, received] = await Promise.all([
        hasMoreSent
          ? fetchByQuery(`message.sender='${address}'`, sentOffset)
          : Promise.resolve(null),
        hasMoreReceived
          ? fetchByQuery(`coin_received.receiver='${address}'`, receivedOffset)
          : Promise.resolve(null),
      ])
      const sentTxs = sent?.tx_responses || []
      const receivedTxs = received?.tx_responses || []
      // New pages are older, so append without re-sorting the full list
      const unique = [...sentTxs, ...receivedTxs]
        .filter((tx) => {
          if (seenHashes.current.has(tx.txhash)) return false
          seenHashes.current.add(tx.txhash)
          return true
        })
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      setTxs((prev) => [...prev, ...unique])
      if (hasMoreSent) {
        setHasMoreSent(sentTxs.length === PAGE_SIZE)
        setSentOffset((o) => o + PAGE_SIZE)
      }
      if (hasMoreReceived) {
        setHasMoreReceived(receivedTxs.length === PAGE_SIZE)
        setReceivedOffset((o) => o + PAGE_SIZE)
      }
    } catch {
      setHasMoreSent(false)
      setHasMoreReceived(false)
    }
  }, [fetchByQuery, address, sentOffset, receivedOffset, hasMoreSent, hasMoreReceived])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      resetFromResult(await fetchAll(0, 0))
    } catch {
      /* keep existing list */
    } finally {
      setRefreshing(false)
    }
  }, [fetchAll, resetFromResult])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  const openExplorer = useCallback((hash: string) => {
    Linking.openURL(`${EXPLORER_URL}${hash}`)
  }, [])

  const getTxLabel = (tx: TxResponse): string => {
    try {
      const msgs = tx.tx?.body?.messages || []
      if (msgs.length === 0) return 'Unknown'
      const msg = msgs[0]
      const type: string = msg['@type'] || ''
      const baseType = type.split('.').pop()?.replace('Msg', '') || 'Unknown'

      if (baseType === 'Send') {
        if (msg.to_address === address) return 'Receive'
        if (msg.from_address === address) return 'Send'
      }

      return baseType
    } catch {
      return 'Unknown'
    }
  }

  const renderItem = ({ item }: { item: TxResponse }) => {
    const hash = item.txhash || ''
    const success = !item.code || item.code === 0
    const timestamp = item.timestamp || ''
    const msgType = getTxLabel(item)

    return (
      <TouchableOpacity style={styles.row} onPress={() => openExplorer(hash)}>
        <View style={styles.rowLeft}>
          <Text style={styles.msgType}>{msgType}</Text>
          <Text style={styles.date}>{timestamp}</Text>
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.badge, success ? styles.badgeSuccess : styles.badgeFail]}>
            <Text style={styles.badgeText}>{success ? 'OK' : 'FAIL'}</Text>
          </View>
          <Text style={styles.hash}>{UTIL.truncate(hash, [6, 4])}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const hasMore = hasMoreSent || hasMoreReceived

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>History</Text>
      {loading ? (
        <Loading />
      ) : txs.length === 0 ? (
        <Text style={styles.empty}>No transactions yet</Text>
      ) : (
        <FlatList
          data={txs}
          keyExtractor={(item) => item.txhash}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMore} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 16 },
  empty: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', marginTop: 48 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  msgType: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  date: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  badgeSuccess: { backgroundColor: COLORS.success },
  badgeFail: { backgroundColor: COLORS.error },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  hash: { color: COLORS.textSecondary, fontSize: 12 },
  loadMore: { alignItems: 'center', padding: 16 },
  loadMoreText: { color: COLORS.accent, fontSize: 14 },
})
