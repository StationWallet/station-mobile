const store = new Map<string, string>()

export function __reset(): void {
  store.clear()
}

const LegacyKeystore = {
  seedLegacyTestData: async (key: string, value: string): Promise<boolean> => {
    store.set(key, value)
    return true
  },
  readLegacy: async (key: string): Promise<string | null> => {
    return store.get(key) ?? null
  },
  removeLegacy: async (key: string): Promise<void> => {
    store.delete(key)
  },
  clearAllLegacyData: async (): Promise<void> => {
    store.clear()
  },
}

export default LegacyKeystore
