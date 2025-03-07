import { useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { StackNavigationProp } from '@react-navigation/stack'

import AppStore from 'stores/AppStore'
import { RootStackParams } from 'types'

export const useLoading = ({
  navigation,
}: {
  navigation: StackNavigationProp<
    RootStackParams,
    keyof RootStackParams
  >
}): {
  showLoading: ({ txhash, title }: { txhash?: string, title?: string }) => void
  hideLoading: () => Promise<void>
} => {
  const setShowLoading = useSetAtom(AppStore.showLoading)
  const [loadingTxHash, setLoadingTxHash] = useAtom(
    AppStore.loadingTxHash
  )
  const [, setLoadingTitle] = useAtom(
    AppStore.loadingTitle
  )

  const showLoading = ({ txhash, title }: { txhash?: string, title?: string  }): void => {
    setShowLoading(true)
    setLoadingTxHash(txhash || '')
    setLoadingTitle(title || '')
  }
  const hideLoading = async (): Promise<void> => {
    setLoadingTxHash('')
    setLoadingTitle('')
    return await new Promise((resolve) => {
      setTimeout(() => {
        setShowLoading(false)
        resolve()
      }, 300)
    })
  }

  useEffect(() => {
    let unsubscribe: any
    if (loadingTxHash) {
      unsubscribe = navigation.addListener('beforeRemove', (e) =>
        e.preventDefault()
      )
    }

    return (): void => {
      unsubscribe?.()
    }
  }, [loadingTxHash])

  return {
    showLoading,
    hideLoading,
  }
}
