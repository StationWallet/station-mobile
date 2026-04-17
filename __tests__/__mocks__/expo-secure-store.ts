const store = new Map<string, string>()

export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY =
  'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY'

export type SecureStoreOptions = {
  keychainService?: string
  keychainAccessible?: string
}

function compositeKey(key: string, opts?: SecureStoreOptions): string {
  return `${opts?.keychainService ?? '_'}::${key}`
}

export async function setItemAsync(
  key: string,
  value: string,
  opts?: SecureStoreOptions,
): Promise<void> {
  store.set(compositeKey(key, opts), value)
}

export async function getItemAsync(
  key: string,
  opts?: SecureStoreOptions,
): Promise<string | null> {
  return store.get(compositeKey(key, opts)) ?? null
}

export async function deleteItemAsync(
  key: string,
  opts?: SecureStoreOptions,
): Promise<void> {
  store.delete(compositeKey(key, opts))
}

export function __reset(): void {
  store.clear()
}
