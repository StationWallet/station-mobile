import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletDisconnected: () => void
  goToMigration?: () => void
  startCreateVault: () => void
  startSeedRecovery: () => void
  wallets: LocalWallet[]
  refreshWallets: () => Promise<void>
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletDisconnected: (): void => {},
  goToMigration: undefined,
  startCreateVault: (): void => {},
  startSeedRecovery: (): void => {},
  wallets: [],
  refreshWallets: async (): Promise<void> => {},
})

export const useWalletDisconnected = (): (() => void) =>
  useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = (): WalletNav =>
  useContext(WalletNavContext)
