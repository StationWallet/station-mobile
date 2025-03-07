import WalletConnect from '@walletconnect/client'
import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'


const initialWalletConnectors: Record<string, WalletConnect> = {}
const walletConnectors = atom<Record<string, WalletConnect>>(initialWalletConnectors)

const walletConnectRecoverComplete = atom<boolean>(false)
const getWalletConnector = (params: { handshakeTopic: string }) => {
  return selectAtom(
      walletConnectors,
      (connectors) => connectors[params.handshakeTopic]
  )
}

const isListenConfirmRemove = atom<boolean>(false)

export default {
  walletConnectors,
  walletConnectRecoverComplete,
  getWalletConnector,
  isListenConfirmRemove,
}
