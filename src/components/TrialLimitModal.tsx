/**
 * TrialLimitModal Component (React Native)
 *
 * Modal shown when trial user hits usage limits (daily or total).
 * Provides contact support option - no in-app purchase CTAs.
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { Button } from './Button'

export interface TrialLimitModalProps {
  visible: boolean
  onClose: () => void
  feature: 'property_search' | 'skip_trace'
  used: number
  trialLimit: number
  paidLimit: number
  costPerUnit: number
  dailyUsed?: number
  dailyLimit?: number
  isDailyLimit?: boolean
}

const FEATURE_LABELS: Record<string, { name: string; action: string }> = {
  property_search: { name: 'Property Search', action: 'searches' },
  skip_trace: { name: 'Skip Trace', action: 'skip traces' },
}

export function TrialLimitModal({
  visible,
  onClose,
  feature,
  used,
  trialLimit,
  dailyUsed,
  dailyLimit,
  isDailyLimit = false,
}: TrialLimitModalProps) {
  const featureInfo = FEATURE_LABELS[feature] || { name: feature, action: 'requests' }

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@flipmantis.com?subject=FlipMantis%20Usage%20Limit')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={isDailyLimit ? 'time-outline' : 'information-circle-outline'}
                size={32}
                color={colors.brand[600]}
              />
            </View>
            <Text style={styles.title}>
              {isDailyLimit ? 'Daily Limit Reached' : 'Usage Limit Reached'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.slate[400]} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isDailyLimit ? (
              <>
                <Text style={styles.message}>
                  You've used <Text style={styles.highlight}>{dailyUsed}/{dailyLimit}</Text> daily {featureInfo.action}.
                </Text>
                <Text style={styles.submessage}>
                  Your daily limit will reset tomorrow. Contact support if you need assistance.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.message}>
                  You've used <Text style={styles.highlight}>{used}/{trialLimit}</Text> {featureInfo.action}.
                </Text>
                <Text style={styles.submessage}>
                  You've reached your usage limit. Contact support for assistance with your account.
                </Text>
              </>
            )}

            {/* What you can do */}
            <View style={styles.optionsContainer}>
              <Text style={styles.optionsTitle}>
                {isDailyLimit ? 'Your options:' : 'Need more access?'}
              </Text>

              <View style={styles.optionsList}>
                {isDailyLimit && (
                  <View style={styles.optionItem}>
                    <Ionicons name="time" size={20} color={colors.brand[500]} />
                    <Text style={styles.optionText}>Wait until tomorrow for your limit to reset</Text>
                  </View>
                )}
                <View style={styles.optionItem}>
                  <Ionicons name="mail" size={20} color={colors.brand[500]} />
                  <Text style={styles.optionText}>Contact our support team for help</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={onClose}
              style={styles.actionButton}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onPress={handleContactSupport}
              style={styles.actionButton}
            >
              Contact Support
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  highlight: {
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  submessage: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    marginTop: spacing.sm,
  },
  optionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  actionButton: {
    flex: 1,
  },
})

export default TrialLimitModal
