/**
 * LeadScoreBar
 *
 * Visual progress bar showing lead's conversion likelihood.
 * Uses motivation score, priority, and recency to calculate.
 */

import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, typography, radii } from '../theme'

interface LeadScoreBarProps {
  motivationScore?: number // 0-100
  priority?: 'hot' | 'high' | 'normal' | 'low'
  daysSinceCapture?: number
  compact?: boolean
}

export function LeadScoreBar({
  motivationScore = 0,
  priority = 'normal',
  daysSinceCapture = 0,
  compact = false,
}: LeadScoreBarProps) {
  // Calculate composite score
  const priorityBonus = {
    hot: 30,
    high: 20,
    normal: 10,
    low: 0,
  }[priority]

  // Recency bonus (newer leads get higher score)
  const recencyBonus = daysSinceCapture <= 1 ? 15 : daysSinceCapture <= 3 ? 10 : daysSinceCapture <= 7 ? 5 : 0

  const compositeScore = Math.min(100, motivationScore + priorityBonus + recencyBonus)

  const getScoreColor = () => {
    if (compositeScore >= 80) return colors.success[500]
    if (compositeScore >= 60) return colors.brand[500]
    if (compositeScore >= 40) return colors.warning[500]
    return colors.slate[400]
  }

  const getScoreLabel = () => {
    if (compositeScore >= 80) return 'Hot'
    if (compositeScore >= 60) return 'Warm'
    if (compositeScore >= 40) return 'Cool'
    return 'Cold'
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactBar}>
          <View
            style={[
              styles.compactFill,
              { width: `${compositeScore}%`, backgroundColor: getScoreColor() },
            ]}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Conversion Score</Text>
        <Text style={[styles.scoreText, { color: getScoreColor() }]}>
          {compositeScore}% ({getScoreLabel()})
        </Text>
      </View>
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            { width: `${compositeScore}%`, backgroundColor: getScoreColor() },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  scoreText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  barContainer: {
    height: 6,
    backgroundColor: colors.slate[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  compactContainer: {
    width: 50,
  },
  compactBar: {
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: 2,
  },
})

export default LeadScoreBar
