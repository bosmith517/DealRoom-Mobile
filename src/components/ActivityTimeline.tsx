/**
 * ActivityTimeline Component
 *
 * Displays a unified timeline of events for a lead or deal.
 * Shows: reach status changes, interactions (calls/texts/emails), and activity events.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'
import {
  getLeadActivityTimeline,
  getDealActivityTimeline,
  type ActivityEvent,
} from '../services'

// ============================================================================
// Types
// ============================================================================

interface ActivityTimelineProps {
  leadId?: string
  dealId?: string
  maxItems?: number
  showHeader?: boolean
}

// ============================================================================
// Icon & Color Mapping
// ============================================================================

function getEventIcon(event: ActivityEvent): keyof typeof Ionicons.glyphMap {
  // By event type within type
  if (event.type === 'interaction') {
    switch (event.event_type) {
      case 'call': return 'call-outline'
      case 'text': return 'chatbubble-outline'
      case 'email': return 'mail-outline'
      default: return 'chatbubbles-outline'
    }
  }

  if (event.type === 'reach_event') {
    return 'arrow-forward-circle-outline'
  }

  if (event.type === 'stage_change') {
    return 'git-branch-outline'
  }

  // Default
  return 'ellipse-outline'
}

function getEventColor(event: ActivityEvent): string {
  if (event.type === 'interaction') {
    switch (event.event_type) {
      case 'call': return colors.brand[500]
      case 'text': return colors.success[500]
      case 'email': return colors.warning[500]
      default: return colors.slate[500]
    }
  }

  if (event.type === 'reach_event') {
    // Color based on the target status
    if (event.title.includes('Outreach Ready')) return colors.success[500]
    if (event.title.includes('Contacted')) return colors.brand[500]
    if (event.title.includes('Converted')) return colors.success[600]
    if (event.title.includes('Dead')) return colors.error[500]
    if (event.title.includes('Failed')) return colors.error[400]
    return colors.slate[500]
  }

  if (event.type === 'stage_change') {
    return colors.brand[400]
  }

  return colors.slate[400]
}

// ============================================================================
// Component
// ============================================================================

export function ActivityTimeline({
  leadId,
  dealId,
  maxItems = 50,
  showHeader = true,
}: ActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      let data: ActivityEvent[] = []

      if (leadId) {
        data = await getLeadActivityTimeline(leadId)
      } else if (dealId) {
        data = await getDealActivityTimeline(dealId)
      }

      setEvents(data.slice(0, maxItems))
    } catch (err) {
      console.error('Error fetching activity timeline:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [leadId, dealId, maxItems])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchEvents()
  }, [fetchEvents])

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Render event item
  const renderEvent = ({ item, index }: { item: ActivityEvent; index: number }) => {
    const icon = getEventIcon(item)
    const color = getEventColor(item)
    const isLast = index === events.length - 1

    return (
      <View style={styles.eventRow}>
        {/* Timeline connector */}
        <View style={styles.timeline}>
          <View style={[styles.iconCircle, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
          {!isLast && <View style={styles.connector} />}
        </View>

        {/* Event content */}
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.eventTime}>{formatTime(item.created_at)}</Text>
          </View>
          {item.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    )
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.brand[500]} />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    )
  }

  // Empty state
  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={32} color={colors.slate[300]} />
        <Text style={styles.emptyText}>No activity yet</Text>
        <Text style={styles.emptySubtext}>Activity will appear here as you interact with this {leadId ? 'lead' : 'deal'}.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Ionicons name="time-outline" size={18} color={colors.ink} />
          <Text style={styles.headerTitle}>Activity Timeline</Text>
        </View>
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        scrollEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
  )
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
  },
  loadingText: {
    marginLeft: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  eventRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  timeline: {
    alignItems: 'center',
    width: 36,
    marginRight: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.slate[200],
    marginVertical: spacing.xs,
  },
  eventContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  eventTime: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  eventDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
})

export default ActivityTimeline
