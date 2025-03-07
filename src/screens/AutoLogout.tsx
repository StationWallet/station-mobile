import React, { ReactElement, useEffect } from 'react'
import { View } from 'react-native'
import { useSetAtom } from 'jotai'
import AutoLogoutStore from 'stores/AutoLogoutStore'
import { useAuth } from 'lib'
import { settings } from 'utils/storage'

const AutoLogout = (): ReactElement => {
  const { signOut } = useAuth()
  const setIsFromAutoLogout = useSetAtom(
    AutoLogoutStore.isFromAutoLogout
  )
  useEffect(() => {
    setIsFromAutoLogout(true)
    settings.delete(['walletName'])
    signOut()
  }, [])
  return <View />
}

export default AutoLogout
