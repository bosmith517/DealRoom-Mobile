/**
 * TrialUsageWarning Component (React Native)
 *
 * Proactive warning banner shown when trial user approaches limit (80%+).
 * Shows usage information only - no purchase CTAs.
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'

export interface TrialUsageWarningProps {
  feature: 'property_search' | 'skip_trace'
  used: number
  limit: number
  onAddFunds?: () => void
}

const FEATURE_LABELS: Record<string, string> = {
  property_search: 'searches',
  skip_trace: 'skip traces',
}

export function TrialUsageWarning({
  feature,
  used,
  limit,
}: TrialUsageWarningProps) {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0
  const remaining = Math.max(0, limit - used)
  const featureLabel = FEATURE_LABELS[feature] || 'requests'

  // Only show at 80% or above
  if (percentage < 80) {
    return null
  }

  const isAtLimit = remaining === 0
  const isNearLimit = remaining <= 2 && remaining > 0

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@flipmantis.com?subject=FlipMantis%20Usage%20Inquiry')
  }

  return (
    <View style={[
      styles.container,
      isAtLimit ? styles.containerError : isNearLimit ? styles.containerWarning : styles.containerCaution
    ]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={isAtLimit ? 'information-circle' : 'alert-circle'}
          size={20}
          color={isAtLimit ? colors.slate[600] : colors.warning[600]}
        />
      </View>

      <View style={styles.content}>
        <Text style={[
          styles.message,
          isAtLimit ? styles.messageError : styles.messageWarning
        ]}>
          {isAtLimit
            ? `Usage limit reached (${used}/${limit} ${featureLabel})`
            : `${remaining} ${featureLabel} remaining (${used}/${limit})`}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity onPress={handleContactSupport} style={styles.link}>
            <Text style={styles.linkText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, percentage)}%` },
              isAtLimit ? styles.progressError : isNearLimit ? styles.progressWarning : styles.progressCaution
            ]}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  containerCaution: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  containerWarning: {
    backgroundColor: colors.warning[100],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  containerError: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  iconContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  content: {
    marginLeft: spacing.xl + spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  messageWarning: {
    color: colors.warning[700],
  },
  messageError: {
    color: colors.slate[700],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  link: {
    paddingVertical: spacing.xs,
  },
  linkText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  progressContainer: {
    marginTop: spacing.sm,
    marginLeft: spacing.xl + spacing.sm,
  },
  progressBackground: {
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressCaution: {
    backgroundColor: colors.warning[500],
  },
  progressWarning: {
    backgroundColor: colors.warning[500],
  },
  progressError: {
    backgroundColor: colors.slate[400],
  },
})

export default TrialUsageWarning
