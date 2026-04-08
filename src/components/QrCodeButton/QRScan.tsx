import React, { ReactElement, useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native'
import { CameraView } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Text from '../Text'
import Icon from '../Icon'
import { COLOR } from 'consts'

type QrScanType = {
  onRead: (props: { data: string }) => void
  dataParser?: (props: { data: string }) => string
  onlyIfScan?: (props: { data: string }) => string
  closeModal: () => void
}

const QRScan = ({
  closeModal,
  onRead,
  onlyIfScan,
  dataParser,
}: QrScanType): ReactElement => {
  const insets = useSafeAreaInsets()
  const [scanned, setScanned] = useState(false)

  const handleBarCodeScanned = ({ data }: { data: string }): void => {
    if (scanned) return
    setScanned(true)

    const parsedData = (dataParser ? dataParser({ data }) : data) || ''

    if (onlyIfScan) {
      const errorMessage = onlyIfScan({ data: parsedData })
      if (errorMessage) {
        // Reset after delay so user can try again
        setTimeout(() => setScanned(false), 2500)
      } else {
        onRead({ data: parsedData })
        closeModal()
      }
    } else {
      onRead({ data: parsedData })
      closeModal()
    }
  }

  return (
    <View style={style.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          style={style.backContainer}
          onPress={closeModal}
        >
          <Icon name={'close'} color={COLOR.white} size={28} />
        </TouchableOpacity>
      </View>
      <View style={style.titleContainer}>
        <Text fontType="medium" style={style.titleText}>
          {'Scan QR code'}
        </Text>
      </View>
    </View>
  )
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backContainer: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 100,
    width: '100%',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#fff',
  },
})

export default QRScan
