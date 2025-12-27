/**
 * Theme Context
 *
 * Provides dynamic theme colors based on dark mode setting.
 * Reads from SettingsContext and provides the appropriate color palette.
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { useSettings } from './SettingsContext'
import { lightColors, darkColors, type Colors } from '../theme'

interface ThemeContextValue {
  colors: Colors
  isDarkMode: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings } = useSettings()
  const systemColorScheme = useColorScheme()

  // Determine if dark mode should be active
  // Currently uses the manual setting; could be extended to support "system" option
  const isDarkMode = settings.darkMode

  // Memoize the colors to prevent unnecessary re-renders
  const colors = useMemo(() => {
    return isDarkMode ? darkColors : lightColors
  }, [isDarkMode])

  const value = useMemo(() => ({
    colors: colors as Colors,
    isDarkMode,
  }), [colors, isDarkMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme colors
 * Returns the appropriate color palette based on dark mode setting
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback to light colors if not within provider
    // This allows components to work even without the provider
    return {
      colors: lightColors as Colors,
      isDarkMode: false,
    }
  }
  return context
}

/**
 * Hook to get just the colors (convenience wrapper)
 */
export function useColors(): Colors {
  const { colors } = useTheme()
  return colors
}
