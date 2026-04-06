import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  wallets: LocalWallet[]
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: () => {},
  onWalletDisconnected: () => {},
  wallets: [],
})

export const useWalletCreated = () => useContext(WalletNavContext).onWalletCreated
export const useWalletDisconnected = () => useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = () => useContext(WalletNavContext)
