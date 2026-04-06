import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import Security from 'utils/security'

const DEFAULT_SECURITY_VALUE = __DEV__ ? false : undefined

const useSecurity = (): {
  getSecurityErrorMessage: () => string
  securityCheckFailed: boolean | undefined
} => {
  const [isDeviceRooted, setDeviceRooted] = useState<
    boolean | undefined
  >(DEFAULT_SECURITY_VALUE)

  const [isDebugEnabled, setDebugEnabled] = useState<
    boolean | undefined
  >(DEFAULT_SECURITY_VALUE)

  const [isIncorrectFingerprint, setIncorrectFingerprint] = useState<
    boolean | undefined
  >(DEFAULT_SECURITY_VALUE)

  const [isRunningEmulator, setRunningEmulator] = useState<
    boolean | undefined
  >(DEFAULT_SECURITY_VALUE)

  const [securityCheckFailed, setSecurityCheckFailed] = useState<
    boolean | undefined
  >()

  useEffect(() => {
    if (
      isDeviceRooted === undefined ||
      isDebugEnabled === undefined ||
      isIncorrectFingerprint === undefined ||
      isRunningEmulator === undefined
    ) {
      return
    }

    const check =
      isDeviceRooted ||
      isDebugEnabled ||
      isIncorrectFingerprint ||
      isRunningEmulator
    setSecurityCheckFailed(check)
  }, [
    isDeviceRooted,
    isDebugEnabled,
    isIncorrectFingerprint,
    isRunningEmulator,
  ])

  useEffect(() => {
    if (isDeviceRooted === undefined) {
      Security.deviceRooted().then((ret: boolean) => {
        setDeviceRooted(ret)
      })
    }

    if (isDebugEnabled === undefined) {
      Security.debugEnabled().then((ret: boolean) => {
        setDebugEnabled(ret)
      })
    }

    if (isIncorrectFingerprint === undefined) {
      if (Platform.OS === 'android') {
        Security.incorrectFingerprint().then((ret: boolean) => {
          setIncorrectFingerprint(ret)
        })
      } else {
        setIncorrectFingerprint(false)
      }
    }

    if (isRunningEmulator === undefined) {
      if (Platform.OS === 'android') {
        Security.runningEmulator().then((ret: boolean) => {
          setRunningEmulator(ret)
        })
      } else {
        setRunningEmulator(false)
      }
    }
  }, [])

  const getSecurityErrorMessage = (): string => {
    return isDeviceRooted
      ? 'The device is rooted. For security reasons the application cannot be run from a rooted device.'
      : isDebugEnabled
      ? 'Developer debugging is turned on. Usage is restricted for security reasons.'
      : isIncorrectFingerprint
      ? 'Application signature is incorrect. Usage is restricted for security reasons.'
      : isRunningEmulator
      ? 'Application is currently being run on an emulator. Usage is restricted for security reasons.'
      : ''
  }

  return {
    getSecurityErrorMessage,
    securityCheckFailed,
  }
}

export default useSecurity
