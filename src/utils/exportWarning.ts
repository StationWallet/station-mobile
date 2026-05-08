import type { getVaultKind } from 'services/migrateToVault'

type VaultKind = Awaited<ReturnType<typeof getVaultKind>>

/**
 * Pick the warning copy shown above the export form.
 *
 * Three real branches once the vault kind has loaded:
 *   - 'fast'        → recoverable-by-itself: anyone with the share + password
 *                     can sign and drain. Treat it like a private key.
 *   - 'multi-share' → a single encrypted share cannot access the vault alone.
 *   - 'none'        → legacy AD-only wallet: this really is a raw private key.
 *
 * While the kind is still loading (`null`) we default to the optimistic
 * share-safe copy — the warning card flips once `getVaultKind` resolves.
 */
export function getExportWarning(
  vaultKind: VaultKind | null
): string {
  if (vaultKind === 'fast') {
    return 'Anyone with this vault share and your password can sign transactions and drain your funds. Treat it like a private key.'
  }
  if (vaultKind === 'none') {
    return 'Anyone with this key can access your funds. Never share it.'
  }
  // 'multi-share' or still loading (null) — optimistic safe-to-share default
  return 'A single encrypted vault share cannot access a Secure Vault by itself. Keep it private and share it only with people you trust.'
}
