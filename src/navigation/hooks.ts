import { createContext, useContext } from 'react'

export interface WalletNav {
  onWalletDisconnected: () => void
  goToMigration?: () => void
  goToAuth: () => void
  goHome: () => void
  startCreateVault: () => void
  /**
   * Seed already written to RecoverWalletStore. Routes straight to VaultName
   * in recover-seed mode (continues keygen).
   */
  startSeedRecovery: () => void
  /**
   * User still needs to enter a seed. Routes to RecoverSeed, which captures
   * the seed into RecoverWalletStore then calls startSeedRecovery.
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
  startSeedRecovery: (): void => {},
  startSeedRecoveryInput: (): void => {},
  startImportVault: (): void => {},
  wallets: [],
  refreshWallets: async (): Promise<void> => {},
})

export const useWalletDisconnected = (): (() => void) =>
  useContext(WalletNavContext).onWalletDisconnected
export const useWalletNav = (): WalletNav =>
  useContext(WalletNavContext)
