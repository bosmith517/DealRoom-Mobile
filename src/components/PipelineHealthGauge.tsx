/**
 * PipelineHealthGauge
 *
 * Visual gauge showing overall pipeline health:
 * - Health score (0-100)
 * - Breakdown of healthy/warning/critical deals
 * - Color-coded indicator
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { getPipelineHealth, type PipelineHealth } from '../services/dashboardService'

interface PipelineHealthGaugeProps {
  compact?: boolean
}

export function PipelineHealthGauge({ compact = false }: PipelineHealthGaugeProps) {
  const router = useRouter()
  const [health, setHealth] = useState<PipelineHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHealth()
  }, [])

  const loadHealth = async () => {
    const { data, error } = await getPipelineHealth()
    if (!error) {
      setHealth(data)
    }
    setLoading(false)
  }

  const getHealthColor = () => {
    if (!health) return colors.slate[400]
    if (health.health_score >= 80) return colors.success[500]
    if (health.health_score >= 60) return colors.warning[500]
    return colors.error[500]
  }

  const getHealthLabel = () => {
    if (!health) return 'Unknown'
    if (health.health_score >= 80) return 'Healthy'
    if (health.health_score >= 60) return 'Needs Attention'
    return 'Critical'
  }

  const handlePress = () => {
    router.push('/pipeline')
  }

  if (loading) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand[500]} />
        </View>
      </TouchableOpacity>
    )
  }

  if (!health || health.total_active_deals === 0) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.header}>
          <Text style={styles.title}>Pipeline Health</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No active deals</Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.containerCompact, { borderLeftColor: getHealthColor() }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.compactContent}>
          <Text style={[styles.scoreCompact, { color: getHealthColor() }]}>
            {health.health_score}%
          </Text>
          <Text style={styles.labelCompact}>{getHealthLabel()}</Text>
        </View>
        {health.critical_count > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{health.critical_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title}>Pipeline Health</Text>
        <Text style={styles.viewDetails}>View Details</Text>
      </View>

      {/* Score Circle */}
      <View style={styles.gaugeRow}>
        <View style={[styles.scoreCircle, { borderColor: getHealthColor() }]}>
          <Text style={[styles.scoreValue, { color: getHealthColor() }]}>
            {health.health_score}
          </Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>

        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success[500] }]} />
            <Text style={styles.breakdownLabel}>Healthy</Text>
            <Text style={styles.breakdownValue}>{health.healthy_count}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.warning[500] }]} />
            <Text style={styles.breakdownLabel}>Warning</Text>
            <Text style={styles.breakdownValue}>{health.warning_count}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.error[500] }]} />
            <Text style={styles.breakdownLabel}>Critical</Text>
            <Text style={styles.breakdownValue}>{health.critical_count}</Text>
          </View>
        </View>
      </View>

      {/* Alert for stuck deals */}
      {health.critical_count > 0 && health.oldest_stuck_days && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertText}>
            {health.critical_count} deal{health.critical_count !== 1 ? 's' : ''} stuck for {health.oldest_stuck_days}+ days
          </Text>
        </View>
      )}
    </TouchableOpacity>
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
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
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
  viewDetails: {
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
    paddingVertical: spacing.md,
  },
  emptyIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  scoreValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  scoreLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  breakdown: {
    flex: 1,
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  breakdownValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    minWidth: 24,
    textAlign: 'right',
  },
  alertContainer: {
    backgroundColor: colors.error[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  alertText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    textAlign: 'center',
  },
  // Compact styles
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreCompact: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  labelCompact: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  alertBadge: {
    backgroundColor: colors.error[500],
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  alertBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
})

export default PipelineHealthGauge
