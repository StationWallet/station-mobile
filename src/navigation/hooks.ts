import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  goToMigration?: () => void
  wallets: LocalWallet[]
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: () => {},
  onWalletDisconnected: () => {},
  goToMigration: undefined,
  wallets: [],
})

export const useWalletCreated = () => useContext(WalletNavContext).onWalletCreated
export const useWalletDisconnected = () => useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = () => useContext(WalletNavContext)
