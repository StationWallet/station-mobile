import React, { ReactElement } from 'react'
import { Modal, View } from 'react-native'
import { useAtom, useAtomValue } from 'jotai'
import ModalStore from 'stores/ModalStore'

const AppModal = (): ReactElement => {
  const [isVisible, setIsVisible] = useAtom(
    ModalStore.isVisible
  )
  const children = useAtomValue(ModalStore.children)

  return (
    <Modal
      visible={isVisible}
      onRequestClose={(): void => {
        setIsVisible(false)
      }}
      transparent
    >
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  )
}

export default AppModal
