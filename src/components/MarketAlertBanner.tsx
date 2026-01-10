/**
 * MarketAlertBanner
 *
 * Shows urgent/significant market alerts at the top of screens.
 * Tappable to navigate to full alerts screen.
 * Displays below OfflineBanner when both are visible.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, typography } from '../theme'
import {
  intelligenceService,
  getSeverityColor,
  getAlertTypeIcon,
} from '../services/intelligenceService'
import type { MarketAlert } from '../types/intelligence'

interface MarketAlertBannerProps {
  /** Maximum number of alerts to show in rotation */
  maxAlerts?: number
  /** Auto-rotate through multiple alerts */
  autoRotate?: boolean
  /** Rotation interval in ms */
  rotateInterval?: number
}

export function MarketAlertBanner({
  maxAlerts = 3,
  autoRotate = true,
  rotateInterval = 5000,
}: MarketAlertBannerProps) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<MarketAlert[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load urgent alerts
  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await intelligenceService.getUrgentAlerts(maxAlerts)
      setAlerts(data)

      const { data: count } = await intelligenceService.getUnreadAlertCount()
      setUnreadCount(count)
    } catch (err) {
      console.error('Error loading alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [maxAlerts])

  useEffect(() => {
    loadAlerts()

    // Refresh alerts periodically
    const refreshInterval = setInterval(loadAlerts, 60000) // Every minute
    return () => clearInterval(refreshInterval)
  }, [loadAlerts])

  // Auto-rotate through alerts
  useEffect(() => {
    if (!autoRotate || alerts.length <= 1) return

    const rotateTimer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length)
    }, rotateInterval)

    return () => clearInterval(rotateTimer)
  }, [autoRotate, alerts.length, rotateInterval])

  // Handle banner tap
  const handlePress = useCallback(() => {
    router.push('/alerts')
  }, [router])

  // Handle dismiss current alert
  const handleDismiss = useCallback(async () => {
    if (alerts.length === 0) return

    const alertId = alerts[currentIndex].id
    await intelligenceService.dismissAlert(alertId)

    // Remove from local state
    const newAlerts = alerts.filter((a) => a.id !== alertId)
    setAlerts(newAlerts)
    setUnreadCount((prev) => Math.max(0, prev - 1))

    // Reset index if needed
    if (currentIndex >= newAlerts.length) {
      setCurrentIndex(0)
    }
  }, [alerts, currentIndex])

  // Don't show if loading or no alerts
  if (loading) {
    return null
  }

  if (alerts.length === 0) {
    return null
  }

  const currentAlert = alerts[currentIndex]
  const severityColor = getSeverityColor(currentAlert.severity)
  const icon = getAlertTypeIcon(currentAlert.alert_type)

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: severityColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {/* Icon */}
        <Text style={styles.icon}>{icon}</Text>

        {/* Alert content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentAlert.title}
          </Text>
          {currentAlert.zip_code && (
            <Text style={styles.subtitle}>
              {currentAlert.zip_code}
              {currentAlert.city ? ` - ${currentAlert.city}` : ''}
            </Text>
          )}
        </View>

        {/* Badge for additional alerts */}
        {unreadCount > 1 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{unreadCount - 1}</Text>
          </View>
        )}

        {/* Dismiss button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dismissText}>x</Text>
        </TouchableOpacity>
      </View>

      {/* Pagination dots */}
      {alerts.length > 1 && (
        <View style={styles.pagination}>
          {alerts.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  dismissButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dismissText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: colors.white,
  },
})

export default MarketAlertBanner
