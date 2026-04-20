package expo.modules.vaultsharing

import android.app.Activity
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class VaultSharingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VaultSharing")

    // Share a file and return whether the user completed the action
    AsyncFunction("shareAsync") { fileUri: String, promise: Promise ->
      val activity = appContext.currentActivity ?: run {
        promise.reject("ERR_NO_ACTIVITY", "No current activity found", null)
        return@AsyncFunction
      }

      try {
        val file = File(Uri.parse(fileUri).path ?: throw IllegalArgumentException("Invalid file URI"))

        if (!file.exists()) {
          promise.reject("ERR_FILE_NOT_FOUND", "File not found: ${file.absolutePath}", null)
          return@AsyncFunction
        }

        // Use ACTION_CREATE_DOCUMENT to let user choose save location
        // This provides a completion callback unlike ACTION_SEND
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/octet-stream"
          putExtra(Intent.EXTRA_TITLE, file.name)
        }

        // Start activity for result using ActivityResultContracts pattern
        // Note: This is a simplified version. In production, you'd use
        // ActivityResultLauncher with proper lifecycle handling
        val requestCode = SHARE_REQUEST_CODE

        // Store promise for later resolution
        pendingPromise = promise
        pendingSourceFile = file

        activity.startActivityForResult(intent, requestCode)

      } catch (e: Exception) {
        promise.reject("ERR_SHARE_FAILED", e.message, e)
      }
    }

    // Handle activity result
    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode == SHARE_REQUEST_CODE) {
        val promise = pendingPromise
        val sourceFile = pendingSourceFile

        if (promise != null && sourceFile != null) {
          try {
            when (resultCode) {
              Activity.RESULT_OK -> {
                // User selected a save location
                val destinationUri = data?.data
                if (destinationUri != null) {
                  // Copy file content to selected location
                  appContext.reactContext?.contentResolver?.openOutputStream(destinationUri)?.use { output ->
                    sourceFile.inputStream().use { input ->
                      input.copyTo(output)
                    }
                  }

                  promise.resolve(
                    mapOf(
                      "completed" to true,
                      "uri" to destinationUri.toString()
                    )
                  )
                } else {
                  promise.reject("ERR_NO_URI", "No destination URI received", null)
                }
              }
              Activity.RESULT_CANCELED -> {
                // User canceled
                promise.resolve(
                  mapOf(
                    "completed" to false,
                    "uri" to ""
                  )
                )
              }
              else -> {
                promise.reject("ERR_UNKNOWN_RESULT", "Unknown result code: $resultCode", null)
              }
            }
          } catch (e: Exception) {
            promise.reject("ERR_SAVE_FAILED", e.message, e)
          } finally {
            pendingPromise = null
            pendingSourceFile = null
          }
        }
      }
    }
  }

  companion object {
    private const val SHARE_REQUEST_CODE = 4747
    private var pendingPromise: Promise? = null
    private var pendingSourceFile: File? = null
  }
}
