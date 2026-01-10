/**
 * QuickWinCard
 *
 * Displays quick win suggestions/nudges on the dashboard:
 * - Follow up prompts
 * - Hot lead alerts
 * - Stuck deal reminders
 * - Callback suggestions
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { getQuickWinSuggestions, type QuickWin } from '../services/dashboardService'

interface QuickWinCardProps {
  limit?: number
}

export function QuickWinCard({ limit = 3 }: QuickWinCardProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<QuickWin[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    const { data, error } = await getQuickWinSuggestions(limit + 2) // Fetch extra in case some are dismissed
    if (!error) {
      setSuggestions(data)
    }
    setLoading(false)
  }

  const handlePress = (suggestion: QuickWin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Navigate based on entity type
    switch (suggestion.entity_type) {
      case 'lead':
        router.push(`/lead/${suggestion.entity_id}`)
        break
      case 'deal':
        router.push(`/property/${suggestion.entity_id}`)
        break
      case 'contact':
        router.push(`/contact/${suggestion.entity_id}`)
        break
      case 'followup':
        router.push('/tasks')
        break
      default:
        router.push('/tasks')
    }
  }

  const handleDismiss = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setDismissed(new Set([...dismissed, id]))
  }

  const getTypeIcon = (type: QuickWin['type']): string => {
    const icons: Record<string, string> = {
      follow_up: '📞',
      hot_lead: '🔥',
      stuck_deal: '⏰',
      callback: '📋',
    }
    return icons[type] || '💡'
  }

  const getPriorityColor = (priority: QuickWin['priority']): string => {
    const colors_map: Record<string, string> = {
      high: colors.error[500],
      medium: colors.warning[500],
      low: colors.slate[400],
    }
    return colors_map[priority] || colors.slate[400]
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id)).slice(0, limit)

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quick Wins</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand[500]} />
        </View>
      </View>
    )
  }

  if (visibleSuggestions.length === 0) {
    return null // Don't show card if no suggestions
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Wins</Text>
        <Text style={styles.subtitle}>Suggested actions</Text>
      </View>
      <View style={styles.suggestionsList}>
        {visibleSuggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={styles.suggestionCard}
            onPress={() => handlePress(suggestion)}
            activeOpacity={0.7}
          >
            <View style={styles.suggestionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${getPriorityColor(suggestion.priority)}15` }]}>
                <Text style={styles.icon}>{getTypeIcon(suggestion.type)}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {suggestion.title}
                </Text>
                <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                  {suggestion.subtitle}
                </Text>
              </View>
            </View>
            <View style={styles.suggestionRight}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${getPriorityColor(suggestion.priority)}15` }]}
                onPress={() => handlePress(suggestion)}
              >
                <Text style={[styles.actionButtonText, { color: getPriorityColor(suggestion.priority) }]}>
                  {suggestion.action_label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => handleDismiss(suggestion.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.dismissIcon}>×</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  loadingContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  suggestionsList: {
    gap: spacing.sm,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate[50],
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 16,
  },
  textContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  suggestionSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 1,
  },
  suggestionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  dismissButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissIcon: {
    fontSize: 18,
    color: colors.slate[400],
    fontWeight: typography.fontWeight.medium,
  },
})

export default QuickWinCard
