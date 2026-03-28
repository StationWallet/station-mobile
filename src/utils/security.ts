// Security module for Expo
// Uses JS-based detection where possible; native checks (jailbreak) require
// a native module like IOSSecuritySuite which is not yet integrated.

import { Platform } from 'react-native'

const deviceRooted = async (): Promise<boolean> => {
  // Jailbreak/root detection requires native code (IOSSecuritySuite / RootBeer)
  // For the POC, return false. In production, integrate a native Expo module.
  return false
}

const debugEnabled = async (): Promise<boolean> => {
  return __DEV__
}

const runningEmulator = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    // @ts-ignore - simulator flag is available on iOS
    const isSimulator = Platform.constants?.interfaceIdiom === 'pad'
      ? false // iPads can be real devices
      : !!(Platform.constants as any)?.systemName && __DEV__
    // More reliable: check for simulator brand
    try {
      const brand = (Platform.constants as any)?.Brand
      return brand === 'Apple' && __DEV__
    } catch {
      return false
    }
  }
  if (Platform.OS === 'android') {
    try {
      const constants = Platform.constants as any
      return !!(constants?.Fingerprint?.includes('generic') ||
        constants?.Model?.includes('SDK') ||
        constants?.Model?.includes('Emulator'))
    } catch {
      return false
    }
  }
  return false
}

const incorrectFingerprint = async (): Promise<boolean> => {
  // App signature verification requires native code
  return false
}

const allowScreenCapture = async (): Promise<void> => {
  // Screen capture control requires native FLAG_SECURE on Android
  // No-op on iOS
}

const disallowScreenCapture = async (): Promise<void> => {
  // No-op without native module
}

export default {
  deviceRooted,
  debugEnabled,
  runningEmulator,
  incorrectFingerprint,
  allowScreenCapture,
  disallowScreenCapture,
}
