/**
 * NotificationContext
 *
 * Manages push notification state and registration.
 * Handles notification listeners and token management.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import {
  notificationService,
  registerForPushNotifications,
  savePushTokenToSupabase,
  deactivatePushToken,
  handleNotificationReceived,
  handleNotificationResponse,
} from '../services/notificationService'
import { useAuth } from './AuthContext'

interface NotificationContextType {
  /** Current push token (null if not registered) */
  pushToken: string | null
  /** Whether push notifications are enabled */
  isEnabled: boolean
  /** Whether permissions are granted */
  hasPermission: boolean
  /** Whether registration is in progress */
  isRegistering: boolean
  /** Unread notification count */
  unreadCount: number
  /** Register for push notifications */
  registerPush: () => Promise<boolean>
  /** Disable push notifications */
  disablePush: () => Promise<void>
  /** Set unread count */
  setUnreadCount: (count: number) => void
  /** Clear all notifications */
  clearNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [pushToken, setPushToken] = useState<string | null>(null)
  const [isEnabled, setIsEnabled] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Refs for notification listeners
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  // Check permissions on mount
  useEffect(() => {
    checkPermissionStatus()
  }, [])

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        handleNotificationReceived(notification)
        setUnreadCount((prev) => prev + 1)
      }
    )

    // Listener for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const navInfo = handleNotificationResponse(response)

        if (navInfo) {
          // Navigate based on notification type
          switch (navInfo.type) {
            case 'market_alert':
              router.push('/alerts')
              break
            case 'motivation_update':
              if (navInfo.id) {
                router.push(`/lead/${navInfo.id}`)
              }
              break
            case 'deal_update':
              if (navInfo.id) {
                router.push(`/property/${navInfo.id}`)
              }
              break
            default:
              // Default: go to dashboard
              router.push('/')
          }
        }
      }
    )

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current)
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current)
      }
    }
  }, [router])

  // Check current permission status
  const checkPermissionStatus = useCallback(async () => {
    const granted = await notificationService.checkPermissions()
    setHasPermission(granted)
  }, [])

  // Register for push notifications
  const registerPush = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('[NotificationContext] Cannot register without logged in user')
      return false
    }

    setIsRegistering(true)

    try {
      const token = await registerForPushNotifications()

      if (!token) {
        console.log('[NotificationContext] Failed to get push token')
        setIsRegistering(false)
        return false
      }

      // Save token to Supabase
      const saved = await savePushTokenToSupabase(token)

      if (saved) {
        setPushToken(token)
        setIsEnabled(true)
        setHasPermission(true)
        console.log('[NotificationContext] Push notifications enabled')
      }

      setIsRegistering(false)
      return saved
    } catch (err) {
      console.error('[NotificationContext] Registration failed:', err)
      setIsRegistering(false)
      return false
    }
  }, [user])

  // Disable push notifications
  const disablePush = useCallback(async (): Promise<void> => {
    if (pushToken) {
      await deactivatePushToken(pushToken)
    }
    setIsEnabled(false)
    console.log('[NotificationContext] Push notifications disabled')
  }, [pushToken])

  // Clear all notifications
  const clearNotifications = useCallback(async (): Promise<void> => {
    await notificationService.clearAllNotifications()
    await notificationService.setBadgeCount(0)
    setUnreadCount(0)
  }, [])

  const value: NotificationContextType = {
    pushToken,
    isEnabled,
    hasPermission,
    isRegistering,
    unreadCount,
    registerPush,
    disablePush,
    setUnreadCount,
    clearNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook to use notification context
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext
