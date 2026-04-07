import { createContext, useContext } from 'react'

interface MigrationContextValue {
  onMigrationComplete: () => void
}

export const MigrationContext = createContext<MigrationContextValue>({
  onMigrationComplete: () => {},
})

export const useMigrationComplete = () => useContext(MigrationContext).onMigrationComplete
