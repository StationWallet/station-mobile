// Mandatory-update controller. On cold launch and every foreground, the
// hook asks expo-updates whether an OTA is available on the current native
// runtime. If yes, callers render a full-screen blocker that *cannot* be
// dismissed — the only way past it is to apply the update.
//
// Differences from the dismissable toast we model this after
// (vultiagent-app's useOtaUpdateController):
//  - No 1-hour defer, no `dismiss` action.
//  - No unsafe-to-restart MPC guard — per product call, force the update
//    immediately. An MPC ceremony interrupted mid-flight loses progress
//    but no funds (keygen produces shares, doesn't move balances).
//  - Failure path: stay blocked, surface a retry-able error so a single
//    network blip doesn't permanently lock the app out.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import * as Updates from 'expo-updates'

type ControllerResult = {
  /** True when an OTA is available for the current native runtime. */
  shouldBlock: boolean
  /** True while fetchUpdateAsync / reloadAsync is in flight. */
  isApplying: boolean
  /** Message to surface if the last apply attempt failed; null if fresh. */
  applyError: string | null
  /** Triggered by the Update button. Stays blocked on failure. */
  applyUpdate: () => Promise<void>
}

export function useMandatoryUpdateController(): ControllerResult {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates()

  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  // Synchronous guard so a fast double-tap can't enqueue two
  // fetchUpdateAsync / reloadAsync calls before the JS context tears down.
  const applyInFlightRef = useRef(false)

  useEffect(() => {
    const onChange = (state: AppStateStatus): void => {
      if (state !== 'active') return
      if (!Updates.isEnabled) return
      Updates.checkForUpdateAsync().catch((err: unknown) => {
        // eslint-disable-next-line no-console -- diagnostic; not user-visible
        console.warn(
          '[mandatory-update] checkForUpdateAsync failed:',
          err instanceof Error ? err.message : err
        )
      })
    }
    // First foreground (cold launch) needs an explicit check —
    // AppState 'change' doesn't fire for the initial 'active'.
    onChange(AppState.currentState)
    const sub = AppState.addEventListener('change', onChange)
    return (): void => sub.remove()
  }, [])

  const applyUpdate = useCallback(async (): Promise<void> => {
    if (applyInFlightRef.current) return
    applyInFlightRef.current = true
    setIsApplying(true)
    setApplyError(null)
    try {
      if (!isUpdatePending) {
        await Updates.fetchUpdateAsync()
      }
      // reloadAsync tears the JS context down — may not return.
      await Updates.reloadAsync()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Update failed. Please check your connection and try again.'
      setApplyError(message)
    } finally {
      // Load-bearing for the failure path; reloadAsync wipes state on success.
      applyInFlightRef.current = false
      setIsApplying(false)
    }
  }, [isUpdatePending])

  return {
    shouldBlock: Boolean(isUpdateAvailable),
    isApplying,
    applyError,
    applyUpdate,
  }
}
