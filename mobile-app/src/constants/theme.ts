import '@/global.css'
import { Platform } from 'react-native'

// ─── Design System ────────────────────────────────────────────────────────────
// Single source of truth for all visual tokens.
// Import DESIGN from here; import COLORS from colors.ts for legacy compat.

export const DESIGN = {
  colors: {
    primary:     '#4CAF8D',
    primaryDark: '#2F8F73',
    primaryLight:'#E8F7F2',

    background:  '#F8FAFC',
    surface:     '#FFFFFF',
    surfaceAlt:  '#F1F5F9',

    text:        '#111827',
    textSub:     '#6B7280',
    muted:       '#94A3B8',
    border:      '#E5E7EB',

    success:     '#22C55E',
    successBg:   '#F0FDF4',
    successText: '#15803D',

    warning:     '#F59E0B',
    warningBg:   '#FFFBEB',
    warningText: '#B45309',

    error:       '#EF4444',
    errorBg:     '#FEF2F2',
    errorText:   '#DC2626',

    info:        '#3B82F6',
    infoBg:      '#EFF6FF',
    infoText:    '#1D4ED8',
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '800' as const },
    h2: { fontSize: 22, fontWeight: '700' as const },
    h3: { fontSize: 18, fontWeight: '700' as const },
    h4: { fontSize: 16, fontWeight: '700' as const },
    h5: { fontSize: 14, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    bodySmall: { fontSize: 13, fontWeight: '400' as const },
    caption: { fontSize: 11, fontWeight: '400' as const },
    label: { fontSize: 12, fontWeight: '600' as const },
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  },
  radius: {
    sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999,
  },
  shadows: {
    card: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    sm: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  },
} as const

// ─── Legacy exports (keep old code working) ──────────────────────────────────
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark

export const Fonts = Platform.select({
  ios:     { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web:     { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
})

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0
export const MaxContentWidth = 800
