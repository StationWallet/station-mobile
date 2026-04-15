import { StyleSheet } from 'react-native'
import { MIGRATION } from 'consts/migration'

/** Shared styles for migration form screens (VaultName, VaultEmail, VaultPassword). */
export const formStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: MIGRATION.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    lineHeight: 24,
    letterSpacing: -0.36,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 20,
    marginBottom: 32,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  ctaButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
})
