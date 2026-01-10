/**
 * DealTimelinePreview
 *
 * Expandable timeline showing recent activity for a deal.
 * Shows last 5 activities inline on the deal card.
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { colors, spacing, typography, radii } from '../theme'
import { getDealActivityTimeline, type ActivityEvent } from '../services/data'

interface DealTimelinePreviewProps {
  dealId: string
  expanded: boolean
  onToggle: () => void
}

export function DealTimelinePreview({ dealId, expanded, onToggle }: DealTimelinePreviewProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (expanded && !loaded) {
      loadActivities()
    }
  }, [expanded, loaded])

  const loadActivities = async () => {
    setLoading(true)
    try {
      const { data, error } = await getDealActivityTimeline(dealId, 5)
      if (!error && data) {
        setActivities(data)
      }
    } catch (err) {
      console.error('Failed to load timeline:', err)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  const getEventIcon = (eventType: string): string => {
    const icons: Record<string, string> = {
      stage_change: '→',
      note_added: '📝',
      task_completed: '✓',
      call_made: '📞',
      email_sent: '📧',
      document_added: '📄',
      analysis_run: '📊',
      price_updated: '💰',
      created: '✨',
    }
    return icons[eventType] || '•'
  }

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.toggleIcon}>{expanded ? '▼' : '▶'}</Text>
        <Text style={styles.toggleText}>Activity</Text>
        {activities.length > 0 && !expanded && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{activities.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.timeline}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brand[500]} style={styles.loader} />
          ) : activities.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet</Text>
          ) : (
            activities.map((activity, index) => (
              <View key={activity.id || index} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                  <Text style={styles.dotIcon}>{getEventIcon(activity.event_type)}</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.eventText} numberOfLines={1}>
                    {activity.description || activity.event_type.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.eventTime}>{formatTimeAgo(activity.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
    fontSize: 10,
    color: colors.slate[400],
    marginRight: spacing.xs,
  },
  toggleText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    fontWeight: typography.fontWeight.medium,
  },
  countBadge: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: spacing.xs,
  },
  countText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
  timeline: {
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  loader: {
    paddingVertical: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  dotIcon: {
    fontSize: 10,
    color: colors.slate[600],
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    marginRight: spacing.sm,
  },
  eventTime: {
    fontSize: 10,
    color: colors.slate[400],
  },
})

export default DealTimelinePreview
