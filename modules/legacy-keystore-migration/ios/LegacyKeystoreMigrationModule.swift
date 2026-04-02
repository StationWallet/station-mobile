import ExpoModulesCore
import CommonCrypto
import Security

public final class LegacyKeystoreMigrationModule: Module {
  private let legacyService = "_secure_storage_service"
  private let aesKeyAccount = "key"

  public func definition() -> ModuleDefinition {
    Name("LegacyKeystoreMigration")

    AsyncFunction("readLegacy") { (key: String) -> String? in
      guard let encryptedData = self.readKeychainRaw(account: key) else {
        return nil
      }

      // Try AES decryption (normal path — data encrypted by old Keystore.m)
      if let aesKeyString = self.readKeychain(account: self.aesKeyAccount) {
        if let decrypted = self.aesDecrypt(data: encryptedData, keyString: aesKeyString) {
          return decrypted
        }
      }

      // Fallback: try reading raw data as plaintext UTF-8.
      // The old Keystore.m readKeychain had this same fallback for data
      // written before the AES encryption layer was added.
      if let plaintext = String(data: encryptedData, encoding: .utf8) {
        return plaintext
      }

      return nil
    }

    AsyncFunction("removeLegacy") { (key: String) -> Bool in
      return self.deleteKeychain(account: key)
    }

    AsyncFunction("seedLegacyTestData") { (key: String, value: String) -> Bool in
      // Generate or retrieve AES key
      let aesKeyString: String
      if let existingKey = self.readKeychain(account: self.aesKeyAccount) {
        aesKeyString = existingKey
      } else {
        var randomBytes = [UInt8](repeating: 0, count: 24)
        let status = SecRandomCopyBytes(kSecRandomDefault, 24, &randomBytes)
        guard status == errSecSuccess else { return false }
        aesKeyString = Data(randomBytes).base64EncodedString()
        guard self.writeKeychainRaw(
          account: self.aesKeyAccount,
          data: aesKeyString.data(using: .utf8)!
        ) else { return false }
      }

      guard let valueData = value.data(using: .utf8) else { return false }
      guard let encrypted = self.aesEncrypt(data: valueData, keyString: aesKeyString) else {
        return false
      }
      return self.writeKeychainRaw(account: key, data: encrypted)
    }

    AsyncFunction("clearAllLegacyData") { () -> Bool in
      let _ = self.deleteKeychain(account: self.aesKeyAccount)
      let _ = self.deleteKeychain(account: "AD")
      return true
    }
  }

  // MARK: - Keychain helpers

  private func searchQuery(account: String) -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: legacyService,
      kSecAttrAccount as String: account.data(using: .utf8)!,
    ]
  }

  /// Read raw bytes from keychain (for encrypted wallet data).
  private func readKeychainRaw(account: String) -> Data? {
    var query = searchQuery(account: account)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = kCFBooleanTrue

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return nil }
    return data
  }

  /// Read a UTF-8 string from keychain (for the AES key).
  private func readKeychain(account: String) -> String? {
    guard let data = readKeychainRaw(account: account) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// Write raw bytes to keychain.
  private func writeKeychainRaw(account: String, data: Data) -> Bool {
    let _ = deleteKeychain(account: account)

    var query = searchQuery(account: account)
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked

    let status = SecItemAdd(query as CFDictionary, nil)
    return status == errSecSuccess
  }

  /// Delete a keychain item.
  private func deleteKeychain(account: String) -> Bool {
    let query = searchQuery(account: account)
    let status = SecItemDelete(query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }

  // MARK: - AES-256-CBC (matching old Keystore.m / NSData+AES.m)

  /// Decrypt data using AES-256-CBC with zero IV and PKCS7 padding.
  private func aesDecrypt(data: Data, keyString: String) -> String? {
    let keyBytes = aesKeyBytes(from: keyString)
    let iv = [UInt8](repeating: 0, count: kCCBlockSizeAES128)

    let bufferSize = data.count + kCCBlockSizeAES128
    var buffer = [UInt8](repeating: 0, count: bufferSize)
    var numBytesDecrypted: size_t = 0

    let status = keyBytes.withUnsafeBufferPointer { keyPtr in
      data.withUnsafeBytes { dataPtr in
        CCCrypt(
          CCOperation(kCCDecrypt),
          CCAlgorithm(kCCAlgorithmAES128),
          CCOptions(kCCOptionPKCS7Padding),
          keyPtr.baseAddress, kCCKeySizeAES256,
          iv,
          dataPtr.baseAddress, data.count,
          &buffer, bufferSize,
          &numBytesDecrypted
        )
      }
    }

    guard status == CCCryptorStatus(kCCSuccess) else { return nil }
    return String(bytes: buffer.prefix(numBytesDecrypted), encoding: .utf8)
  }

  /// Encrypt data using AES-256-CBC with zero IV and PKCS7 padding.
  private func aesEncrypt(data: Data, keyString: String) -> Data? {
    let keyBytes = aesKeyBytes(from: keyString)
    let iv = [UInt8](repeating: 0, count: kCCBlockSizeAES128)

    let bufferSize = data.count + kCCBlockSizeAES128
    var buffer = [UInt8](repeating: 0, count: bufferSize)
    var numBytesEncrypted: size_t = 0

    let status = keyBytes.withUnsafeBufferPointer { keyPtr in
      data.withUnsafeBytes { dataPtr in
        CCCrypt(
          CCOperation(kCCEncrypt),
          CCAlgorithm(kCCAlgorithmAES128),
          CCOptions(kCCOptionPKCS7Padding),
          keyPtr.baseAddress, kCCKeySizeAES256,
          iv,
          dataPtr.baseAddress, data.count,
          &buffer, bufferSize,
          &numBytesEncrypted
        )
      }
    }

    guard status == CCCryptorStatus(kCCSuccess) else { return nil }
    return Data(buffer.prefix(numBytesEncrypted))
  }

  /// Convert key string to 32-byte buffer matching old Obj-C getCString behavior.
  private func aesKeyBytes(from keyString: String) -> [UInt8] {
    var keyBytes = [UInt8](repeating: 0, count: kCCKeySizeAES256 + 1)
    let utf8 = Array(keyString.utf8)
    let copyLen = min(utf8.count, kCCKeySizeAES256)
    for i in 0..<copyLen {
      keyBytes[i] = utf8[i]
    }
    return Array(keyBytes.prefix(kCCKeySizeAES256))
  }
}
