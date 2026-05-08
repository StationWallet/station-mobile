import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletDisconnected: () => void
  goToMigration?: () => void
  goToAuth: () => void
  goHome: () => void
  startCreateVault: () => void
  /**
   * Routes to RecoverSeed, which captures the user's seed into
   * RecoverWalletStore then advances into the vault creation flow in
   * recover-seed mode.
   */
  startSeedRecoveryInput: () => void
  startImportVault: () => void
  wallets: LocalWallet[]
  refreshWallets: () => Promise<void>
}

export const WalletNavContext = createContext<WalletNav>({
  onWalletDisconnected: (): void => {},
  goToMigration: undefined,
  goToAuth: (): void => {},
  goHome: (): void => {},
  startCreateVault: (): void => {},
  startSeedRecoveryInput: (): void => {},
  startImportVault: (): void => {},
  wallets: [],
  refreshWallets: async (): Promise<void> => {},
})

export const useWalletDisconnected = (): (() => void) =>
  useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = (): WalletNav =>
  useContext(WalletNavContext)
