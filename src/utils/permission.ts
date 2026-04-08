import { Linking } from 'react-native'
import { Camera } from 'expo-camera'

type PermissionResult =
  | 'unavailable'
  | 'blocked'
  | 'denied'
  | 'granted'
  | 'limited'

export const requestPermission = async (): Promise<PermissionResult> => {
  const { status } = await Camera.requestCameraPermissionsAsync()
  return status as PermissionResult
}

export const requestPermissionBLE = async (): Promise<PermissionResult> => {
  // BLE permissions stubbed for POC
  return 'granted'
}

export const openPermissionSettings = (): void => {
  Linking.openSettings().catch(() => {
    // error handling
  })
}

export const checkCameraPermission = async (): Promise<PermissionResult> => {
  const { status } = await Camera.getCameraPermissionsAsync()
  return status as PermissionResult
}

export const checkFaceIdPermission = async (): Promise<PermissionResult> => {
  // Handled by expo-local-authentication
  return 'granted'
}
