import type { StackNavigationProp } from '@react-navigation/stack'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

type MigrationNav = StackNavigationProp<MigrationStackParams, 'KeygenProgress' | 'VerifyEmail'>

/**
 * After completing a wallet's migration (verify email success),
 * always navigate to MigrationSuccess. The user can tap
 * "Migrate another wallet" to return to WalletsFound for the next one.
 */
export function advanceToNextWallet(
  navigation: MigrationNav,
  wallets: MigrationWallet[],
  walletIndex: number,
  totalWallets: number,
  results: MigrationResult[],
  _email: string | undefined,
  newResult: MigrationResult,
): void {
  const updatedResults = [...results, newResult]

  navigation.navigate('MigrationSuccess', {
    results: updatedResults,
    wallets,
    migratedWalletName: newResult.wallet.name,
  })
}
