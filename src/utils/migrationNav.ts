import type { StackNavigationProp } from '@react-navigation/stack'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import type { MigrationWallet, MigrationResult } from 'services/migrateToVault'

type MigrationNav = StackNavigationProp<MigrationStackParams, 'KeygenProgress' | 'VerifyEmail'>

/**
 * Advances the migration flow to the next standard wallet, auto-skipping
 * ledger wallets. If all wallets are processed, navigates to MigrationSuccess.
 */
export function advanceToNextWallet(
  navigation: MigrationNav,
  wallets: MigrationWallet[],
  walletIndex: number,
  totalWallets: number,
  results: MigrationResult[],
  email: string | undefined,
  newResult: MigrationResult,
): void {
  const updatedResults = [...results, newResult]
  let nextIdx = walletIndex + 1

  while (nextIdx < wallets.length && wallets[nextIdx].ledger) {
    updatedResults.push({ wallet: wallets[nextIdx], success: true })
    nextIdx++
  }

  if (nextIdx >= wallets.length) {
    navigation.navigate('MigrationSuccess', { results: updatedResults })
    return
  }

  const nextWallet = wallets[nextIdx]
  navigation.navigate('VaultEmail', {
    walletName: nextWallet.name,
    mode: 'migrate',
    walletIndex: nextIdx,
    totalWallets,
    wallets,
    results: updatedResults,
    email,
  })
}
