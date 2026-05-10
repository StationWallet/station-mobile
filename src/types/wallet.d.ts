interface LocalWallet {
  name: string
  address: string
  ledger: boolean
  path?: number
  terraOnly?: boolean
  /**
   * When true, this wallet was discovered in the legacy Terra Station SPA's
   * WebView localStorage. It is not yet stored in our native authData, and the
   * `spaEncrypted` blob below is required to recover it (user must enter
   * their legacy Station password).
   */
  spaLegacy?: boolean
  /**
   * Present only when `spaLegacy === true`. The base64+hex blob produced by
   * the SPA's encrypt() function — `hex(salt) + hex(iv) + base64(ciphertext)`.
   * Decrypted via `services/spaLegacyDecrypt#decryptLegacyWallet` using the
   * user's legacy Station password.
   */
  spaEncrypted?: string
}
