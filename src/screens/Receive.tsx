import React, { useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import Text from 'components/Text'
import Button from 'components/Button'
import { COLORS } from 'consts/theme'

type RouteParams = { Receive: { address: string } }

export default function Receive() {
  const { t } = useTranslation()
  const { params } = useRoute<RouteProp<RouteParams, 'Receive'>>()
  const { address } = params

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(address)
  }, [address])

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Receive</Text>

      <View style={styles.qrContainer}>
        <QRCode value={address} size={200} backgroundColor={COLORS.surface} color={COLORS.textPrimary} />
      </View>

      <Text style={styles.address} selectable>
        {address}
      </Text>

      <Button title="Copy Address" onPress={copyAddress} containerStyle={styles.copyButton} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 32 },
  qrContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  address: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  copyButton: { width: '100%' },
})
