/**
 * Alerts Screen
 *
 * Full-screen view of all market alerts from n8n workflows.
 * Supports filtering, dismissing, and marking as read.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, shadows, radii } from '../src/theme'
import { AlertSettingsModal } from '../src/components/AlertSettingsModal'
import {
  intelligenceService,
  getSeverityColor,
  getSeverityLabel,
  getAlertTypeIcon,
} from '../src/services/intelligenceService'
import type { MarketAlert, AlertSeverity, MarketAlertType } from '../src/types/intelligence'

// Filter chip options
const SEVERITY_FILTERS: { value: AlertSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'significant', label: 'Important' },
  { value: 'notable', label: 'Notable' },
  { value: 'info', label: 'Info' },
]

export default function AlertsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [alerts, setAlerts] = useState<MarketAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | 'all'>('all')
  const [showSettings, setShowSettings] = useState(false)

  // Multi-select mode state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set())
  const [processingBulk, setProcessingBulk] = useState(false)

  // Load alerts
  const loadAlerts = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)

    try {
      const options: Parameters<typeof intelligenceService.getMarketAlerts>[0] = {
        limit: 100,
      }

      if (selectedSeverity !== 'all') {
        options.severity = [selectedSeverity]
      }

      const { data } = await intelligenceService.getMarketAlerts(options)
      setAlerts(data)
    } catch (err) {
      console.error('Error loading alerts:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedSeverity])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // Handle dismiss
  const handleDismiss = useCallback(async (alertId: string) => {
    await intelligenceService.dismissAlert(alertId)
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }, [])

  // Handle mark as read
  const handleMarkRead = useCallback(async (alertId: string) => {
    await intelligenceService.markAlertRead(alertId)
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, is_read: true, read_at: new Date().toISOString() } : a
      )
    )
  }, [])

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    await intelligenceService.markAllAlertsRead()
    setAlerts((prev) =>
      prev.map((a) => ({ ...a, is_read: true, read_at: new Date().toISOString() }))
    )
  }, [])

  // Multi-select handlers
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => !prev)
    setSelectedAlertIds(new Set())
  }, [])

  const toggleAlertSelection = useCallback((alertId: string) => {
    setSelectedAlertIds((prev) => {
      const updated = new Set(prev)
      if (updated.has(alertId)) {
        updated.delete(alertId)
      } else {
        updated.add(alertId)
      }
      return updated
    })
  }, [])

  const selectAllAlerts = useCallback(() => {
    setSelectedAlertIds(new Set(alerts.map((a) => a.id)))
  }, [alerts])

  const deselectAllAlerts = useCallback(() => {
    setSelectedAlertIds(new Set())
  }, [])

  // Bulk dismiss selected alerts
  const handleBulkDismiss = useCallback(async () => {
    if (selectedAlertIds.size === 0) return

    setProcessingBulk(true)
    try {
      const selectedIds = Array.from(selectedAlertIds)
      for (const alertId of selectedIds) {
        await intelligenceService.dismissAlert(alertId)
      }

      setAlerts((prev) => prev.filter((a) => !selectedAlertIds.has(a.id)))
      setSelectedAlertIds(new Set())
      setIsSelectMode(false)
    } catch (err) {
      console.error('Error bulk dismissing:', err)
    } finally {
      setProcessingBulk(false)
    }
  }, [selectedAlertIds])

  // Bulk mark selected as read
  const handleBulkMarkRead = useCallback(async () => {
    if (selectedAlertIds.size === 0) return

    setProcessingBulk(true)
    try {
      const selectedIds = Array.from(selectedAlertIds)
      for (const alertId of selectedIds) {
        await intelligenceService.markAlertRead(alertId)
      }

      setAlerts((prev) =>
        prev.map((a) =>
          selectedAlertIds.has(a.id)
            ? { ...a, is_read: true, read_at: new Date().toISOString() }
            : a
        )
      )
      setSelectedAlertIds(new Set())
      setIsSelectMode(false)
    } catch (err) {
      console.error('Error bulk marking read:', err)
    } finally {
      setProcessingBulk(false)
    }
  }, [selectedAlertIds])

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Render alert item
  const renderAlert = ({ item }: { item: MarketAlert }) => {
    const severityColor = getSeverityColor(item.severity)
    const icon = getAlertTypeIcon(item.alert_type)
    const isSelected = selectedAlertIds.has(item.id)

    return (
      <TouchableOpacity
        style={[
          styles.alertCard,
          !item.is_read && styles.alertCardUnread,
          isSelectMode && isSelected && styles.alertCardSelected,
        ]}
        onPress={() => {
          if (isSelectMode) {
            toggleAlertSelection(item.id)
          } else {
            handleMarkRead(item.id)
          }
        }}
        activeOpacity={0.7}
      >
        {/* Checkbox when in select mode */}
        {isSelectMode && (
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleAlertSelection(item.id)}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? colors.brand[600] : colors.slate[400]}
            />
          </TouchableOpacity>
        )}

        {/* Severity indicator */}
        <View style={[styles.severityBar, { backgroundColor: severityColor }]} />

        <View style={styles.alertContent}>
          {/* Header row */}
          <View style={styles.alertHeader}>
            <Text style={styles.alertIcon}>{icon}</Text>
            <View style={styles.alertMeta}>
              <Text style={[styles.severityBadge, { backgroundColor: severityColor + '20', color: severityColor }]}>
                {getSeverityLabel(item.severity)}
              </Text>
              <Text style={styles.alertTime}>{formatTime(item.created_at)}</Text>
            </View>
          </View>

          {/* Title and description */}
          <Text style={styles.alertTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.alertDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Location */}
          {item.zip_code && (
            <Text style={styles.alertLocation}>
              {item.zip_code}
              {item.city ? ` - ${item.city}` : ''}
              {item.state ? `, ${item.state}` : ''}
            </Text>
          )}

          {/* Actions - hidden in select mode */}
          {!isSelectMode && (
            <View style={styles.alertActions}>
              {!item.is_read && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleMarkRead(item.id)}
                >
                  <Text style={styles.actionButtonText}>Mark Read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.dismissButton]}
                onPress={() => handleDismiss(item.id)}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No Alerts</Text>
      <Text style={styles.emptyText}>
        Market alerts from your tracked ZIP codes will appear here.
      </Text>
    </View>
  )

  // Count unread
  const unreadCount = alerts.filter((a) => !a.is_read).length

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: isSelectMode ? `${selectedAlertIds.size} Selected` : 'Market Alerts',
          headerLeft: isSelectMode
            ? () => (
                <TouchableOpacity onPress={toggleSelectMode} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Cancel</Text>
                </TouchableOpacity>
              )
            : undefined,
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              {isSelectMode ? (
                <TouchableOpacity
                  onPress={selectedAlertIds.size === alerts.length ? deselectAllAlerts : selectAllAlerts}
                  style={styles.headerButton}
                >
                  <Text style={styles.headerButtonText}>
                    {selectedAlertIds.size === alerts.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  {alerts.length > 0 && (
                    <TouchableOpacity onPress={toggleSelectMode} style={styles.headerIconButton}>
                      <Ionicons name="checkbox-outline" size={22} color={colors.slate[600]} />
                    </TouchableOpacity>
                  )}
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerButton}>
                      <Text style={styles.headerButtonText}>Mark All Read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowSettings(true)}
                    style={styles.headerIconButton}
                  >
                    <Ionicons name="settings-outline" size={22} color={colors.slate[600]} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ),
        }}
      />

      {/* Filter chips */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SEVERITY_FILTERS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedSeverity === item.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSeverity(item.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeverity === item.value && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Alerts list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlert}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={alerts.length === 0 ? styles.emptyList : styles.alertList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAlerts(true)}
              colors={[colors.brand[600]]}
              tintColor={colors.brand[600]}
            />
          }
        />
      )}

      {/* Bulk Action Bar */}
      {isSelectMode && selectedAlertIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity
            style={[styles.bulkActionButton, styles.bulkMarkReadButton]}
            onPress={handleBulkMarkRead}
            disabled={processingBulk}
          >
            {processingBulk ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                <Text style={styles.bulkActionText}>Mark Read</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bulkActionButton, styles.bulkDismissButton]}
            onPress={handleBulkDismiss}
            disabled={processingBulk}
          >
            {processingBulk ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.white} />
                <Text style={styles.bulkActionText}>Dismiss</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Settings Modal */}
      <AlertSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    color: colors.brand[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  headerIconButton: {
    padding: spacing.xs,
  },
  filterContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  filterList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.brand[600],
  },
  filterChipText: {
    color: colors.slate[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
    marginTop: spacing.md,
  },
  alertList: {
    padding: spacing.md,
    gap: spacing.md,
  },
  emptyList: {
    flex: 1,
  },
  alertCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.soft,
  },
  alertCardUnread: {
    borderLeftWidth: 0,
  },
  alertCardSelected: {
    backgroundColor: colors.brand[50],
    borderWidth: 2,
    borderColor: colors.brand[500],
  },
  checkbox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  severityBar: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  alertIcon: {
    fontSize: 20,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    overflow: 'hidden',
  },
  alertTime: {
    color: colors.slate[400],
    fontSize: typography.fontSize.xs,
  },
  alertTitle: {
    color: colors.slate[800],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  alertDescription: {
    color: colors.slate[600],
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  alertLocation: {
    color: colors.slate[500],
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.sm,
  },
  alertActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand[50],
    borderRadius: radii.sm,
  },
  actionButtonText: {
    color: colors.brand[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dismissButton: {
    backgroundColor: colors.slate[100],
  },
  dismissButtonText: {
    color: colors.slate[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.slate[700],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  bulkActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    gap: spacing.md,
  },
  bulkActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  bulkMarkReadButton: {
    backgroundColor: colors.brand[600],
  },
  bulkDismissButton: {
    backgroundColor: colors.error[500],
  },
  bulkActionText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
})
