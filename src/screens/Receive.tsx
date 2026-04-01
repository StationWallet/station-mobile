import React, { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import Text from 'components/Text'
import Button from 'components/Button'

type RouteParams = { Receive: { address: string } }

export default function Receive() {
  const { t } = useTranslation()
  const { params } = useRoute<RouteProp<RouteParams, 'Receive'>>()
  const { address } = params

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(address)
  }, [address])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receive</Text>

      <View style={styles.qrContainer}>
        <QRCode value={address} size={200} backgroundColor="#061B3A" color="#F0F4FC" />
      </View>

      <Text style={styles.address} selectable>
        {address}
      </Text>

      <Button title="Copy Address" onPress={copyAddress} containerStyle={styles.copyButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02122B',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginBottom: 32 },
  qrContainer: {
    backgroundColor: '#061B3A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  address: {
    color: '#8295AE',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  copyButton: { width: '100%' },
})
