/**
 * Notification Service
 *
 * Handles push notification registration, permissions, and token management.
 * Integrates with Supabase to store push tokens for n8n workflow notifications.
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from '../lib/supabase'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Get Expo project ID for push notifications
 */
function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId
}

/**
 * Register for push notifications and get Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if device is physical (push notifications don't work on simulator)
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device')
    return null
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted')
    return null
  }

  // Get project ID
  const projectId = getProjectId()
  if (!projectId) {
    console.warn('[Notifications] No project ID found in expo config')
    return null
  }

  try {
    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    })

    console.log('[Notifications] Push token:', tokenData.data)

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      })

      await Notifications.setNotificationChannelAsync('market-alerts', {
        name: 'Market Alerts',
        description: 'Urgent market alerts from n8n workflows',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
      })
    }

    return tokenData.data
  } catch (err) {
    console.error('[Notifications] Failed to get push token:', err)
    return null
  }
}

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/**
 * Check if notification permissions are granted
 */
export async function checkPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  return status === 'granted'
}

/**
 * Save push token to Supabase for n8n to send notifications
 */
export async function savePushTokenToSupabase(token: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[Notifications] No user logged in, cannot save push token')
      return false
    }

    // Upsert token (update if exists, insert if not)
    const { error } = await supabase
      .from('dealroom_push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: token,
          device_type: Platform.OS,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'expo_push_token',
        }
      )

    if (error) {
      console.error('[Notifications] Failed to save push token:', error)
      return false
    }

    console.log('[Notifications] Push token saved to Supabase')
    return true
  } catch (err) {
    console.error('[Notifications] Error saving push token:', err)
    return false
  }
}

/**
 * Deactivate push token (when user disables notifications)
 */
export async function deactivatePushToken(token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('dealroom_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('expo_push_token', token)

    if (error) {
      console.error('[Notifications] Failed to deactivate push token:', error)
      return false
    }

    console.log('[Notifications] Push token deactivated')
    return true
  } catch (err) {
    console.error('[Notifications] Error deactivating push token:', err)
    return false
  }
}

/**
 * Remove push token from Supabase (on logout)
 */
export async function removePushToken(token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('dealroom_push_tokens')
      .delete()
      .eq('expo_push_token', token)

    if (error) {
      console.error('[Notifications] Failed to remove push token:', error)
      return false
    }

    console.log('[Notifications] Push token removed')
    return true
  } catch (err) {
    console.error('[Notifications] Error removing push token:', err)
    return false
  }
}

/**
 * Handle a received notification (while app is foregrounded)
 */
export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  const { title, body, data } = notification.request.content
  console.log('[Notifications] Received:', { title, body, data })

  // You can add custom handling here based on notification data
  // For example, update badge count, trigger UI updates, etc.
}

/**
 * Handle notification tap (user tapped on notification)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): { type: string; id?: string } | null {
  const { data } = response.notification.request.content

  console.log('[Notifications] User tapped notification:', data)

  // Return navigation info based on notification data
  if (data) {
    const notificationData = data as Record<string, unknown>

    if (notificationData.type === 'market_alert' && notificationData.alert_id) {
      return { type: 'market_alert', id: notificationData.alert_id as string }
    }

    if (notificationData.type === 'motivation_update' && notificationData.lead_id) {
      return { type: 'motivation_update', id: notificationData.lead_id as string }
    }

    if (notificationData.type === 'deal_update' && notificationData.deal_id) {
      return { type: 'deal_update', id: notificationData.deal_id as string }
    }
  }

  return null
}

/**
 * Get the current notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync()
}

/**
 * Set the notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count)
}

/**
 * Clear all delivered notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync()
}

/**
 * Schedule a local notification (for testing or reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds: number = 5
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  })

  return id
}

/**
 * Notification Service object export
 */
export const notificationService = {
  registerForPushNotifications,
  requestPermissions,
  checkPermissions,
  savePushTokenToSupabase,
  deactivatePushToken,
  removePushToken,
  handleNotificationReceived,
  handleNotificationResponse,
  getBadgeCount,
  setBadgeCount,
  clearAllNotifications,
  scheduleLocalNotification,
}

export default notificationService
