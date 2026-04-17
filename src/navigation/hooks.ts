import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletDisconnected: () => void
  goToMigration?: () => void
  goToAuth: () => void
  startCreateVault: () => void
  startSeedRecovery: () => void
  startImportVault: () => void
  wallets: LocalWallet[]
  refreshWallets: () => Promise<void>
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletDisconnected: (): void => {},
  goToMigration: undefined,
  goToAuth: (): void => {},
  startCreateVault: (): void => {},
  startSeedRecovery: (): void => {},
  startImportVault: (): void => {},
  wallets: [],
  refreshWallets: async (): Promise<void> => {},
})

export const useWalletDisconnected = (): (() => void) =>
  useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = (): WalletNav =>
  useContext(WalletNavContext)
