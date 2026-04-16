/**
 * Design tokens from Figma "Migration old station" section.
 * These match the Vultisig dark theme used across all migration screens.
 * See: docs/designs/migration/*.png for visual reference.
 */
export const MIGRATION = {
  // Backgrounds
  bg: '#02122b',
  surface1: '#061b3a',
  surface1_2: '#0d2240',

  // Borders
  borderLight: '#11284a',
  borderExtraLight: 'rgba(255,255,255,0.03)',
  strokeInput: '#1b3f73',

  // Text
  textPrimary: '#f0f4fc',
  textTertiary: '#8295ae',
  textLink: '#4879fd',
  textInputPlaceholder: '#8295ae',

  // Status
  errorRed: '#ff5c5c',
  successGreen: '#13c89d',

  // Buttons
  ctaBlue: '#0b4eff',
  buttonSecondary: '#11284a',
  buttonDisabled: '#0b1a3a',

  // Station brand (for landing/wizard 1)
  stationBlue: '#2044b5',

  // Radii
  radiusPill: 99,
  radiusCard: 24,
  radiusSmallButton: 30,

  // Spacing
  screenPadding: 16,
  cardPadding: 20,
  cardGap: 12,

  // Button sizes
  ctaHeight: 46,
  smallButtonHeight: 42,
} as const
