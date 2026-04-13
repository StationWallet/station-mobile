import { createContext, useContext } from 'react'

interface MigrationContextValue {
  onMigrationComplete: () => void
}

export const MigrationContext = createContext<MigrationContextValue>({
  onMigrationComplete: (): void => {},
})

export const useMigrationComplete = (): (() => void) =>
  useContext(MigrationContext).onMigrationComplete
