/**
 * Settings Context
 *
 * Manages user preferences with AsyncStorage persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Types
export interface UserSettings {
  // Profile
  displayName: string

  // Deal Preferences
  preferredStrategies: ('flip' | 'brrrr' | 'wholesale' | 'hold')[]

  // Notifications
  notificationsEnabled: boolean
  pushNotifications: boolean
  emailNotifications: boolean
  smsNotifications: boolean

  // Appearance
  darkMode: boolean

  // Other
  offlineModeEnabled: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  displayName: '',
  preferredStrategies: ['flip', 'brrrr'],
  notificationsEnabled: true,
  pushNotifications: true,
  emailNotifications: true,
  smsNotifications: false,
  darkMode: false,
  offlineModeEnabled: true,
}

const STORAGE_KEY = '@dealroom:settings'

interface SettingsContextValue {
  settings: UserSettings
  loading: boolean
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  resetSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setSettings({ ...DEFAULT_SETTINGS, ...parsed })
        }
      } catch (err) {
        console.error('[Settings] Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    try {
      const newSettings = { ...settings, ...updates }
      setSettings(newSettings)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    } catch (err) {
      console.error('[Settings] Failed to save settings:', err)
      throw err
    }
  }, [settings])

  // Reset to defaults
  const resetSettings = useCallback(async () => {
    try {
      setSettings(DEFAULT_SETTINGS)
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.error('[Settings] Failed to reset settings:', err)
      throw err
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
