// Stubbed security module for Expo POC
// All checks return false (safe) since native modules are not available

const deviceRooted = async (): Promise<boolean> => false
const debugEnabled = async (): Promise<boolean> => false
const runningEmulator = async (): Promise<boolean> => false
const incorrectFingerprint = async (): Promise<boolean> => false
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
