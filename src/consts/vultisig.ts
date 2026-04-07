/**
 * Vultisig brand design tokens.
 * Used across migration screens and restyled wallet views.
 * Aligns with the Vultisig desktop/iOS app visual identity.
 */
export const VULTISIG = {
  // Core palette
  bg: '#02122B',
  surface: '#061B3A',
  surfaceLight: '#0A2550',
  card: '#0D1F3C',
  cardBorder: 'rgba(51, 204, 187, 0.15)',

  // Brand accent — Vultisig teal
  accent: '#33CCBB',
  accentDim: 'rgba(51, 204, 187, 0.3)',
  accentGlow: 'rgba(51, 204, 187, 0.12)',

  // Text
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  textAccent: '#33CCBB',

  // Semantic
  success: '#33CCBB',
  error: '#FF5C5C',
  warning: '#FFB340',

  // Spacing
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusPill: 30,
} as const
