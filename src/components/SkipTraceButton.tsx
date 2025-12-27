/**
 * SkipTraceButton Component
 *
 * Button to trigger skip trace lookup for a lead.
 * Shows loading state during lookup, confirmation dialog with cost,
 * and alerts on litigator detection.
 */

import React, { useState, useCallback } from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  ViewStyle,
  StyleProp,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radii, spacing, typography } from '../theme'
import { skipTraceService, type SkipTraceResult, type SkipTraceQuote } from '../services'

type ButtonVariant = 'full' | 'compact' | 'icon'

interface SkipTraceButtonProps {
  leadId: string
  variant?: ButtonVariant
  disabled?: boolean
  /** Skip confirmation dialog (for cached/free lookups) */
  skipConfirmation?: boolean
  onComplete?: (result: SkipTraceResult) => void
  onError?: (error: string) => void
  style?: StyleProp<ViewStyle>
}

export function SkipTraceButton({
  leadId,
  variant = 'full',
  disabled = false,
  skipConfirmation = false,
  onComplete,
  onError,
  style,
}: SkipTraceButtonProps) {
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Format cost for display
  const formatCost = (cost: number): string => {
    if (cost === 0) return 'Free'
    return `$${cost.toFixed(2)}`
  }

  // Build confirmation message from quote
  const buildConfirmationMessage = (quote: SkipTraceQuote): string => {
    const lines: string[] = []

    if (quote.cacheStatus === 'global_cached') {
      lines.push('Results found in cache.')
    } else {
      lines.push('This will perform a new lookup.')
    }

    lines.push(`Cost: ${formatCost(quote.estimatedCost)}`)

    if (quote.preview) {
      const previewParts: string[] = []
      if (quote.preview.phoneCount > 0) {
        previewParts.push(`${quote.preview.phoneCount} phone${quote.preview.phoneCount > 1 ? 's' : ''}`)
      }
      if (quote.preview.emailCount > 0) {
        previewParts.push(`${quote.preview.emailCount} email${quote.preview.emailCount > 1 ? 's' : ''}`)
      }
      if (previewParts.length > 0) {
        lines.push(`Available: ${previewParts.join(', ')}`)
      }
      if (quote.preview.isLitigator) {
        lines.push('\nWarning: This owner is flagged as a litigator.')
      }
    }

    return lines.join('\n')
  }

  // Execute the confirmed lookup
  const executeConfirmedLookup = useCallback(async () => {
    try {
      const { success, result, error } = await skipTraceService.runSkipTrace(leadId, { confirmed: true })

      if (success && result) {
        setCompleted(true)

        // Alert if litigator detected
        if (result.isLitigator) {
          Alert.alert(
            'Litigator Warning',
            `This property owner has been flagged as a litigator${
              result.litigatorScore ? ` (score: ${result.litigatorScore})` : ''
            }. Proceed with caution.`,
            [{ text: 'Understood', style: 'destructive' }]
          )
        }

        onComplete?.(result)
      } else {
        Alert.alert('Skip Trace Failed', error || 'Unknown error occurred')
        onError?.(error || 'Unknown error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert('Skip Trace Error', message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }, [leadId, onComplete, onError])

  // Show confirmation dialog
  const showConfirmation = useCallback((quote: SkipTraceQuote) => {
    const title = quote.estimatedCost > 0 ? 'Confirm Skip Trace' : 'Run Skip Trace'
    const message = buildConfirmationMessage(quote)

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setLoading(false),
        },
        {
          text: quote.estimatedCost > 0 ? `Pay ${formatCost(quote.estimatedCost)}` : 'Continue',
          style: 'default',
          onPress: executeConfirmedLookup,
        },
      ],
      { cancelable: false }
    )
  }, [executeConfirmedLookup])

  const handlePress = useCallback(async () => {
    if (loading || disabled || completed) return

    setLoading(true)

    try {
      // Use the confirmation flow
      const response = await skipTraceService.runSkipTraceWithConfirmation(leadId)

      if (response.error) {
        setLoading(false)
        Alert.alert('Skip Trace Error', response.error)
        onError?.(response.error)
        return
      }

      // If no confirmation needed (cached for this tenant), result is already returned
      if (!response.needsConfirmation && response.result) {
        setCompleted(true)
        setLoading(false)

        if (response.result.isLitigator) {
          Alert.alert(
            'Litigator Warning',
            `This property owner has been flagged as a litigator${
              response.result.litigatorScore ? ` (score: ${response.result.litigatorScore})` : ''
            }. Proceed with caution.`,
            [{ text: 'Understood', style: 'destructive' }]
          )
        }

        onComplete?.(response.result)
        return
      }

      // If confirmation needed, show dialog (unless skipConfirmation is set)
      if (response.needsConfirmation && response.quote) {
        if (skipConfirmation) {
          // Auto-confirm
          await executeConfirmedLookup()
        } else {
          // Show confirmation dialog
          showConfirmation(response.quote)
        }
        return
      }

      // Fallback - shouldn't happen
      setLoading(false)
      Alert.alert('Skip Trace Error', 'Unexpected response from server')
      onError?.('Unexpected response')
    } catch (err) {
      setLoading(false)
      const message = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert('Skip Trace Error', message)
      onError?.(message)
    }
  }, [leadId, loading, disabled, completed, skipConfirmation, onComplete, onError, showConfirmation, executeConfirmedLookup])

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={loading || disabled || completed}
        activeOpacity={0.7}
        style={[
          styles.iconButton,
          completed && styles.iconButtonCompleted,
          (disabled || loading) && styles.iconButtonDisabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.brand[500]} />
        ) : completed ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
        ) : (
          <Ionicons name="person-circle-outline" size={24} color={colors.brand[500]} />
        )}
      </TouchableOpacity>
    )
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={loading || disabled || completed}
        activeOpacity={0.7}
        style={[
          styles.compactButton,
          completed && styles.compactButtonCompleted,
          (disabled || loading) && styles.compactButtonDisabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : completed ? (
          <>
            <Ionicons name="checkmark" size={16} color={colors.white} />
            <Text style={styles.compactText}>Traced</Text>
          </>
        ) : (
          <>
            <Ionicons name="search" size={16} color={colors.white} />
            <Text style={styles.compactText}>Skip Trace</Text>
          </>
        )}
      </TouchableOpacity>
    )
  }

  // Full variant
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading || disabled || completed}
      activeOpacity={0.7}
      style={[
        styles.fullButton,
        completed && styles.fullButtonCompleted,
        (disabled || loading) && styles.fullButtonDisabled,
        style,
      ]}
    >
      <View style={styles.fullContent}>
        {loading ? (
          <>
            <ActivityIndicator size="small" color={colors.white} style={styles.icon} />
            <View style={styles.textContainer}>
              <Text style={styles.fullTitle}>Running Skip Trace...</Text>
              <Text style={styles.fullSubtitle}>Looking up owner contact info</Text>
            </View>
          </>
        ) : completed ? (
          <>
            <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.fullTitle}>Skip Trace Complete</Text>
              <Text style={styles.fullSubtitle}>Owner info retrieved</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="person-circle-outline" size={20} color={colors.white} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.fullTitle}>Run Skip Trace</Text>
              <Text style={styles.fullSubtitle}>Get owner contact information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Icon variant
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonCompleted: {
    backgroundColor: colors.success[50],
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },

  // Compact variant
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  compactButtonCompleted: {
    backgroundColor: colors.success[500],
  },
  compactButtonDisabled: {
    opacity: 0.5,
  },
  compactText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Full variant
  fullButton: {
    backgroundColor: colors.brand[500],
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  fullButtonCompleted: {
    backgroundColor: colors.success[500],
  },
  fullButtonDisabled: {
    opacity: 0.6,
  },
  fullContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  icon: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  fullTitle: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  fullSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
})
