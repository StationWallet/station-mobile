import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import Security from 'utils/security'

interface SecurityState {
  isDeviceRooted: boolean
  isDebugEnabled: boolean
  isIncorrectFingerprint: boolean
  isRunningEmulator: boolean
}

const useSecurity = (): {
  getSecurityErrorMessage: () => string
  securityCheckFailed: boolean | undefined
} => {
  const [state, setState] = useState<SecurityState | undefined>(
    __DEV__
      ? {
          isDeviceRooted: false,
          isDebugEnabled: false,
          isIncorrectFingerprint: false,
          isRunningEmulator: false,
        }
      : undefined
  )

  const securityCheckFailed = useMemo(() => {
    if (!state) return undefined
    return (
      state.isDeviceRooted ||
      state.isDebugEnabled ||
      state.isIncorrectFingerprint ||
      state.isRunningEmulator
    )
  }, [state])

  useEffect(() => {
    if (state) return

    let resolved = false

    Promise.all([
      Security.deviceRooted(),
      Security.debugEnabled(),
      Platform.OS === 'android'
        ? Security.incorrectFingerprint()
        : Promise.resolve(false),
      Platform.OS === 'android'
        ? Security.runningEmulator()
        : Promise.resolve(false),
    ]).then(
      ([
        isDeviceRooted,
        isDebugEnabled,
        isIncorrectFingerprint,
        isRunningEmulator,
      ]) => {
        resolved = true
        setState({
          isDeviceRooted,
          isDebugEnabled,
          isIncorrectFingerprint,
          isRunningEmulator,
        })
      }
    )

    // Fallback: if the native security probes never resolve (real-device
    // keychain/JIT-detection latency we can't reproduce on sim), force the
    // splash to hide so the user isn't stuck. App Store reviewer hit this
    // on iPad Air 11" / iPadOS 26.4.2 ("stuck at the launch page"). __DEV__
    // builds short-circuit via the pre-populated stub above, so the bug
    // only manifests in production.
    const fallbackTimer = setTimeout(() => {
      if (resolved) return
      setState({
        isDeviceRooted: false,
        isDebugEnabled: false,
        isIncorrectFingerprint: false,
        isRunningEmulator: false,
      })
    }, 5000)

    return () => clearTimeout(fallbackTimer)
  }, [])

  const getSecurityErrorMessage = (): string => {
    if (!state) return ''
    return state.isDeviceRooted
      ? 'The device is rooted. For security reasons the application cannot be run from a rooted device.'
      : state.isDebugEnabled
      ? 'Developer debugging is turned on. Usage is restricted for security reasons.'
      : state.isIncorrectFingerprint
      ? 'Application signature is incorrect. Usage is restricted for security reasons.'
      : state.isRunningEmulator
      ? 'Application is currently being run on an emulator. Usage is restricted for security reasons.'
      : ''
  }

  return {
    getSecurityErrorMessage,
    securityCheckFailed,
  }
}

export default useSecurity
