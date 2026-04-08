import { COLORS } from './theme'

/**
 * Vultisig brand design tokens.
 * Used across migration screens and restyled wallet views.
 * Shared base colors come from COLORS; brand-specific teal accent is unique here.
 */
export const VULTISIG = {
  // Core palette (shared with app theme)
  bg: COLORS.bg,
  surface: COLORS.surface,
  surfaceLight: '#0A2550',
  card: '#0D1F3C',
  cardBorder: 'rgba(51, 204, 187, 0.15)',

  // Brand accent — Vultisig teal (distinct from COLORS.accent)
  accent: '#33CCBB',
  accentDim: 'rgba(51, 204, 187, 0.3)',
  accentGlow: 'rgba(51, 204, 187, 0.12)',

  // Text (shared with app theme)
  textPrimary: COLORS.textPrimary,
  textSecondary: COLORS.textSecondary,
  textAccent: '#33CCBB',

  // Semantic
  success: '#33CCBB',
  error: COLORS.error,
  warning: COLORS.warning,

  // Spacing
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusPill: 30,
} as const
