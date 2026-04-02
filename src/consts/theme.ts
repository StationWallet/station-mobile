import { Platform } from 'react-native'

export const COLORS = {
  bg: '#02122B',
  surface: '#061B3A',
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  accent: '#0B4EFF',
  border: '#11284A',
  error: '#FF5C5C',
  success: '#18D2C3',
  warning: '#FFB340',
  inputBg: 'rgba(6,27,58,0.8)',
  disabled: '#1a2d4d',
  disabledText: '#4a5a72',
}

export const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

export const EXPLORER_URL = 'https://chainsco.pe/terra2/tx/'
