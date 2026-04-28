import { Platform } from 'react-native'
import { Asset } from 'expo-asset'
import {
  cacheDirectory,
  copyAsync,
  getInfoAsync,
} from 'expo-file-system/legacy'

const OG_STATUS_ASSET = require('../../assets/og-status.png')
const SHARED_FILENAME = 'station-og-status.png'

/**
 * Resolves the bundled OG-status PNG to a real file URI on disk so the
 * platform share sheet can attach it. In dev, Metro serves the asset
 * over http (`localUri` is an http URL) — the iOS UIActivityViewController
 * refuses to share http URLs as files, so we always copy into the cache
 * directory and hand back a `file://` path.
 */
async function getShareableUri(): Promise<string> {
  const asset = Asset.fromModule(OG_STATUS_ASSET)
  if (!asset.localUri) {
    await asset.downloadAsync()
  }
  if (!asset.localUri) {
    throw new Error('Failed to resolve OG status asset')
  }

  if (!cacheDirectory) {
    return asset.localUri
  }

  const target = `${cacheDirectory}${SHARED_FILENAME}`
  const existing = await getInfoAsync(target)
  if (!existing.exists) {
    await copyAsync({ from: asset.localUri, to: target })
  }
  return target
}

/**
 * Opens the system share sheet for the user's Station OG status card.
 * Uses expo-sharing — the same primitive shareVaultFile() uses, so the
 * UX matches the existing export-share path.
 */
export async function shareOgStatus(): Promise<void> {
  const Sharing =
    require('expo-sharing') as typeof import('expo-sharing')

  const isAvailable = await Sharing.isAvailableAsync()
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device')
  }

  const fileUri = await getShareableUri()
  await Sharing.shareAsync(fileUri, {
    mimeType: 'image/png',
    dialogTitle: 'Share Station OG status',
    // UTI is required for image previews in iOS share sheet targets like
    // Messages and Mail. Ignored on Android.
    ...(Platform.OS === 'ios' ? { UTI: 'public.png' } : {}),
  })
}
