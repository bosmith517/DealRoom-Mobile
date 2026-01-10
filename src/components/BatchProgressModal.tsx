/**
 * BatchProgressModal Component
 *
 * Modal that displays progress during batch operations like
 * analyzing multiple properties at once.
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radii, typography } from '../theme'

interface BatchProgressModalProps {
  visible: boolean
  current: number
  total: number
  currentItemLabel?: string
  successCount?: number
  failCount?: number
  isComplete?: boolean
  onCancel?: () => void
  onDismiss?: () => void
}

export function BatchProgressModal({
  visible,
  current,
  total,
  currentItemLabel,
  successCount = 0,
  failCount = 0,
  isComplete = false,
  onCancel,
  onDismiss,
}: BatchProgressModalProps) {
  const progressAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  const progress = total > 0 ? current / total : 0
  const percentage = Math.round(progress * 100)
  const estimatedTimeRemaining = Math.max(0, (total - current) * 0.5) // ~500ms per item

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start()
  }, [progress])

  useEffect(() => {
    // Pulse animation when not complete
    if (!isComplete && visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isComplete, visible])

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modal, { transform: [{ scale: pulseAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            {isComplete ? (
              <View style={[styles.iconContainer, styles.iconSuccess]}>
                <Ionicons name="checkmark-circle" size={32} color={colors.success[500]} />
              </View>
            ) : (
              <View style={[styles.iconContainer, styles.iconProgress]}>
                <Ionicons name="analytics" size={32} color={colors.brand[500]} />
              </View>
            )}
            <Text style={styles.title}>
              {isComplete ? 'Analysis Complete!' : 'Analyzing Properties...'}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth },
                  isComplete && failCount === 0 && styles.progressFillSuccess,
                  isComplete && failCount > 0 && styles.progressFillWarning,
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {current} of {total} ({percentage}%)
            </Text>
          </View>

          {/* Current item label */}
          {!isComplete && currentItemLabel && (
            <View style={styles.currentItem}>
              <Text style={styles.currentItemLabel}>Currently analyzing:</Text>
              <Text style={styles.currentItemValue} numberOfLines={1}>
                {currentItemLabel}
              </Text>
            </View>
          )}

          {/* Time remaining (only during progress) */}
          {!isComplete && estimatedTimeRemaining > 0 && (
            <View style={styles.timeRemaining}>
              <Ionicons name="time-outline" size={16} color={colors.slate[400]} />
              <Text style={styles.timeRemainingText}>
                ~{formatTime(estimatedTimeRemaining)} remaining
              </Text>
            </View>
          )}

          {/* Results (when complete) */}
          {isComplete && (
            <View style={styles.results}>
              <View style={styles.resultRow}>
                <View style={[styles.resultBadge, styles.successBadge]}>
                  <Ionicons name="checkmark" size={14} color={colors.success[600]} />
                </View>
                <Text style={styles.resultLabel}>Successful</Text>
                <Text style={[styles.resultValue, { color: colors.success[600] }]}>
                  {successCount}
                </Text>
              </View>
              {failCount > 0 && (
                <View style={styles.resultRow}>
                  <View style={[styles.resultBadge, styles.failBadge]}>
                    <Ionicons name="close" size={14} color={colors.error[600]} />
                  </View>
                  <Text style={styles.resultLabel}>Failed (can retry)</Text>
                  <Text style={[styles.resultValue, { color: colors.error[600] }]}>
                    {failCount}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {isComplete ? (
              <Pressable style={styles.doneButton} onPress={onDismiss}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.cancelButton} onPress={onCancel}>
                <Ionicons name="stop-circle-outline" size={18} color={colors.error[600]} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconProgress: {
    backgroundColor: colors.brand[50],
  },
  iconSuccess: {
    backgroundColor: colors.success[50],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressTrack: {
    height: 12,
    backgroundColor: colors.slate[100],
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand[500],
    borderRadius: 6,
  },
  progressFillSuccess: {
    backgroundColor: colors.success[500],
  },
  progressFillWarning: {
    backgroundColor: colors.warning[500],
  },
  progressText: {
    fontSize: 13,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  currentItem: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  currentItemLabel: {
    fontSize: 11,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  currentItemValue: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  timeRemainingText: {
    fontSize: 13,
    color: colors.slate[400],
  },
  results: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: colors.success[100],
  },
  failBadge: {
    backgroundColor: colors.error[100],
  },
  resultLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.slate[600],
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.error[600],
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: colors.brand[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: radii.lg,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
})

export default BatchProgressModal
