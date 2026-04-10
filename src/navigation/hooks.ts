import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletCreated: () => void
  onWalletDisconnected: () => void
  goToMigration?: () => void
  wallets: LocalWallet[]
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletCreated: (): void => {},
  onWalletDisconnected: (): void => {},
  goToMigration: undefined,
  wallets: [],
})

export const useWalletCreated = (): (() => void) =>
  useContext(WalletNavContext).onWalletCreated
export const useWalletDisconnected = (): (() => void) =>
  useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = (): WalletNav =>
  useContext(WalletNavContext)
