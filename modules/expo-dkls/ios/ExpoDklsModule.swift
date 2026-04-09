import ExpoModulesCore
import godkls
import goschnorr

public class ExpoDklsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoDkls")

    // Verify godkls framework is linked and callable
    Function("isAvailable") { () -> Bool in
      return true
    }

    // Create a keygen setup message
    // Returns base64-encoded setup message bytes
    AsyncFunction("createKeygenSetupMessage") { (threshold: Int, partyIds: [String]) -> String in
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }

      var byteArray: [UInt8] = []
      for id in partyIds {
        if let utf8 = id.data(using: .utf8) {
          byteArray.append(contentsOf: utf8)
          byteArray.append(0)
        }
      }
      if byteArray.last == 0 {
        byteArray.removeLast()
      }

      let err = byteArray.withUnsafeBufferPointer { bp in
        var ids = go_slice(
          ptr: UnsafePointer(bp.baseAddress),
          len: UInt(bp.count),
          cap: UInt(bp.count)
        )
        return dkls_keygen_setupmsg_new(UInt32(threshold), nil, &ids, &buf)
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Keygen setup failed (code: \(err.rawValue))")
      }

      let data = Data(bytes: buf.ptr, count: Int(buf.len))
      return data.base64EncodedString()
    }

    // Create a keygen session from setup message
    // Returns handle integer
    AsyncFunction("createKeygenSession") { (setupBase64: String, localPartyId: String) -> Int in
      guard let setupData = Data(base64Encoded: setupBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 setup message")
      }

      var handle = Handle(_0: 0)
      let setupBytes = [UInt8](setupData)
      let idBytes = [UInt8](localPartyId.utf8)

      let err = setupBytes.withUnsafeBufferPointer { setupBp in
        idBytes.withUnsafeBufferPointer { idBp in
          var setup = go_slice(ptr: UnsafePointer(setupBp.baseAddress), len: UInt(setupBp.count), cap: UInt(setupBp.count))
          var idSlice = go_slice(ptr: UnsafePointer(idBp.baseAddress), len: UInt(idBp.count), cap: UInt(idBp.count))
          return dkls_keygen_session_from_setup(&setup, &idSlice, &handle)
        }
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Session create failed (code: \(err.rawValue))")
      }

      return Int(handle._0)
    }

    // Get outbound message from session (base64 or null)
    AsyncFunction("getOutboundMessage") { (handleId: Int) -> String? in
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))
      let err = dkls_keygen_session_output_message(handle, &buf)

      // Debug logging - only log first few times to avoid spam
      if err != LIB_OK {
        print("[ExpoDkls] getOutboundMessage error code: \(err.rawValue) for handle \(handleId)")
      }

      if err != LIB_OK || buf.len == 0 { return nil }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Get receiver for an outbound message at given index
    AsyncFunction("getMessageReceiver") { (handleId: Int, messageBase64: String, index: Int) -> String? in
      guard let msgData = Data(base64Encoded: messageBase64) else { return nil }
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))

      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return dkls_keygen_session_message_receiver(handle, &msg, UInt32(index), &buf)
      }

      if err != LIB_OK || buf.len == 0 { return nil }
      return String(data: Data(bytes: buf.ptr, count: Int(buf.len)), encoding: .utf8)
    }

    // Feed inbound message to session. Returns true if session is finished.
    AsyncFunction("inputMessage") { (handleId: Int, messageBase64: String) -> Bool in
      guard let msgData = Data(base64Encoded: messageBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 message")
      }
      let handle = Handle(_0: Int32(handleId))
      var finished: Int32 = 0

      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return dkls_keygen_session_input_message(handle, &msg, &finished)
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Input message failed (code: \(err.rawValue))")
      }

      return finished != 0
    }

    // Finish keygen and get keyshare data
    AsyncFunction("finishKeygen") { (handleId: Int) -> [String: String] in
      let sessionHandle = Handle(_0: Int32(handleId))
      var keyshareHandle = Handle(_0: 0)

      let finishErr = dkls_keygen_session_finish(sessionHandle, &keyshareHandle)
      guard finishErr == LIB_OK else {
        throw Exception(name: "DklsError", description: "Keygen finish failed (code: \(finishErr.rawValue))")
      }

      // Keyshare bytes
      var ksBuf = tss_buffer()
      defer { tss_buffer_free(&ksBuf) }
      let ksErr = dkls_keyshare_to_bytes(keyshareHandle, &ksBuf)
      guard ksErr == LIB_OK else {
        throw Exception(name: "DklsError", description: "Keyshare serialize failed (code: \(ksErr.rawValue))")
      }
      let keyshareB64 = Data(bytes: ksBuf.ptr, count: Int(ksBuf.len)).base64EncodedString()

      // Public key
      var pkBuf = tss_buffer()
      defer { tss_buffer_free(&pkBuf) }
      let pkErr = dkls_keyshare_public_key(keyshareHandle, &pkBuf)
      guard pkErr == LIB_OK else {
        throw Exception(name: "DklsError", description: "Public key extract failed (code: \(pkErr.rawValue))")
      }
      let publicKeyHex = Data(bytes: pkBuf.ptr, count: Int(pkBuf.len)).map { String(format: "%02x", $0) }.joined()

      // Chain code
      var ccBuf = tss_buffer()
      defer { tss_buffer_free(&ccBuf) }
      let ccErr = dkls_keyshare_chaincode(keyshareHandle, &ccBuf)
      guard ccErr == LIB_OK else {
        throw Exception(name: "DklsError", description: "Chain code extract failed (code: \(ccErr.rawValue))")
      }
      let chainCodeHex = Data(bytes: ccBuf.ptr, count: Int(ccBuf.len)).map { String(format: "%02x", $0) }.joined()

      return [
        "keyshare": keyshareB64,
        "publicKey": publicKeyHex,
        "chainCode": chainCodeHex,
      ]
    }

    // === KEY IMPORT (Seed Phrase → DKLS MPC) ===

    // Create a DKLS key import session from a raw private key + chain code.
    // Returns { setupMessage: base64, sessionHandle: Int }
    // The setup message is sent to the server so it can call dkls_key_importer_new.
    // The session handle uses the same keygen message loop API.
    AsyncFunction("createDklsKeyImportSession") { (privateKeyHex: String, chainCodeHex: String, threshold: Int, partyIds: [String]) -> [String: Any] in
      guard let privKeyData = Data(hexString: privateKeyHex) else {
        throw Exception(name: "DklsError", description: "Invalid hex private key")
      }
      guard let chainCodeData = Data(hexString: chainCodeHex) else {
        throw Exception(name: "DklsError", description: "Invalid hex chain code")
      }

      var setupBuf = tss_buffer()
      defer { tss_buffer_free(&setupBuf) }
      var handle = Handle(_0: 0)

      // Party IDs as null-separated byte array
      var byteArray: [UInt8] = []
      for id in partyIds {
        if let utf8 = id.data(using: .utf8) {
          byteArray.append(contentsOf: utf8)
          byteArray.append(0)
        }
      }
      if byteArray.last == 0 { byteArray.removeLast() }

      let privBytes = [UInt8](privKeyData)
      let ccBytes = [UInt8](chainCodeData)

      let err = privBytes.withUnsafeBufferPointer { privBp in
        ccBytes.withUnsafeBufferPointer { ccBp in
          byteArray.withUnsafeBufferPointer { idsBp in
            var privSlice = go_slice(ptr: UnsafePointer(privBp.baseAddress), len: UInt(privBp.count), cap: UInt(privBp.count))
            var ccSlice = go_slice(ptr: UnsafePointer(ccBp.baseAddress), len: UInt(ccBp.count), cap: UInt(ccBp.count))
            var idsSlice = go_slice(ptr: UnsafePointer(idsBp.baseAddress), len: UInt(idsBp.count), cap: UInt(idsBp.count))
            return dkls_key_import_initiator_new(&privSlice, &ccSlice, UInt8(threshold), &idsSlice, &setupBuf, &handle)
          }
        }
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "DKLS key import session failed (code: \(err.rawValue))")
      }

      let setupData = Data(bytes: setupBuf.ptr, count: Int(setupBuf.len))
      return [
        "setupMessage": setupData.base64EncodedString(),
        "sessionHandle": Int(handle._0),
      ]
    }

    // Create a Schnorr (EdDSA) key import session from a raw private key + chain code.
    AsyncFunction("createSchnorrKeyImportSession") { (privateKeyHex: String, chainCodeHex: String, threshold: Int, partyIds: [String]) -> [String: Any] in
      guard let privKeyData = Data(hexString: privateKeyHex) else {
        throw Exception(name: "SchnorrError", description: "Invalid hex private key")
      }
      guard let chainCodeData = Data(hexString: chainCodeHex) else {
        throw Exception(name: "SchnorrError", description: "Invalid hex chain code")
      }

      var setupBuf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&setupBuf) }
      var handle = goschnorr.Handle(_0: 0)

      var byteArray: [UInt8] = []
      for id in partyIds {
        if let utf8 = id.data(using: .utf8) {
          byteArray.append(contentsOf: utf8)
          byteArray.append(0)
        }
      }
      if byteArray.last == 0 { byteArray.removeLast() }

      let privBytes = [UInt8](privKeyData)
      let ccBytes = [UInt8](chainCodeData)

      let err = privBytes.withUnsafeBufferPointer { privBp in
        ccBytes.withUnsafeBufferPointer { ccBp in
          byteArray.withUnsafeBufferPointer { idsBp in
            var privSlice = goschnorr.go_slice(ptr: UnsafePointer(privBp.baseAddress), len: UInt(privBp.count), cap: UInt(privBp.count))
            var ccSlice = goschnorr.go_slice(ptr: UnsafePointer(ccBp.baseAddress), len: UInt(ccBp.count), cap: UInt(ccBp.count))
            var idsSlice = goschnorr.go_slice(ptr: UnsafePointer(idsBp.baseAddress), len: UInt(idsBp.count), cap: UInt(idsBp.count))
            return schnorr_key_import_initiator_new(&privSlice, &ccSlice, UInt8(threshold), &idsSlice, &setupBuf, &handle)
          }
        }
      }

      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr key import session failed (code: \(err.rawValue))")
      }

      let setupData = Data(bytes: setupBuf.ptr, count: Int(setupBuf.len))
      return [
        "setupMessage": setupData.base64EncodedString(),
        "sessionHandle": Int(handle._0),
      ]
    }

    // Free a keygen session handle
    Function("freeKeygenSession") { (handleId: Int) in
      var handle = Handle(_0: Int32(handleId))
      dkls_keygen_session_free(&handle)
    }

    // Free a keyshare handle
    Function("freeKeyshare") { (handleId: Int) in
      var handle = Handle(_0: Int32(handleId))
      dkls_keyshare_free(&handle)
    }

    // === KEYSIGN (Signing) ===

    // Load keyshare from bytes (base64)
    AsyncFunction("loadKeyshare") { (keyshareBase64: String) -> Int in
      guard let ksData = Data(base64Encoded: keyshareBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 keyshare")
      }
      var handle = Handle(_0: 0)
      let err = [UInt8](ksData).withUnsafeBufferPointer { bp in
        var slice = go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return dkls_keyshare_from_bytes(&slice, &handle)
      }
      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Load keyshare failed (code: \(err.rawValue))")
      }
      return Int(handle._0)
    }

    // Get keyshare key ID (needed for sign setup)
    AsyncFunction("getKeyshareKeyId") { (handleId: Int) -> String in
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))
      let err = dkls_keyshare_key_id(handle, &buf)
      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Get key ID failed (code: \(err.rawValue))")
      }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Create sign setup message
    // Returns base64 setup message
    AsyncFunction("createSignSetupMessage") { (keyIdBase64: String, chainPath: String, messageHashHex: String, partyIds: [String]) -> String in
      guard let keyIdData = Data(base64Encoded: keyIdBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 key ID")
      }
      guard let hashData = Data(hexString: messageHashHex) else {
        throw Exception(name: "DklsError", description: "Invalid hex message hash")
      }

      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }

      let chainPathBytes = [UInt8](chainPath.utf8)

      // Party IDs as null-separated byte array
      var partyBytes: [UInt8] = []
      for id in partyIds {
        if let utf8 = id.data(using: .utf8) {
          partyBytes.append(contentsOf: utf8)
          partyBytes.append(0)
        }
      }
      if partyBytes.last == 0 { partyBytes.removeLast() }

      let err = [UInt8](keyIdData).withUnsafeBufferPointer { keyBp in
        chainPathBytes.withUnsafeBufferPointer { pathBp in
          [UInt8](hashData).withUnsafeBufferPointer { hashBp in
            partyBytes.withUnsafeBufferPointer { idsBp in
              var keySlice = go_slice(ptr: UnsafePointer(keyBp.baseAddress), len: UInt(keyBp.count), cap: UInt(keyBp.count))
              var pathSlice = go_slice(ptr: UnsafePointer(pathBp.baseAddress), len: UInt(pathBp.count), cap: UInt(pathBp.count))
              var hashSlice = go_slice(ptr: UnsafePointer(hashBp.baseAddress), len: UInt(hashBp.count), cap: UInt(hashBp.count))
              var idsSlice = go_slice(ptr: UnsafePointer(idsBp.baseAddress), len: UInt(idsBp.count), cap: UInt(idsBp.count))
              return dkls_sign_setupmsg_new(&keySlice, &pathSlice, &hashSlice, &idsSlice, &buf)
            }
          }
        }
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Sign setup failed (code: \(err.rawValue))")
      }

      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Create sign session from setup + keyshare
    AsyncFunction("createSignSession") { (setupBase64: String, localPartyId: String, keyshareHandleId: Int) -> Int in
      guard let setupData = Data(base64Encoded: setupBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 setup")
      }
      var handle = Handle(_0: 0)
      let keyshareHandle = Handle(_0: Int32(keyshareHandleId))
      let setupBytes = [UInt8](setupData)
      let idBytes = [UInt8](localPartyId.utf8)

      let err = setupBytes.withUnsafeBufferPointer { setupBp in
        idBytes.withUnsafeBufferPointer { idBp in
          var setup = go_slice(ptr: UnsafePointer(setupBp.baseAddress), len: UInt(setupBp.count), cap: UInt(setupBp.count))
          var idSlice = go_slice(ptr: UnsafePointer(idBp.baseAddress), len: UInt(idBp.count), cap: UInt(idBp.count))
          return dkls_sign_session_from_setup(&setup, &idSlice, keyshareHandle, &handle)
        }
      }

      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Sign session create failed (code: \(err.rawValue))")
      }

      return Int(handle._0)
    }

    // Get outbound message from sign session
    AsyncFunction("getSignOutboundMessage") { (handleId: Int) -> String? in
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))
      let err = dkls_sign_session_output_message(handle, &buf)
      if err != LIB_OK || buf.len == 0 { return nil }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Get receiver for sign message at index
    AsyncFunction("getSignMessageReceiver") { (handleId: Int, messageBase64: String, index: Int) -> String? in
      guard let msgData = Data(base64Encoded: messageBase64) else { return nil }
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))
      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return dkls_sign_session_message_receiver(handle, &msg, UInt32(index), &buf)
      }
      if err != LIB_OK || buf.len == 0 { return nil }
      return String(data: Data(bytes: buf.ptr, count: Int(buf.len)), encoding: .utf8)
    }

    // Feed inbound message to sign session
    AsyncFunction("inputSignMessage") { (handleId: Int, messageBase64: String) -> Bool in
      guard let msgData = Data(base64Encoded: messageBase64) else {
        throw Exception(name: "DklsError", description: "Invalid base64 message")
      }
      let handle = Handle(_0: Int32(handleId))
      var finished: Int32 = 0
      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return dkls_sign_session_input_message(handle, &msg, &finished)
      }
      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Sign input message failed (code: \(err.rawValue))")
      }
      return finished != 0
    }

    // Finish sign session - returns signature as hex (R || S || recovery_id)
    AsyncFunction("finishSign") { (handleId: Int) -> String in
      var buf = tss_buffer()
      defer { tss_buffer_free(&buf) }
      let handle = Handle(_0: Int32(handleId))
      let err = dkls_sign_session_finish(handle, &buf)
      guard err == LIB_OK else {
        throw Exception(name: "DklsError", description: "Sign finish failed (code: \(err.rawValue))")
      }
      return Data(bytes: buf.ptr, count: Int(buf.len)).map { String(format: "%02x", $0) }.joined()
    }

    // Free sign session
    Function("freeSignSession") { (handleId: Int) in
      var handle = Handle(_0: Int32(handleId))
      dkls_sign_session_free(&handle)
    }

    // === SCHNORR (EdDSA Keygen) ===

    // Create a Schnorr keygen session from setup message (reuses DKLS setup message)
    AsyncFunction("createSchnorrKeygenSession") { (setupBase64: String, localPartyId: String) -> Int in
      guard let setupData = Data(base64Encoded: setupBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 setup message")
      }

      var handle = goschnorr.Handle(_0: 0)
      let setupBytes = [UInt8](setupData)
      let idBytes = [UInt8](localPartyId.utf8)

      let err = setupBytes.withUnsafeBufferPointer { setupBp in
        idBytes.withUnsafeBufferPointer { idBp in
          var setup = goschnorr.go_slice(ptr: UnsafePointer(setupBp.baseAddress), len: UInt(setupBp.count), cap: UInt(setupBp.count))
          var idSlice = goschnorr.go_slice(ptr: UnsafePointer(idBp.baseAddress), len: UInt(idBp.count), cap: UInt(idBp.count))
          return schnorr_keygen_session_from_setup(&setup, &idSlice, &handle)
        }
      }

      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr session create failed (code: \(err.rawValue))")
      }

      return Int(handle._0)
    }

    // Get outbound message from Schnorr session
    AsyncFunction("getSchnorrOutboundMessage") { (handleId: Int) -> String? in
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      let err = schnorr_keygen_session_output_message(handle, &buf)
      if err != schnorr_lib_error(rawValue: 0) || buf.len == 0 { return nil }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Get receiver for Schnorr outbound message
    AsyncFunction("getSchnorrMessageReceiver") { (handleId: Int, messageBase64: String, index: Int) -> String? in
      guard let msgData = Data(base64Encoded: messageBase64) else { return nil }
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))

      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = goschnorr.go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return schnorr_keygen_session_message_receiver(handle, &msg, UInt32(index), &buf)
      }

      if err != schnorr_lib_error(rawValue: 0) || buf.len == 0 { return nil }
      return String(data: Data(bytes: buf.ptr, count: Int(buf.len)), encoding: .utf8)
    }

    // Feed inbound message to Schnorr session
    AsyncFunction("inputSchnorrMessage") { (handleId: Int, messageBase64: String) -> Bool in
      guard let msgData = Data(base64Encoded: messageBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 message")
      }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      var finished: Int32 = 0

      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = goschnorr.go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return schnorr_keygen_session_input_message(handle, &msg, &finished)
      }

      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr input message failed (code: \(err.rawValue))")
      }

      return finished != 0
    }

    // Finish Schnorr keygen and get keyshare data
    AsyncFunction("finishSchnorrKeygen") { (handleId: Int) -> [String: String] in
      let sessionHandle = goschnorr.Handle(_0: Int32(handleId))
      var keyshareHandle = goschnorr.Handle(_0: 0)

      let finishErr = schnorr_keygen_session_finish(sessionHandle, &keyshareHandle)
      guard finishErr == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr keygen finish failed (code: \(finishErr.rawValue))")
      }

      // Keyshare bytes
      var ksBuf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&ksBuf) }
      let ksErr = schnorr_keyshare_to_bytes(keyshareHandle, &ksBuf)
      guard ksErr == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr keyshare serialize failed (code: \(ksErr.rawValue))")
      }
      let keyshareB64 = Data(bytes: ksBuf.ptr, count: Int(ksBuf.len)).base64EncodedString()

      // Public key
      var pkBuf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&pkBuf) }
      let pkErr = schnorr_keyshare_public_key(keyshareHandle, &pkBuf)
      guard pkErr == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr public key extract failed (code: \(pkErr.rawValue))")
      }
      let publicKeyHex = Data(bytes: pkBuf.ptr, count: Int(pkBuf.len)).map { String(format: "%02x", $0) }.joined()

      return [
        "keyshare": keyshareB64,
        "publicKey": publicKeyHex,
      ]
    }

    // Free Schnorr keygen session
    Function("freeSchnorrSession") { (handleId: Int) in
      var handle = goschnorr.Handle(_0: Int32(handleId))
      schnorr_keygen_session_free(&handle)
    }

    // === SCHNORR (EdDSA Signing) ===

    // Load Schnorr keyshare from bytes (base64)
    AsyncFunction("loadSchnorrKeyshare") { (keyshareBase64: String) -> Int in
      guard let ksData = Data(base64Encoded: keyshareBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 keyshare")
      }
      var handle = goschnorr.Handle(_0: 0)
      let err = [UInt8](ksData).withUnsafeBufferPointer { bp in
        var slice = goschnorr.go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return schnorr_keyshare_from_bytes(&slice, &handle)
      }
      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Load Schnorr keyshare failed (code: \(err.rawValue))")
      }
      return Int(handle._0)
    }

    // Get Schnorr keyshare key ID (needed for sign setup)
    AsyncFunction("getSchnorrKeyshareKeyId") { (handleId: Int) -> String in
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      let err = schnorr_keyshare_key_id(handle, &buf)
      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Get Schnorr key ID failed (code: \(err.rawValue))")
      }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Create Schnorr sign setup message
    // Returns base64 setup message
    AsyncFunction("createSchnorrSignSetupMessage") { (keyIdBase64: String, chainPath: String, messageHashHex: String, partyIds: [String]) -> String in
      guard let keyIdData = Data(base64Encoded: keyIdBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 key ID")
      }
      guard let hashData = Data(hexString: messageHashHex) else {
        throw Exception(name: "SchnorrError", description: "Invalid hex message hash")
      }

      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }

      let chainPathBytes = [UInt8](chainPath.utf8)

      // Party IDs as null-separated byte array
      var partyBytes: [UInt8] = []
      for id in partyIds {
        if let utf8 = id.data(using: .utf8) {
          partyBytes.append(contentsOf: utf8)
          partyBytes.append(0)
        }
      }
      if partyBytes.last == 0 { partyBytes.removeLast() }

      let err = [UInt8](keyIdData).withUnsafeBufferPointer { keyBp in
        chainPathBytes.withUnsafeBufferPointer { pathBp in
          [UInt8](hashData).withUnsafeBufferPointer { hashBp in
            partyBytes.withUnsafeBufferPointer { idsBp in
              var keySlice = goschnorr.go_slice(ptr: UnsafePointer(keyBp.baseAddress), len: UInt(keyBp.count), cap: UInt(keyBp.count))
              var pathSlice = goschnorr.go_slice(ptr: UnsafePointer(pathBp.baseAddress), len: UInt(pathBp.count), cap: UInt(pathBp.count))
              var hashSlice = goschnorr.go_slice(ptr: UnsafePointer(hashBp.baseAddress), len: UInt(hashBp.count), cap: UInt(hashBp.count))
              var idsSlice = goschnorr.go_slice(ptr: UnsafePointer(idsBp.baseAddress), len: UInt(idsBp.count), cap: UInt(idsBp.count))
              return schnorr_sign_setupmsg_new(&keySlice, &pathSlice, &hashSlice, &idsSlice, &buf)
            }
          }
        }
      }

      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr sign setup failed (code: \(err.rawValue))")
      }

      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Create Schnorr sign session from setup + keyshare
    AsyncFunction("createSchnorrSignSession") { (setupBase64: String, localPartyId: String, keyshareHandleId: Int) -> Int in
      guard let setupData = Data(base64Encoded: setupBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 setup")
      }
      var handle = goschnorr.Handle(_0: 0)
      let keyshareHandle = goschnorr.Handle(_0: Int32(keyshareHandleId))
      let setupBytes = [UInt8](setupData)
      let idBytes = [UInt8](localPartyId.utf8)

      let err = setupBytes.withUnsafeBufferPointer { setupBp in
        idBytes.withUnsafeBufferPointer { idBp in
          var setup = goschnorr.go_slice(ptr: UnsafePointer(setupBp.baseAddress), len: UInt(setupBp.count), cap: UInt(setupBp.count))
          var idSlice = goschnorr.go_slice(ptr: UnsafePointer(idBp.baseAddress), len: UInt(idBp.count), cap: UInt(idBp.count))
          return schnorr_sign_session_from_setup(&setup, &idSlice, keyshareHandle, &handle)
        }
      }

      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr sign session create failed (code: \(err.rawValue))")
      }

      return Int(handle._0)
    }

    // Get outbound message from Schnorr sign session
    AsyncFunction("getSchnorrSignOutboundMessage") { (handleId: Int) -> String? in
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      let err = schnorr_sign_session_output_message(handle, &buf)
      if err != schnorr_lib_error(rawValue: 0) || buf.len == 0 { return nil }
      return Data(bytes: buf.ptr, count: Int(buf.len)).base64EncodedString()
    }

    // Get receiver for Schnorr sign message at index
    AsyncFunction("getSchnorrSignMessageReceiver") { (handleId: Int, messageBase64: String, index: Int) -> String? in
      guard let msgData = Data(base64Encoded: messageBase64) else { return nil }
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = goschnorr.go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return schnorr_sign_session_message_receiver(handle, &msg, UInt32(index), &buf)
      }
      if err != schnorr_lib_error(rawValue: 0) || buf.len == 0 { return nil }
      return String(data: Data(bytes: buf.ptr, count: Int(buf.len)), encoding: .utf8)
    }

    // Feed inbound message to Schnorr sign session
    AsyncFunction("inputSchnorrSignMessage") { (handleId: Int, messageBase64: String) -> Bool in
      guard let msgData = Data(base64Encoded: messageBase64) else {
        throw Exception(name: "SchnorrError", description: "Invalid base64 message")
      }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      var finished: UInt32 = 0
      let err = [UInt8](msgData).withUnsafeBufferPointer { bp in
        var msg = goschnorr.go_slice(ptr: UnsafePointer(bp.baseAddress), len: UInt(bp.count), cap: UInt(bp.count))
        return schnorr_sign_session_input_message(handle, &msg, &finished)
      }
      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr sign input message failed (code: \(err.rawValue))")
      }
      return finished != 0
    }

    // Finish Schnorr sign session - returns signature as hex (R || S)
    AsyncFunction("finishSchnorrSign") { (handleId: Int) -> String in
      var buf = goschnorr.tss_buffer()
      defer { goschnorr.tss_buffer_free(&buf) }
      let handle = goschnorr.Handle(_0: Int32(handleId))
      let err = schnorr_sign_session_finish(handle, &buf)
      guard err == schnorr_lib_error(rawValue: 0) else {
        throw Exception(name: "SchnorrError", description: "Schnorr sign finish failed (code: \(err.rawValue))")
      }
      return Data(bytes: buf.ptr, count: Int(buf.len)).map { String(format: "%02x", $0) }.joined()
    }

    // Free Schnorr sign session
    Function("freeSchnorrSignSession") { (handleId: Int) in
      var handle = goschnorr.Handle(_0: Int32(handleId))
      schnorr_sign_session_free(&handle)
    }

  }
}

// Helper extension for hex string to Data
extension Data {
  init?(hexString: String) {
    let hex = hexString.hasPrefix("0x") ? String(hexString.dropFirst(2)) : hexString
    guard hex.count % 2 == 0 else { return nil }
    var data = Data(capacity: hex.count / 2)
    var index = hex.startIndex
    while index < hex.endIndex {
      let nextIndex = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
      data.append(byte)
      index = nextIndex
    }
    self = data
  }
}
