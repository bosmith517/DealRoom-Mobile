/**
 * Settings Context
 *
 * Manages user preferences with AsyncStorage persistence.
 * Integrates with NotificationContext for push notification settings.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNotifications } from './NotificationContext'
import { useAuth } from './AuthContext'
import { profileService } from '../services/profileService'

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

const STORAGE_KEY_PREFIX = '@flipmantis:settings:'
const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`

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
  const { registerPush, disablePush, isEnabled: pushEnabled } = useNotifications()
  const { user } = useAuth()  // Track current user to reload settings on user change
  const isInitialMount = useRef(true)

  // Load settings when user changes
  // CRITICAL: Reset state immediately on user change to prevent profile bleed
  useEffect(() => {
    // Track if this effect is still current (prevents race conditions)
    let isCurrent = true

    // IMMEDIATELY reset to defaults when user changes
    // This ensures no stale data shows while loading
    setSettings(DEFAULT_SETTINGS)
    setLoading(true)

    async function loadSettings() {
      // If no user, stay at defaults (already set above)
      if (!user?.id) {
        if (isCurrent) {
          setLoading(false)
        }
        return
      }

      try {
        // Load local settings from AsyncStorage (user-specific key)
        const storageKey = getStorageKey(user.id)
        const stored = await AsyncStorage.getItem(storageKey)
        let localSettings = DEFAULT_SETTINGS
        if (stored) {
          const parsed = JSON.parse(stored)
          localSettings = { ...DEFAULT_SETTINGS, ...parsed }
        }

        // Load display name from database (source of truth)
        // SECURITY: Always use database value, even if empty - prevents cross-account leakage
        // NOTE: We pass user.id directly to avoid potential stale cached user in Supabase client
        try {
          const { data: profile } = await profileService.getProfileById(user.id)
          // Always set from database, defaulting to empty string if not set
          // This prevents stale cached names from appearing for different users
          localSettings.displayName = profile?.display_name || ''
        } catch (profileErr) {
          // On error, reset to empty to prevent showing wrong user's name
          console.warn('[Settings] Could not load profile from database, resetting displayName:', profileErr)
          localSettings.displayName = ''
        }

        // Only update if this effect is still current (user hasn't changed again)
        if (isCurrent) {
          setSettings(localSettings)
        }
      } catch (err) {
        console.error('[Settings] Failed to load settings:', err)
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    // Cleanup: mark this effect as stale if user changes before it completes
    return () => {
      isCurrent = false
    }
  }, [user?.id])  // Re-run when user changes (login/logout)

  // Sync push notifications state when setting changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Skip if still loading
    if (loading) return

    async function syncPushNotifications() {
      if (settings.pushNotifications && !pushEnabled) {
        // User enabled push - register
        const success = await registerPush()
        if (!success) {
          console.warn('[Settings] Failed to enable push notifications')
        }
      } else if (!settings.pushNotifications && pushEnabled) {
        // User disabled push - deactivate
        await disablePush()
      }
    }

    syncPushNotifications()
  }, [settings.pushNotifications, pushEnabled, loading, registerPush, disablePush])

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user?.id) {
      console.warn('[Settings] Cannot save settings - no user ID')
      return
    }
    try {
      const newSettings = { ...settings, ...updates }
      setSettings(newSettings)
      const storageKey = getStorageKey(user.id)
      await AsyncStorage.setItem(storageKey, JSON.stringify(newSettings))

      // Sync display name to database if it changed
      if (updates.displayName !== undefined) {
        try {
          await profileService.updateDisplayName(updates.displayName)
          console.log('[Settings] Display name synced to database')
        } catch (syncErr) {
          console.error('[Settings] Failed to sync display name to database:', syncErr)
          // Don't throw - local save succeeded
        }
      }
    } catch (err) {
      console.error('[Settings] Failed to save settings:', err)
      throw err
    }
  }, [settings, user?.id])

  // Reset to defaults
  const resetSettings = useCallback(async () => {
    if (!user?.id) {
      console.warn('[Settings] Cannot reset settings - no user ID')
      return
    }
    try {
      setSettings(DEFAULT_SETTINGS)
      const storageKey = getStorageKey(user.id)
      await AsyncStorage.removeItem(storageKey)
    } catch (err) {
      console.error('[Settings] Failed to reset settings:', err)
      throw err
    }
  }, [user?.id])

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
