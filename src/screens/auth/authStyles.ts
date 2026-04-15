import { StyleSheet } from 'react-native'
import { COLORS } from 'consts/theme'

const authStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 32,
  },
  inputGroup: { marginBottom: 24 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
  button: {
    backgroundColor: '#0B4EFF',
    borderRadius: 99,
    height: 46,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 'auto' as const,
    overflow: 'hidden' as const,
    boxShadow:
      '0 -1px 0.5px 0 #0F1C3E inset, 0 1px 1px 0 rgba(255, 255, 255, 0.10) inset',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerStyle: {
    backgroundColor: COLORS.bg,
    shadowColor: 'transparent',
  },
})

export const HEADER_TINT_COLOR = COLORS.textPrimary

export default authStyles
