/**
 * GoalTrackingWidget
 *
 * Displays user goals with progress bars and real-time updates.
 * Shows monthly/custom period goals for:
 * - Deals closed
 * - Revenue
 * - Leads captured
 * - Profit
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, typography, radii, shadows } from '../theme'
import {
  getUserGoals,
  getGoalTypeLabel,
  getGoalTypeIcon,
  formatGoalValue,
  type UserGoal,
} from '../services/dashboardService'

interface GoalTrackingWidgetProps {
  onAddGoal?: () => void
}

export function GoalTrackingWidget({ onAddGoal }: GoalTrackingWidgetProps) {
  const router = useRouter()
  const [goals, setGoals] = useState<UserGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGoals()
  }, [])

  const loadGoals = async () => {
    const { data, error } = await getUserGoals()
    if (!error) {
      setGoals(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Monthly Goals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand[500]} />
        </View>
      </View>
    )
  }

  if (goals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Monthly Goals</Text>
          <TouchableOpacity onPress={onAddGoal}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No goals set</Text>
          <Text style={styles.emptySubtext}>Set monthly targets to track your progress</Text>
          <TouchableOpacity style={styles.createButton} onPress={onAddGoal}>
            <Text style={styles.createButtonText}>Create Goal</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Goals</Text>
        <TouchableOpacity onPress={onAddGoal}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.goalsGrid}>
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </View>
    </View>
  )
}

function GoalCard({ goal }: { goal: UserGoal }) {
  const icon = getGoalTypeIcon(goal.goal_type)
  const label = getGoalTypeLabel(goal.goal_type)
  const currentFormatted = formatGoalValue(goal.goal_type, goal.current_value)
  const targetFormatted = formatGoalValue(goal.goal_type, goal.target_value)
  const progressPercent = Math.min(100, goal.progress_percent)

  // Color based on progress
  const getProgressColor = () => {
    if (progressPercent >= 100) return colors.success[500]
    if (progressPercent >= 75) return colors.brand[500]
    if (progressPercent >= 50) return colors.warning[500]
    return colors.slate[400]
  }

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalIcon}>{icon}</Text>
        <View style={styles.goalInfo}>
          <Text style={styles.goalLabel}>{label}</Text>
          <Text style={styles.goalProgress}>
            {currentFormatted} / {targetFormatted}
          </Text>
        </View>
        <Text style={[styles.goalPercent, { color: getProgressColor() }]}>
          {progressPercent}%
        </Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${progressPercent}%`, backgroundColor: getProgressColor() },
          ]}
        />
      </View>
      {goal.days_remaining > 0 && (
        <Text style={styles.daysRemaining}>
          {goal.days_remaining} day{goal.days_remaining !== 1 ? 's' : ''} left
        </Text>
      )}
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
  addButton: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  createButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  createButtonText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  goalsGrid: {
    gap: spacing.sm,
  },
  goalCard: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  goalInfo: {
    flex: 1,
  },
  goalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  goalProgress: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  goalPercent: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.slate[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  daysRemaining: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: spacing.xs,
    textAlign: 'right',
  },
})

export default GoalTrackingWidget
