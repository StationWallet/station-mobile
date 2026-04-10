import type { StackNavigationProp } from '@react-navigation/stack'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationResult } from 'services/migrateToVault'

type MigrationNav = StackNavigationProp<MigrationStackParams, 'KeygenProgress' | 'VerifyEmail'>

/**
 * After completing a wallet's migration (verify email success),
 * always navigate to MigrationSuccess. The user can tap
 * "Migrate another wallet" to return to WalletsFound for the next one.
 */
export function advanceToNextWallet(
  navigation: MigrationNav,
  opts: {
    wallets: MigrationResult['wallet'][]
    results: MigrationResult[]
    newResult: MigrationResult
  },
): void {
  const updatedResults = [...opts.results, opts.newResult]

  navigation.navigate('MigrationSuccess', {
    results: updatedResults,
    wallets: opts.wallets,
    migratedWalletName: opts.newResult.wallet.name,
  })
}
