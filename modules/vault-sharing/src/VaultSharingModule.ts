import { requireNativeModule } from 'expo-modules-core'

export interface ShareResult {
  /**
   * Whether the user completed the share action (saved the file)
   * - iOS: true if user completed an activity, false if canceled
   * - Android: true if user saved the file, false if canceled
   */
  completed: boolean
  /**
   * The type of activity that was performed (iOS only)
   * For Android, this will be the destination URI if completed
   */
  activityType?: string
  /**
   * The destination URI where the file was saved (Android only)
   */
  uri?: string
}

export interface VaultSharingModule {
  /**
   * Share a file and get feedback on whether the user completed the action.
   *
   * @param fileUri - The file:// URI of the file to share
   * @returns Promise that resolves with ShareResult indicating completion status
   *
   * @example
   * ```typescript
   * const result = await VaultSharing.shareAsync('file:///path/to/backup.vult')
   * if (result.completed) {
   *   console.log('User saved the backup!')
   * } else {
   *   console.log('User canceled the save')
   * }
   * ```
   */
  shareAsync(fileUri: string): Promise<ShareResult>
}

const VaultSharing: VaultSharingModule = requireNativeModule('VaultSharing')

export default VaultSharing
