import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native'

import MainNavigator from './MainNavigator'
import AuthNavigator from './AuthNavigator'
import MigrationNavigator from './MigrationNavigator'
import { MigrationContext } from './MigrationContext'
import { getWallets } from 'utils/wallet'
import { useConfig } from 'lib'
import { themes } from 'lib/contexts/useTheme'
import { COLORS } from 'consts/theme'
import { WalletNavContext } from './hooks'
import preferences, {
  PreferencesEnum,
} from 'nativeModules/preferences'
import { MIGRATION_FLOW_ENABLED } from 'config/env'

export { useWalletDisconnected, useWalletNav } from './hooks'

type RootRoute = 'Migration' | 'Auth' | 'Main'

export type MigrationEntry =
  | 'default'
  | 'create-vault'
  | 'recover-seed-input'
  | 'import-vault'

export default function AppNavigator(): React.ReactElement | null {
  const [wallets, setWallets] = useState<LocalWallet[] | null>(null)
  const [rootRoute, setRootRoute] = useState<RootRoute | null>(null)
  const [migrationEntry, setMigrationEntry] =
    useState<MigrationEntry>('default')
  const { theme } = useConfig()
  const currentTheme = theme.current

  // Mirrors rootRoute so start* callbacks can read the current root without
  // being re-memoized on every root change.
  const rootRouteRef = useRef<RootRoute | null>(null)
  useEffect(() => {
    rootRouteRef.current = rootRoute
  }, [rootRoute])

  // Origin captured when a start* hook switches into Migration, so goHome
  // can return to the exact root the user came from (Auth vs Main).
  const preMigrationRootRef = useRef<RootRoute | null>(null)

  const loadWallets = useCallback(async () => {
    const loaded = await getWallets()
    setWallets(loaded)
    return loaded
  }, [])

  useEffect(() => {
    const init = async (): Promise<void> => {
      const loaded = await loadWallets()
      const vaultsUpgraded = await preferences.getBool(
        PreferencesEnum.vaultsUpgraded
      )
      const legacyDataFound = await preferences.getBool(
        PreferencesEnum.legacyDataFound
      )

      if (!MIGRATION_FLOW_ENABLED) {
        setRootRoute('Migration')
      } else if (
        loaded.length > 0 &&
        !vaultsUpgraded &&
        legacyDataFound
      ) {
        setRootRoute('Migration')
      } else if (loaded.length === 0) {
        // In dev mode, show Auth first so E2E dev seed buttons are accessible.
        // In production, brand new users go straight to the migration/creation flow.
        setRootRoute(__DEV__ ? 'Auth' : 'Migration')
      } else {
        setRootRoute('Main')
      }
    }
    init().catch(() => {
      setWallets([])
      setRootRoute('Auth')
    })
  }, [loadWallets])

  const onMigrationComplete = useCallback(async () => {
    try {
      await loadWallets()
    } catch {
      // Wallet loading failed — still transition to Main so the user isn't stuck
    }
    setMigrationEntry('default')
    setRootRoute('Main')
  }, [loadWallets])

  const refreshWallets = useCallback(async () => {
    await loadWallets()
  }, [loadWallets])

  const onWalletDisconnected = useCallback(async () => {
    const loaded = await loadWallets()
    if (loaded.length === 0) {
      setRootRoute('Auth')
    }
  }, [loadWallets])

  const goToMigration = useCallback(() => {
    setMigrationEntry('default')
    setRootRoute('Migration')
  }, [])

  const startCreateVault = useCallback(() => {
    preMigrationRootRef.current = rootRouteRef.current
    setMigrationEntry('create-vault')
    setRootRoute('Migration')
  }, [])

  /**
   * Routes to RecoverSeed, which captures the user's seed into
   * RecoverWalletStore then navigates within the Migration stack to VaultName
   * in recover-seed mode.
   */
  const startSeedRecoveryInput = useCallback(() => {
    preMigrationRootRef.current = rootRouteRef.current
    setMigrationEntry('recover-seed-input')
    setRootRoute('Migration')
  }, [])

  const startImportVault = useCallback(() => {
    preMigrationRootRef.current = rootRouteRef.current
    setMigrationEntry('import-vault')
    setRootRoute('Migration')
  }, [])

  const goToAuth = useCallback(() => {
    setMigrationEntry('default')
    setRootRoute('Auth')
  }, [])

  const goHome = useCallback(() => {
    setMigrationEntry('default')
    const origin = preMigrationRootRef.current
    preMigrationRootRef.current = null
    if (origin === 'Auth' || origin === 'Main') {
      setRootRoute(origin)
      return
    }
    // No tracked origin (deep link, cold start, etc.) — fall back to a
    // wallet-count heuristic so the user still lands somewhere sensible.
    if ((wallets?.length ?? 0) > 0) {
      setRootRoute('Main')
    } else {
      setRootRoute(__DEV__ ? 'Auth' : 'Migration')
    }
  }, [wallets])

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background:
          themes?.[currentTheme]?.backgroundColor || COLORS.bg,
      },
    }),
    [currentTheme]
  )

  const walletNavValue = useMemo(
    () => ({
      onWalletDisconnected,
      goToMigration,
      goToAuth,
      goHome,
      startCreateVault,
      startSeedRecoveryInput,
      startImportVault,
      wallets,
      refreshWallets,
    }),
    [
      onWalletDisconnected,
      goToMigration,
      goToAuth,
      goHome,
      startCreateVault,
      startSeedRecoveryInput,
      startImportVault,
      wallets,
      refreshWallets,
    ]
  )

  const migrationValue = useMemo(
    () => ({ onMigrationComplete }),
    [onMigrationComplete]
  )

  if (rootRoute === null || wallets === null) return null

  return (
    <WalletNavContext.Provider value={walletNavValue}>
      <MigrationContext.Provider value={migrationValue}>
        <NavigationContainer theme={navTheme}>
          {rootRoute === 'Migration' ? (
            <MigrationNavigator initialEntry={migrationEntry} />
          ) : rootRoute === 'Main' ? (
            <MainNavigator />
          ) : (
            <AuthNavigator />
          )}
        </NavigationContainer>
      </MigrationContext.Provider>
    </WalletNavContext.Provider>
  )
}
