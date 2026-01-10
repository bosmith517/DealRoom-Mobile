/**
 * FlipMantis Mobile Theme Tokens
 *
 * Brand-consistent design system matching the web app.
 * Uses React Native StyleSheet conventions (not Tailwind).
 * Supports light and dark mode via ThemeProvider.
 */

// ============================================================================
// LIGHT MODE COLORS
// ============================================================================

export const lightColors = {
  // Sage green brand palette
  brand: {
    50: '#f2fbf4',
    100: '#e3f7e8',
    200: '#c1eecd',
    300: '#95e1aa',
    400: '#5ccc7b',
    500: '#34b55a',  // Primary
    600: '#279548',  // Primary dark
    700: '#21753d',
    800: '#1f5d34',
    900: '#194d2c',
  },

  // Background colors
  paper: '#fbfbfc',
  white: '#ffffff',

  // Text colors
  ink: '#0f172a',
  inkLight: '#334155',
  inkMuted: '#64748b',

  // Slate palette (neutrals)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Status colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  // Transparent overlays
  overlay: {
    light: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.08)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
} as const

// ============================================================================
// DARK MODE COLORS
// ============================================================================

export const darkColors = {
  // Sage green brand palette (slightly adjusted for dark mode)
  brand: {
    50: '#0f2918',
    100: '#153620',
    200: '#1f5d34',
    300: '#21753d',
    400: '#279548',
    500: '#34b55a',  // Primary
    600: '#5ccc7b',  // Primary lighter in dark mode
    700: '#95e1aa',
    800: '#c1eecd',
    900: '#e3f7e8',
  },

  // Background colors (inverted)
  paper: '#0f172a',
  white: '#1e293b',

  // Text colors (inverted)
  ink: '#f8fafc',
  inkLight: '#e2e8f0',
  inkMuted: '#94a3b8',

  // Slate palette (inverted for dark mode)
  slate: {
    50: '#0f172a',
    100: '#1e293b',
    200: '#334155',
    300: '#475569',
    400: '#64748b',
    500: '#94a3b8',
    600: '#cbd5e1',
    700: '#e2e8f0',
    800: '#f1f5f9',
    900: '#f8fafc',
  },

  // Status colors (adjusted for dark mode visibility)
  success: {
    50: '#052e16',
    100: '#14532d',
    200: '#166534',
    500: '#22c55e',
    600: '#4ade80',
    700: '#86efac',
  },
  warning: {
    50: '#451a03',
    100: '#78350f',
    200: '#92400e',
    500: '#f59e0b',
    600: '#fbbf24',
    700: '#fcd34d',
  },
  error: {
    50: '#450a0a',
    100: '#7f1d1d',
    200: '#991b1b',
    500: '#ef4444',
    600: '#f87171',
    700: '#fca5a5',
  },
  info: {
    50: '#172554',
    100: '#1e3a8a',
    200: '#1e40af',
    500: '#3b82f6',
    600: '#60a5fa',
    700: '#93c5fd',
  },

  // Transparent overlays (adjusted for dark mode)
  overlay: {
    light: 'rgba(255, 255, 255, 0.04)',
    medium: 'rgba(255, 255, 255, 0.08)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },
} as const

// Default export (light mode for backward compatibility)
export const colors = {
  // Sage green brand palette
  brand: {
    50: '#f2fbf4',
    100: '#e3f7e8',
    200: '#c1eecd',
    300: '#95e1aa',
    400: '#5ccc7b',
    500: '#34b55a',  // Primary
    600: '#279548',  // Primary dark
    700: '#21753d',
    800: '#1f5d34',
    900: '#194d2c',
  },

  // Background colors
  paper: '#fbfbfc',
  white: '#ffffff',

  // Text colors
  ink: '#0f172a',
  inkLight: '#334155',
  inkMuted: '#64748b',

  // Slate palette (neutrals)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Status colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  // Transparent overlays
  overlay: {
    light: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.08)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
} as const

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const

// ============================================================================
// SHADOWS (iOS + Android)
// ============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  softMd: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  softLg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  // Alias for components using generic names
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
} as const

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Line heights (multipliers)
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const components = {
  // Button heights
  button: {
    height: {
      sm: 36,
      md: 44,
      lg: 52,
    },
    paddingHorizontal: {
      sm: 12,
      md: 16,
      lg: 20,
    },
  },

  // Input heights
  input: {
    height: {
      sm: 40,
      md: 48,
      lg: 56,
    },
    borderWidth: 1,
  },

  // Card styles
  card: {
    base: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    padding: {
      sm: 12,
      md: 16,
      lg: 24,
    },
    header: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    headerBordered: {
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
    },
    body: {
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    footer: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    footerBordered: {
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
    },
  },

  // Bottom tab bar
  tabBar: {
    height: 84,
    iconSize: 24,
  },

  // Header
  header: {
    height: 56,
  },
} as const

// ============================================================================
// ANIMATION DURATIONS
// ============================================================================

export const animation = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const

// ============================================================================
// THEME OBJECT (combined)
// ============================================================================

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  components,
  animation,
} as const

export type Theme = typeof theme
export type Colors = typeof colors
export type LightColors = typeof lightColors
export type DarkColors = typeof darkColors
export type Spacing = typeof spacing
export type Radii = typeof radii
