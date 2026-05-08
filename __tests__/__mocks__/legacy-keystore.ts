// Two stores: one for the modern EncryptedSharedPreferences / iOS Keychain
// path, one for the deprecated Android StorageCipher18 RSA+AES path. Both
// `seed*` functions write into their respective store; `readLegacy` reads
// modern first then falls back to V1 (mirroring the native module).
const modernStore = new Map<string, string>()
const v1Store = new Map<string, string>()

export function __reset(): void {
  modernStore.clear()
  v1Store.clear()
}

const LegacyKeystore = {
  seedLegacyTestData: async (
    key: string,
    value: string
  ): Promise<boolean> => {
    modernStore.set(key, value)
    return true
  },
  seedLegacyTestDataStorageCipher18: async (
    key: string,
    value: string
  ): Promise<boolean> => {
    v1Store.set(key, value)
    return true
  },
  readLegacy: async (key: string): Promise<string | null> => {
    return modernStore.get(key) ?? v1Store.get(key) ?? null
  },
  removeLegacy: async (key: string): Promise<boolean> => {
    modernStore.delete(key)
    v1Store.delete(key)
    return true
  },
  clearAllLegacyData: async (): Promise<boolean> => {
    modernStore.clear()
    v1Store.clear()
    return true
  },
  cleanupStorageCipher18: async (): Promise<boolean> => {
    // In tests, cleanup is a no-op — stores are already in-memory and get
    // reset by __reset() between tests.
    return true
  },
}

export default LegacyKeystore
