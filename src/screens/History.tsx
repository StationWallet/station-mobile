import React, { useCallback, useState } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native'
import { useQuery } from 'react-query'
import { RouteProp, useRoute } from '@react-navigation/native'

import useLCD from 'hooks/useLCD'
import { UTIL } from 'consts'
import Text from 'components/Text'
import Loading from 'components/Loading'

type RouteParams = { History: { address: string } }

const PAGE_SIZE = 20

export default function History() {
  const { params } = useRoute<RouteProp<RouteParams, 'History'>>()
  const { address } = params
  const lcd = useLCD()
  const [offset, setOffset] = useState(0)

  const { data, isLoading, refetch, isRefetching } = useQuery(
    ['tx-history', address, offset],
    async () => {
      const result = await lcd.tx.txsByEvents(
        `message.sender='${address}'`,
        {
          order_by: 'ORDER_BY_DESC',
          'pagination.limit': String(PAGE_SIZE),
          'pagination.offset': String(offset),
        }
      )
      return result
    },
    { keepPreviousData: true }
  )

  const openExplorer = useCallback((hash: string) => {
    Linking.openURL(`https://chainsco.pe/terra2/tx/${hash}`)
  }, [])

  const getMsgType = (tx: any): string => {
    try {
      const msgs = tx.body?.messages || tx.tx?.body?.messages || []
      if (msgs.length === 0) return 'Unknown'
      const type = msgs[0]['@type'] || ''
      return type.split('.').pop()?.replace('Msg', '') || 'Unknown'
    } catch {
      return 'Unknown'
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const hash = item.txhash || ''
    const success = !item.code || item.code === 0
    const timestamp = item.timestamp || ''
    const msgType = getMsgType(item)

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

  const txResponses = data?.tx_responses || []
  const hasMore = txResponses.length === PAGE_SIZE

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      {isLoading ? (
        <Loading />
      ) : txResponses.length === 0 ? (
        <Text style={styles.empty}>No transactions yet</Text>
      ) : (
        <FlatList
          data={txResponses}
          keyExtractor={(item: any) => item.txhash}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => setOffset((o) => o + PAGE_SIZE)}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B', padding: 16 },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginBottom: 16 },
  empty: { color: '#8295AE', fontSize: 16, textAlign: 'center', marginTop: 48 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  msgType: { color: '#F0F4FC', fontSize: 14, fontWeight: '600' },
  date: { color: '#8295AE', fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  badgeSuccess: { backgroundColor: '#18D2C3' },
  badgeFail: { backgroundColor: '#FF5C5C' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  hash: { color: '#8295AE', fontSize: 12 },
  loadMore: { alignItems: 'center', padding: 16 },
  loadMoreText: { color: '#0B4EFF', fontSize: 14 },
})
