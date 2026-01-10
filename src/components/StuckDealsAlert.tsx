/**
 * StuckDealsAlert
 *
 * Alert banner shown when deals exceed critical threshold days in their stage.
 * Appears at the top of the pipeline view.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radii, shadows } from '../theme'

export interface StuckDeal {
  id: string
  name: string
  stage: string
  daysStuck: number
}

interface StuckDealsAlertProps {
  stuckDeals: StuckDeal[]
  onPress: () => void
  onDismiss?: () => void
}

export function StuckDealsAlert({ stuckDeals, onPress, onDismiss }: StuckDealsAlertProps) {
  if (stuckDeals.length === 0) return null

  const criticalCount = stuckDeals.filter(d => d.daysStuck >= 14).length

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        criticalCount > 0 ? styles.containerCritical : styles.containerWarning,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{criticalCount > 0 ? '🚨' : '⚠️'}</Text>
        <Text style={styles.title}>
          {stuckDeals.length} deal{stuckDeals.length !== 1 ? 's' : ''} need attention
        </Text>
        <Text style={styles.arrow}>→</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={(e) => {
            e.stopPropagation?.()
            onDismiss()
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dismissIcon}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.soft,
  },
  containerWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  containerCritical: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  arrow: {
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[500],
  },
  dismissButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  dismissIcon: {
    fontSize: 20,
    color: colors.slate[400],
    fontWeight: typography.fontWeight.bold,
  },
})

export default StuckDealsAlert
