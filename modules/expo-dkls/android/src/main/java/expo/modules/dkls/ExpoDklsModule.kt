@file:OptIn(ExperimentalEncodingApi::class, ExperimentalStdlibApi::class)

package expo.modules.dkls

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException

import com.silencelaboratories.godkls.BufferUtilJNI
import com.silencelaboratories.godkls.Handle
import com.silencelaboratories.godkls.go_slice
import com.silencelaboratories.godkls.godkls.dkls_keygen_setupmsg_new
import com.silencelaboratories.godkls.godkls.dkls_keygen_session_from_setup
import com.silencelaboratories.godkls.godkls.dkls_keygen_session_output_message
import com.silencelaboratories.godkls.godkls.dkls_keygen_session_message_receiver
import com.silencelaboratories.godkls.godkls.dkls_keygen_session_input_message
import com.silencelaboratories.godkls.godkls.dkls_keygen_session_finish
import com.silencelaboratories.godkls.godkls.dkls_keyshare_to_bytes
import com.silencelaboratories.godkls.godkls.dkls_keyshare_public_key
import com.silencelaboratories.godkls.godkls.dkls_keyshare_chaincode
import com.silencelaboratories.godkls.godkls.dkls_keyshare_from_bytes
import com.silencelaboratories.godkls.godkls.dkls_keyshare_key_id
import com.silencelaboratories.godkls.godkls.dkls_sign_setupmsg_new
import com.silencelaboratories.godkls.godkls.dkls_sign_session_from_setup
import com.silencelaboratories.godkls.godkls.dkls_sign_session_output_message
import com.silencelaboratories.godkls.godkls.dkls_sign_session_message_receiver
import com.silencelaboratories.godkls.godkls.dkls_sign_session_input_message
import com.silencelaboratories.godkls.godkls.dkls_sign_session_finish
import com.silencelaboratories.godkls.godkls.dkls_key_import_initiator_new
import com.silencelaboratories.godkls.godkls.tss_buffer_free
import com.silencelaboratories.godkls.lib_error.LIB_OK
import com.silencelaboratories.godkls.tss_buffer

import com.silencelaboratories.goschnorr.goschnorr.schnorr_keygen_session_from_setup
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keygen_session_output_message
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keygen_session_message_receiver
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keygen_session_input_message
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keygen_session_finish
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keyshare_to_bytes
import com.silencelaboratories.goschnorr.goschnorr.schnorr_keyshare_public_key
import com.silencelaboratories.goschnorr.goschnorr.schnorr_key_import_initiator_new
import com.silencelaboratories.goschnorr.schnorr_lib_error.LIB_OK as SCHNORR_LIB_OK

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

class ExpoDklsModule : Module() {
  companion object {
    init {
      System.loadLibrary("godklsswig")
      System.loadLibrary("goschnorrswig")
    }
  }

  // Store handles by integer ID. The Android JNI bindings use Handle objects (not raw int32),
  // so we map integer IDs to Handle objects for the JS bridge.
  private var nextHandleId = 1
  private val dklsHandles = mutableMapOf<Int, Handle>()
  private val schnorrHandles = mutableMapOf<Int, com.silencelaboratories.goschnorr.Handle>()

  private fun storeDklsHandle(handle: Handle): Int {
    val id = nextHandleId++
    dklsHandles[id] = handle
    return id
  }

  private fun getDklsHandle(id: Int): Handle {
    return dklsHandles[id] ?: throw CodedException("DklsError", "Invalid handle ID: $id", null)
  }

  private fun storeSchnorrHandle(handle: com.silencelaboratories.goschnorr.Handle): Int {
    val id = nextHandleId++
    schnorrHandles[id] = handle
    return id
  }

  private fun getSchnorrHandle(id: Int): com.silencelaboratories.goschnorr.Handle {
    return schnorrHandles[id] ?: throw CodedException("SchnorrError", "Invalid handle ID: $id", null)
  }

  /** Encode party IDs as null-separated UTF-8 bytes (trailing null removed) */
  private fun partyIdsToBytes(partyIds: List<String>): ByteArray {
    if (partyIds.isEmpty()) return byteArrayOf()
    val bytes = mutableListOf<Byte>()
    for (id in partyIds) {
      bytes.addAll(id.toByteArray(Charsets.UTF_8).toList())
      bytes.add(0)
    }
    if (bytes.last() == 0.toByte()) {
      bytes.removeAt(bytes.size - 1)
    }
    return bytes.toByteArray()
  }

  /** Convert hex string to ByteArray */
  private fun hexToBytes(hex: String): ByteArray {
    val clean = if (hex.startsWith("0x")) hex.substring(2) else hex
    return clean.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  }

  private fun ByteArray.toGoSlice(): go_slice {
    val slice = go_slice()
    BufferUtilJNI.set_bytes_on_go_slice(slice, this)
    return slice
  }

  private fun ByteArray.toSchnorrGoSlice(): com.silencelaboratories.goschnorr.go_slice {
    val slice = com.silencelaboratories.goschnorr.go_slice()
    com.silencelaboratories.goschnorr.BufferUtilJNI.set_bytes_on_go_slice(slice, this)
    return slice
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoDkls")

    // Verify godkls library is linked and callable
    Function("isAvailable") {
      true
    }

    // === KEYGEN ===

    // Create a keygen setup message
    // Returns base64-encoded setup message bytes
    AsyncFunction("createKeygenSetupMessage") { threshold: Int, partyIds: List<String> ->
      val buf = tss_buffer()
      try {
        val byteArray = partyIdsToBytes(partyIds)
        val ids = byteArray.toGoSlice()
        val err = dkls_keygen_setupmsg_new(threshold.toLong(), null, ids, buf)
        if (err != LIB_OK) {
          throw CodedException("DklsError", "Keygen setup failed (code: $err)", null)
        }
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        Base64.encode(data)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Create a keygen session from setup message
    // Returns handle integer
    AsyncFunction("createKeygenSession") { setupBase64: String, localPartyId: String ->
      val setupData = Base64.decode(setupBase64)
      val handle = Handle()
      val setupSlice = setupData.toGoSlice()
      val idSlice = localPartyId.toByteArray(Charsets.UTF_8).toGoSlice()
      val err = dkls_keygen_session_from_setup(setupSlice, idSlice, handle)
      if (err != LIB_OK) {
        throw CodedException("DklsError", "Session create failed (code: $err)", null)
      }
      storeDklsHandle(handle)
    }

    // Get outbound message from session (base64 or null)
    AsyncFunction("getOutboundMessage") { handleId: Int ->
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val err = dkls_keygen_session_output_message(handle, buf)
        if (err != LIB_OK) return@AsyncFunction null
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        Base64.encode(data)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Get receiver for an outbound message at given index
    AsyncFunction("getMessageReceiver") { handleId: Int, messageBase64: String, index: Int ->
      val msgData = Base64.decode(messageBase64)
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val msgSlice = msgData.toGoSlice()
        val err = dkls_keygen_session_message_receiver(handle, msgSlice, index.toLong(), buf)
        if (err != LIB_OK) return@AsyncFunction null
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        String(data, Charsets.UTF_8)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Feed inbound message to session. Returns true if session is finished.
    AsyncFunction("inputMessage") { handleId: Int, messageBase64: String ->
      val msgData = Base64.decode(messageBase64)
      val handle = getDklsHandle(handleId)
      val isFinished = intArrayOf(0)
      val msgSlice = msgData.toGoSlice()
      val err = dkls_keygen_session_input_message(handle, msgSlice, isFinished)
      if (err != LIB_OK) {
        throw CodedException("DklsError", "Input message failed (code: $err)", null)
      }
      isFinished[0] != 0
    }

    // Finish keygen and get keyshare data
    AsyncFunction("finishKeygen") { handleId: Int ->
      val sessionHandle = getDklsHandle(handleId)
      val keyshareHandle = Handle()
      val finishErr = dkls_keygen_session_finish(sessionHandle, keyshareHandle)
      if (finishErr != LIB_OK) {
        throw CodedException("DklsError", "Keygen finish failed (code: $finishErr)", null)
      }

      // Keyshare bytes
      val ksBuf = tss_buffer()
      val ksErr = dkls_keyshare_to_bytes(keyshareHandle, ksBuf)
      if (ksErr != LIB_OK) {
        tss_buffer_free(ksBuf)
        throw CodedException("DklsError", "Keyshare serialize failed (code: $ksErr)", null)
      }
      val keyshareBytes = BufferUtilJNI.get_bytes_from_tss_buffer(ksBuf)
      tss_buffer_free(ksBuf)
      val keyshareB64 = Base64.encode(keyshareBytes)

      // Public key
      val pkBuf = tss_buffer()
      val pkErr = dkls_keyshare_public_key(keyshareHandle, pkBuf)
      if (pkErr != LIB_OK) {
        tss_buffer_free(pkBuf)
        throw CodedException("DklsError", "Public key extract failed (code: $pkErr)", null)
      }
      val publicKeyBytes = BufferUtilJNI.get_bytes_from_tss_buffer(pkBuf)
      tss_buffer_free(pkBuf)
      val publicKeyHex = publicKeyBytes.toHexString()

      // Chain code
      val ccBuf = tss_buffer()
      val ccErr = dkls_keyshare_chaincode(keyshareHandle, ccBuf)
      if (ccErr != LIB_OK) {
        tss_buffer_free(ccBuf)
        throw CodedException("DklsError", "Chain code extract failed (code: $ccErr)", null)
      }
      val chainCodeBytes = BufferUtilJNI.get_bytes_from_tss_buffer(ccBuf)
      tss_buffer_free(ccBuf)
      val chainCodeHex = chainCodeBytes.toHexString()

      // Store the keyshare handle for later use
      val ksHandleId = storeDklsHandle(keyshareHandle)

      mapOf(
        "keyshare" to keyshareB64,
        "publicKey" to publicKeyHex,
        "chainCode" to chainCodeHex,
      )
    }

    // === KEY IMPORT (Seed Phrase → DKLS MPC) ===

    // Create a DKLS key import session from a raw private key + chain code.
    // Returns { setupMessage: base64, sessionHandle: Int }
    AsyncFunction("createDklsKeyImportSession") { privateKeyHex: String, chainCodeHex: String, threshold: Int, partyIds: List<String> ->
      val buf = tss_buffer()
      try {
        val handle = Handle()
        val privSlice = hexToBytes(privateKeyHex).toGoSlice()
        val ccSlice = hexToBytes(chainCodeHex).toGoSlice()
        val idsSlice = partyIdsToBytes(partyIds).toGoSlice()
        val err = dkls_key_import_initiator_new(privSlice, ccSlice, threshold.toShort(), idsSlice, buf, handle)
        if (err != LIB_OK) {
          throw CodedException("DklsError", "DKLS key import session failed (code: $err)", null)
        }
        val setupData = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        mapOf(
          "setupMessage" to Base64.encode(setupData),
          "sessionHandle" to storeDklsHandle(handle),
        )
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Create a Schnorr (EdDSA) key import session from a raw private key + chain code.
    AsyncFunction("createSchnorrKeyImportSession") { privateKeyHex: String, chainCodeHex: String, threshold: Int, partyIds: List<String> ->
      val buf = com.silencelaboratories.goschnorr.tss_buffer()
      try {
        val handle = com.silencelaboratories.goschnorr.Handle()
        val privSlice = hexToBytes(privateKeyHex).toSchnorrGoSlice()
        val ccSlice = hexToBytes(chainCodeHex).toSchnorrGoSlice()
        val idsSlice = partyIdsToBytes(partyIds).toSchnorrGoSlice()
        val err = schnorr_key_import_initiator_new(privSlice, ccSlice, threshold.toShort(), idsSlice, buf, handle)
        if (err != SCHNORR_LIB_OK) {
          throw CodedException("SchnorrError", "Schnorr key import session failed (code: $err)", null)
        }
        val setupData = com.silencelaboratories.goschnorr.BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        mapOf(
          "setupMessage" to Base64.encode(setupData),
          "sessionHandle" to storeSchnorrHandle(handle),
        )
      } finally {
        com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(buf)
      }
    }

    // Free a keygen session handle
    Function("freeKeygenSession") { handleId: Int ->
      dklsHandles.remove(handleId)
    }

    // Free a keyshare handle
    Function("freeKeyshare") { handleId: Int ->
      dklsHandles.remove(handleId)
    }

    // === KEYSIGN (Signing) ===

    // Load keyshare from bytes (base64)
    AsyncFunction("loadKeyshare") { keyshareBase64: String ->
      val ksData = Base64.decode(keyshareBase64)
      val handle = Handle()
      val ksSlice = ksData.toGoSlice()
      val err = dkls_keyshare_from_bytes(ksSlice, handle)
      if (err != LIB_OK) {
        throw CodedException("DklsError", "Load keyshare failed (code: $err)", null)
      }
      storeDklsHandle(handle)
    }

    // Get keyshare key ID (needed for sign setup)
    AsyncFunction("getKeyshareKeyId") { handleId: Int ->
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val err = dkls_keyshare_key_id(handle, buf)
        if (err != LIB_OK) {
          throw CodedException("DklsError", "Get key ID failed (code: $err)", null)
        }
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        Base64.encode(data)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Create sign setup message
    // Returns base64 setup message
    AsyncFunction("createSignSetupMessage") { keyIdBase64: String, chainPath: String, messageHashHex: String, partyIds: List<String> ->
      val keyIdData = Base64.decode(keyIdBase64)
      val hashData = hexToBytes(messageHashHex)
      val buf = tss_buffer()
      try {
        val keyIdSlice = keyIdData.toGoSlice()
        val chainPathSlice = chainPath.toByteArray(Charsets.UTF_8).toGoSlice()
        val hashSlice = hashData.toGoSlice()
        val partyBytes = partyIdsToBytes(partyIds)
        val idsSlice = partyBytes.toGoSlice()
        val err = dkls_sign_setupmsg_new(keyIdSlice, chainPathSlice, hashSlice, idsSlice, buf)
        if (err != LIB_OK) {
          throw CodedException("DklsError", "Sign setup failed (code: $err)", null)
        }
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        Base64.encode(data)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Create sign session from setup + keyshare
    AsyncFunction("createSignSession") { setupBase64: String, localPartyId: String, keyshareHandleId: Int ->
      val setupData = Base64.decode(setupBase64)
      val handle = Handle()
      val keyshareHandle = getDklsHandle(keyshareHandleId)
      val setupSlice = setupData.toGoSlice()
      val idSlice = localPartyId.toByteArray(Charsets.UTF_8).toGoSlice()
      val err = dkls_sign_session_from_setup(setupSlice, idSlice, keyshareHandle, handle)
      if (err != LIB_OK) {
        throw CodedException("DklsError", "Sign session create failed (code: $err)", null)
      }
      storeDklsHandle(handle)
    }

    // Get outbound message from sign session
    AsyncFunction("getSignOutboundMessage") { handleId: Int ->
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val err = dkls_sign_session_output_message(handle, buf)
        if (err != LIB_OK) return@AsyncFunction null
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        Base64.encode(data)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Get receiver for sign message at index
    AsyncFunction("getSignMessageReceiver") { handleId: Int, messageBase64: String, index: Int ->
      val msgData = Base64.decode(messageBase64)
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val msgSlice = msgData.toGoSlice()
        val err = dkls_sign_session_message_receiver(handle, msgSlice, index.toLong(), buf)
        if (err != LIB_OK) return@AsyncFunction null
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        String(data, Charsets.UTF_8)
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Feed inbound message to sign session
    AsyncFunction("inputSignMessage") { handleId: Int, messageBase64: String ->
      val msgData = Base64.decode(messageBase64)
      val handle = getDklsHandle(handleId)
      val isFinished = intArrayOf(0)
      val msgSlice = msgData.toGoSlice()
      val err = dkls_sign_session_input_message(handle, msgSlice, isFinished)
      if (err != LIB_OK) {
        throw CodedException("DklsError", "Sign input message failed (code: $err)", null)
      }
      isFinished[0] != 0
    }

    // Finish sign session - returns signature as hex (R || S || recovery_id)
    AsyncFunction("finishSign") { handleId: Int ->
      val buf = tss_buffer()
      try {
        val handle = getDklsHandle(handleId)
        val err = dkls_sign_session_finish(handle, buf)
        if (err != LIB_OK) {
          throw CodedException("DklsError", "Sign finish failed (code: $err)", null)
        }
        val data = BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        data.toHexString()
      } finally {
        tss_buffer_free(buf)
      }
    }

    // Free sign session
    Function("freeSignSession") { handleId: Int ->
      dklsHandles.remove(handleId)
    }

    // === SCHNORR (EdDSA Keygen) ===

    // Create a Schnorr keygen session from setup message (reuses DKLS setup message)
    AsyncFunction("createSchnorrKeygenSession") { setupBase64: String, localPartyId: String ->
      val setupData = Base64.decode(setupBase64)
      val handle = com.silencelaboratories.goschnorr.Handle()
      val setupSlice = setupData.toSchnorrGoSlice()
      val idSlice = localPartyId.toByteArray(Charsets.UTF_8).toSchnorrGoSlice()
      val err = schnorr_keygen_session_from_setup(setupSlice, idSlice, handle)
      if (err != SCHNORR_LIB_OK) {
        throw CodedException("SchnorrError", "Schnorr session create failed (code: $err)", null)
      }
      storeSchnorrHandle(handle)
    }

    // Get outbound message from Schnorr session
    AsyncFunction("getSchnorrOutboundMessage") { handleId: Int ->
      val buf = com.silencelaboratories.goschnorr.tss_buffer()
      try {
        val handle = getSchnorrHandle(handleId)
        val err = schnorr_keygen_session_output_message(handle, buf)
        if (err != SCHNORR_LIB_OK) return@AsyncFunction null
        val data = com.silencelaboratories.goschnorr.BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        Base64.encode(data)
      } finally {
        com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(buf)
      }
    }

    // Get receiver for Schnorr outbound message
    AsyncFunction("getSchnorrMessageReceiver") { handleId: Int, messageBase64: String, index: Int ->
      val msgData = Base64.decode(messageBase64)
      val buf = com.silencelaboratories.goschnorr.tss_buffer()
      try {
        val handle = getSchnorrHandle(handleId)
        val msgSlice = msgData.toSchnorrGoSlice()
        val err = schnorr_keygen_session_message_receiver(handle, msgSlice, index.toLong(), buf)
        if (err != SCHNORR_LIB_OK) return@AsyncFunction null
        val data = com.silencelaboratories.goschnorr.BufferUtilJNI.get_bytes_from_tss_buffer(buf)
        if (data.isEmpty()) return@AsyncFunction null
        String(data, Charsets.UTF_8)
      } finally {
        com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(buf)
      }
    }

    // Feed inbound message to Schnorr session
    AsyncFunction("inputSchnorrMessage") { handleId: Int, messageBase64: String ->
      val msgData = Base64.decode(messageBase64)
      val handle = getSchnorrHandle(handleId)
      val isFinished = intArrayOf(0)
      val msgSlice = msgData.toSchnorrGoSlice()
      val err = schnorr_keygen_session_input_message(handle, msgSlice, isFinished)
      if (err != SCHNORR_LIB_OK) {
        throw CodedException("SchnorrError", "Schnorr input message failed (code: $err)", null)
      }
      isFinished[0] != 0
    }

    // Finish Schnorr keygen and get keyshare data
    AsyncFunction("finishSchnorrKeygen") { handleId: Int ->
      val sessionHandle = getSchnorrHandle(handleId)
      val keyshareHandle = com.silencelaboratories.goschnorr.Handle()
      val finishErr = schnorr_keygen_session_finish(sessionHandle, keyshareHandle)
      if (finishErr != SCHNORR_LIB_OK) {
        throw CodedException("SchnorrError", "Schnorr keygen finish failed (code: $finishErr)", null)
      }

      // Keyshare bytes
      val ksBuf = com.silencelaboratories.goschnorr.tss_buffer()
      val ksErr = schnorr_keyshare_to_bytes(keyshareHandle, ksBuf)
      if (ksErr != SCHNORR_LIB_OK) {
        com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(ksBuf)
        throw CodedException("SchnorrError", "Schnorr keyshare serialize failed (code: $ksErr)", null)
      }
      val keyshareBytes = com.silencelaboratories.goschnorr.BufferUtilJNI.get_bytes_from_tss_buffer(ksBuf)
      com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(ksBuf)
      val keyshareB64 = Base64.encode(keyshareBytes)

      // Public key
      val pkBuf = com.silencelaboratories.goschnorr.tss_buffer()
      val pkErr = schnorr_keyshare_public_key(keyshareHandle, pkBuf)
      if (pkErr != SCHNORR_LIB_OK) {
        com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(pkBuf)
        throw CodedException("SchnorrError", "Schnorr public key extract failed (code: $pkErr)", null)
      }
      val publicKeyBytes = com.silencelaboratories.goschnorr.BufferUtilJNI.get_bytes_from_tss_buffer(pkBuf)
      com.silencelaboratories.goschnorr.goschnorr.tss_buffer_free(pkBuf)
      val publicKeyHex = publicKeyBytes.toHexString()

      mapOf(
        "keyshare" to keyshareB64,
        "publicKey" to publicKeyHex,
      )
    }

    // Free Schnorr keygen session
    Function("freeSchnorrSession") { handleId: Int ->
      schnorrHandles.remove(handleId)
    }
  }
}
