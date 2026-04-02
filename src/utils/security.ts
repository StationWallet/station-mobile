import { Platform } from 'react-native'

const deviceRooted = async (): Promise<boolean> => {
  return false
}

const debugEnabled = async (): Promise<boolean> => {
  return __DEV__
}

const runningEmulator = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return __DEV__
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
  return false
}

const allowScreenCapture = async (): Promise<void> => {}

const disallowScreenCapture = async (): Promise<void> => {}

export default {
  deviceRooted,
  debugEnabled,
  runningEmulator,
  incorrectFingerprint,
  allowScreenCapture,
  disallowScreenCapture,
}
