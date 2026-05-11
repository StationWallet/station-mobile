import * as SecureStore from 'expo-secure-store'

import type { SpaLegacyWalletEntry } from './spaLegacyDecrypt'

const CACHE_KEY = 'spa-legacy-wallets'
const CACHE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

export async function getCachedSpaWallets(): Promise<
  SpaLegacyWalletEntry[]
> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY, CACHE_OPTS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function setCachedSpaWallets(
  wallets: SpaLegacyWalletEntry[]
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      CACHE_KEY,
      JSON.stringify(wallets),
      CACHE_OPTS
    )
  } catch {
    // Cache write failure is non-fatal — the next mount will retry.
  }
}

export async function clearCachedSpaWallets(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY, CACHE_OPTS)
  } catch {
    // Ignore.
  }
}
