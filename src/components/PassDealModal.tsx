/**
 * Pass Deal Modal (Mobile)
 *
 * Bottom sheet modal for logging when a deal is passed on.
 * Records the reason and optionally sets up monitoring.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { intelligenceService } from '../services/intelligenceService'
import type { PassReason, PassedDeal } from '../types/intelligence'

interface PassDealModalProps {
  visible: boolean
  onClose: () => void
  onPassed?: (passedDeal: PassedDeal) => void
  // Pre-fill from deal/search
  dealId?: string
  attomId?: string
  address: string
  city?: string
  state?: string
  zipCode?: string
  askingPrice?: number
  maxOffer?: number
}

const PASS_REASONS: { value: PassReason; label: string; icon: string }[] = [
  { value: 'too_expensive', label: 'Too Expensive', icon: '💰' },
  { value: 'bad_location', label: 'Bad Location', icon: '📍' },
  { value: 'too_much_work', label: 'Too Much Work', icon: '🔧' },
  { value: 'title_issues', label: 'Title Issues', icon: '📜' },
  { value: 'financing_fell_through', label: 'Financing', icon: '🏦' },
  { value: 'competition', label: 'Competition', icon: '👥' },
  { value: 'seller_unreasonable', label: 'Seller Issues', icon: '😤' },
  { value: 'inspection_issues', label: 'Inspection', icon: '🔍' },
  { value: 'market_concerns', label: 'Market', icon: '📉' },
  { value: 'other', label: 'Other', icon: '❓' },
]

const WATCH_PERIODS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
]

export function PassDealModal({
  visible,
  onClose,
  onPassed,
  dealId,
  attomId,
  address,
  city,
  state,
  zipCode,
  askingPrice,
  maxOffer,
}: PassDealModalProps) {
  const insets = useSafeAreaInsets()
  const [selectedReason, setSelectedReason] = useState<PassReason | null>(null)
  const [notes, setNotes] = useState('')
  const [isWatching, setIsWatching] = useState(true)
  const [watchMonths, setWatchMonths] = useState(6)
  const [saving, setSaving] = useState(false)

  const handlePass = async () => {
    if (!selectedReason) return

    setSaving(true)

    try {
      const watchUntil = new Date()
      watchUntil.setMonth(watchUntil.getMonth() + watchMonths)

      const result = await intelligenceService.createPassedDeal({
        deal_id: dealId,
        attom_id: attomId,
        address,
        city,
        state,
        zip_code: zipCode,
        pass_reason: selectedReason,
        pass_notes: notes,
        asking_price_at_pass: askingPrice,
        our_max_offer: maxOffer,
        is_watching: isWatching,
        watch_until: isWatching ? watchUntil.toISOString() : undefined,
      })

      if (result) {
        onPassed?.(result)
        resetForm()
        onClose()
      }
    } catch (err) {
      console.error('[PassDealModal] Error:', err)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSelectedReason(null)
    setNotes('')
    setIsWatching(true)
    setWatchMonths(6)
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pass on Deal</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {address}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handlePass}
            disabled={!selectedReason || saving}
            style={[
              styles.passButton,
              (!selectedReason || saving) && styles.passButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.passButtonText}>Pass</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Price Info */}
          {(askingPrice || maxOffer) && (
            <View style={styles.priceInfo}>
              {askingPrice && (
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Asking</Text>
                  <Text style={styles.priceValue}>{formatCurrency(askingPrice)}</Text>
                </View>
              )}
              {maxOffer && (
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Our Max</Text>
                  <Text style={styles.priceValue}>{formatCurrency(maxOffer)}</Text>
                </View>
              )}
              {askingPrice && maxOffer && (
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Gap</Text>
                  <Text style={[styles.priceValue, styles.priceGap]}>
                    {formatCurrency(askingPrice - maxOffer)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Reason Selection */}
          <Text style={styles.sectionTitle}>Why are you passing?</Text>
          <View style={styles.reasonsGrid}>
            {PASS_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonCard,
                  selectedReason === reason.value && styles.reasonCardSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                <Text
                  style={[
                    styles.reasonLabel,
                    selectedReason === reason.value && styles.reasonLabelSelected,
                  ]}
                >
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Any additional context..."
            placeholderTextColor={colors.slate[400]}
            textAlignVertical="top"
          />

          {/* Watch Settings */}
          <View style={styles.watchContainer}>
            <View style={styles.watchHeader}>
              <View style={styles.watchInfo}>
                <Text style={styles.watchTitle}>Watch this property?</Text>
                <Text style={styles.watchSubtitle}>
                  FlipMantis will monitor what happens to this deal
                </Text>
              </View>
              <Switch
                value={isWatching}
                onValueChange={setIsWatching}
                trackColor={{ false: colors.slate[200], true: colors.brand[200] }}
                thumbColor={isWatching ? colors.brand[500] : colors.slate[100]}
              />
            </View>

            {isWatching && (
              <View style={styles.watchPeriod}>
                <Text style={styles.watchPeriodLabel}>Watch for:</Text>
                <View style={styles.watchPeriodOptions}>
                  {WATCH_PERIODS.map((period) => (
                    <TouchableOpacity
                      key={period.value}
                      style={[
                        styles.watchPeriodButton,
                        watchMonths === period.value && styles.watchPeriodButtonSelected,
                      ]}
                      onPress={() => setWatchMonths(period.value)}
                    >
                      <Text
                        style={[
                          styles.watchPeriodText,
                          watchMonths === period.value && styles.watchPeriodTextSelected,
                        ]}
                      >
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  closeButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  closeText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  passButton: {
    backgroundColor: colors.error[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 60,
    alignItems: 'center',
  },
  passButtonDisabled: {
    backgroundColor: colors.slate[300],
  },
  passButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  priceInfo: {
    flexDirection: 'row',
    backgroundColor: colors.slate[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  priceValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  priceGap: {
    color: colors.error[600],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  reasonCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.slate[200],
    alignItems: 'center',
  },
  reasonCardSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  reasonIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  reasonLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    textAlign: 'center',
  },
  reasonLabelSelected: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  notesInput: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    padding: spacing.md,
    minHeight: 80,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  watchContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  watchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watchInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  watchTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  watchSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  watchPeriod: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  watchPeriodLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginBottom: spacing.sm,
  },
  watchPeriodOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  watchPeriodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[300],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  watchPeriodButtonSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  watchPeriodText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  watchPeriodTextSelected: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
})

export default PassDealModal
