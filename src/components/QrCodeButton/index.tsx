import React, {
  ReactElement,
  ReactNode,
  useEffect,
  useState,
} from 'react'
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { COLOR } from 'consts'

import {
  checkCameraPermission,
  openPermissionSettings,
  requestPermission,
} from 'utils/permission'

import Text from '../Text'
import Icon from '../Icon'

import { Alert } from 'react-native'

import QRScan from './QRScan'

export type QrCodeButtonProps = {
  /**
   * @param {string} data if dataParser then return parsed data
   */
  onRead: (props: { data: string }) => void
  /**
   * @param {string} data data from scanner
   * @return {string} parsed data
   */
  dataParser?: (props: { data: string }) => string
  /**
   * If dataParser then check data from dataParser
   * @return {string} return error message
   */
  onlyIfScan?: (props: { data: string }) => string
  children?: ReactNode
  defaultVisible?: boolean
}

const QrCodeButton = ({
  onRead,
  onlyIfScan,
  children,
  dataParser,
  defaultVisible = false,
}: QrCodeButtonProps): ReactElement => {
  const [isVisibleModal, setIsVisibleModal] = useState(defaultVisible)

  const onPress = async (): Promise<void> => {
    const requestResult = await requestPermission()
    if (requestResult === 'granted') {
      const permission = await checkCameraPermission()
      if (permission === 'granted') {
        setIsVisibleModal(true)
        return
      }
    }

    Alert.alert(
      'Camera not authorized',
      'Move to settings to enable camera permissions?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ok', onPress: () => openPermissionSettings() },
      ]
    )
  }

  const { addListener } = useNavigation()
  useEffect(() => {
    const unsubscribe = addListener('blur', (): void => {
      setIsVisibleModal(false)
    })
    return unsubscribe
  }, [])

  return (
    <>
      <TouchableOpacity onPress={onPress}>
        {children || (
          <View style={styles.container}>
            <Icon name={'qr-code-2'} color={COLOR.primary._02} />
            <Text
              style={{
                color: COLOR.primary._02,
                fontSize: 10,
                marginLeft: 5,
              }}
              fontType="medium"
            >
              QR CODE
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <Modal
        onRequestClose={(): void => {
          setIsVisibleModal(false)
        }}
        transparent
        visible={isVisibleModal}
      >
        <QRScan
          onRead={onRead}
          onlyIfScan={onlyIfScan}
          closeModal={(): void => {
            setIsVisibleModal(false)
          }}
          dataParser={dataParser}
        />
      </Modal>
    </>
  )
}

export default QrCodeButton

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLOR.primary._02,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
})
