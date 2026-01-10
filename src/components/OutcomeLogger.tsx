/**
 * Outcome Logger Component (Mobile)
 *
 * Allows users to log deal outcomes (predictions vs actuals) for learning.
 * This is the core UI for the "Deal Memory" feature.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Card } from './Card'
import { colors, spacing, typography, radii } from '../theme'
import { intelligenceService } from '../services/intelligenceService'
import type { DealOutcome, OutcomeType } from '../types/intelligence'

interface OutcomeLoggerProps {
  dealId: string
  dealName?: string
  initialPredictions?: {
    arv?: number
    rehabCost?: number
    holdDays?: number
    profit?: number
  }
  onOutcomeSaved?: (outcome: DealOutcome) => void
}

const OUTCOME_TYPES: { value: OutcomeType; label: string; icon: string; color: string }[] = [
  { value: 'sold', label: 'Sold', icon: '🏠', color: colors.success[500] },
  { value: 'rented', label: 'Rented', icon: '🔑', color: colors.info[500] },
  { value: 'wholesaled', label: 'Wholesaled', icon: '🤝', color: colors.brand[500] },
  { value: 'held', label: 'Holding', icon: '⏳', color: colors.warning[500] },
  { value: 'lost', label: 'Lost', icon: '❌', color: colors.error[500] },
]

export function OutcomeLogger({
  dealId,
  dealName,
  initialPredictions,
  onOutcomeSaved,
}: OutcomeLoggerProps) {
  const [outcome, setOutcome] = useState<DealOutcome | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    predicted_arv: initialPredictions?.arv || 0,
    predicted_rehab_cost: initialPredictions?.rehabCost || 0,
    predicted_hold_days: initialPredictions?.holdDays || 0,
    predicted_profit: initialPredictions?.profit || 0,
    actual_arv: 0,
    actual_rehab_cost: 0,
    actual_hold_days: 0,
    actual_profit: 0,
    actual_sale_price: 0,
    outcome_type: 'pending' as OutcomeType,
    outcome_notes: '',
  })

  const loadOutcome = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await intelligenceService.getDealOutcome(dealId)

      if (data) {
        setOutcome(data)
        setFormData({
          predicted_arv: data.predicted_arv || initialPredictions?.arv || 0,
          predicted_rehab_cost: data.predicted_rehab_cost || initialPredictions?.rehabCost || 0,
          predicted_hold_days: data.predicted_hold_days || initialPredictions?.holdDays || 0,
          predicted_profit: data.predicted_profit || initialPredictions?.profit || 0,
          actual_arv: data.actual_arv || 0,
          actual_rehab_cost: data.actual_rehab_cost || 0,
          actual_hold_days: data.actual_hold_days || 0,
          actual_profit: data.actual_profit || 0,
          actual_sale_price: data.actual_sale_price || 0,
          outcome_type: data.outcome_type || 'pending',
          outcome_notes: data.outcome_notes || '',
        })
      } else if (initialPredictions) {
        setFormData((prev) => ({
          ...prev,
          predicted_arv: initialPredictions.arv || 0,
          predicted_rehab_cost: initialPredictions.rehabCost || 0,
          predicted_hold_days: initialPredictions.holdDays || 0,
          predicted_profit: initialPredictions.profit || 0,
        }))
      }
    } catch (err) {
      console.error('[OutcomeLogger] Error loading outcome:', err)
    } finally {
      setLoading(false)
    }
  }, [dealId, initialPredictions])

  useEffect(() => {
    loadOutcome()
  }, [loadOutcome])

  const handleSave = async () => {
    if (formData.outcome_type === 'pending') {
      Alert.alert('Select Outcome', 'Please select what happened to this deal.')
      return
    }

    setSaving(true)
    try {
      let result: DealOutcome | null = null

      if (outcome) {
        // Update existing
        const { data } = await intelligenceService.updateOutcome({
          id: outcome.id,
          actual_arv: formData.actual_arv || undefined,
          actual_rehab_cost: formData.actual_rehab_cost || undefined,
          actual_hold_days: formData.actual_hold_days || undefined,
          actual_profit: formData.actual_profit || undefined,
          actual_sale_price: formData.actual_sale_price || undefined,
          outcome_type: formData.outcome_type,
          outcome_notes: formData.outcome_notes || undefined,
        })
        result = data
      } else {
        // Create new
        const { data } = await intelligenceService.createOutcome({
          deal_id: dealId,
          predicted_arv: formData.predicted_arv || undefined,
          predicted_rehab_cost: formData.predicted_rehab_cost || undefined,
          predicted_hold_days: formData.predicted_hold_days || undefined,
          predicted_profit: formData.predicted_profit || undefined,
          actual_arv: formData.actual_arv || undefined,
          actual_rehab_cost: formData.actual_rehab_cost || undefined,
          actual_hold_days: formData.actual_hold_days || undefined,
          actual_profit: formData.actual_profit || undefined,
          actual_sale_price: formData.actual_sale_price || undefined,
          outcome_type: formData.outcome_type,
          outcome_notes: formData.outcome_notes || undefined,
        })
        result = data
      }

      if (result) {
        setOutcome(result)
        setIsEditing(false)
        onOutcomeSaved?.(result)
      }
    } catch (err) {
      console.error('[OutcomeLogger] Error saving outcome:', err)
      Alert.alert('Error', 'Failed to save outcome')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  const getAccuracyColor = (accuracy?: number) => {
    if (!accuracy) return colors.slate[400]
    if (accuracy >= 95) return colors.success[500]
    if (accuracy >= 85) return colors.warning[500]
    return colors.error[500]
  }

  if (loading) {
    return (
      <Card style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading outcome...</Text>
        </View>
      </Card>
    )
  }

  // Edit mode
  if (isEditing || (!outcome && !loading)) {
    return (
      <Card style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Deal Memory</Text>
          {isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Outcome Type Selection */}
          <Text style={styles.sectionTitle}>What happened?</Text>
          <View style={styles.outcomeTypes}>
            {OUTCOME_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.outcomeType,
                  formData.outcome_type === type.value && {
                    borderColor: type.color,
                    backgroundColor: `${type.color}15`,
                  },
                ]}
                onPress={() =>
                  setFormData((prev) => ({ ...prev, outcome_type: type.value }))
                }
              >
                <Text style={styles.outcomeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.outcomeLabel,
                    formData.outcome_type === type.value && { color: type.color },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actual Numbers */}
          <Text style={styles.sectionTitle}>Actual Numbers</Text>
          <View style={styles.inputGrid}>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Sale Price</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_sale_price ? String(formData.actual_sale_price) : ''}
                onChangeText={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    actual_sale_price: Number(v) || 0,
                    actual_arv: Number(v) || 0,
                  }))
                }
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Rehab Cost</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_rehab_cost ? String(formData.actual_rehab_cost) : ''}
                onChangeText={(v) =>
                  setFormData((prev) => ({ ...prev, actual_rehab_cost: Number(v) || 0 }))
                }
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Hold Days</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_hold_days ? String(formData.actual_hold_days) : ''}
                onChangeText={(v) =>
                  setFormData((prev) => ({ ...prev, actual_hold_days: Number(v) || 0 }))
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.slate[400]}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Profit</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_profit ? String(formData.actual_profit) : ''}
                onChangeText={(v) =>
                  setFormData((prev) => ({ ...prev, actual_profit: Number(v) || 0 }))
                }
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
              />
            </View>
          </View>

          {/* Notes */}
          <Text style={styles.sectionTitle}>Lessons Learned</Text>
          <TextInput
            style={styles.notesInput}
            value={formData.outcome_notes}
            onChangeText={(v) => setFormData((prev) => ({ ...prev, outcome_notes: v }))}
            multiline
            placeholder="What would you do differently next time?"
            placeholderTextColor={colors.slate[400]}
            textAlignVertical="top"
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Outcome</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Card>
    )
  }

  // View mode - show results
  if (outcome && outcome.outcome_type !== 'pending') {
    const outcomeConfig = OUTCOME_TYPES.find((t) => t.value === outcome.outcome_type)

    return (
      <Card style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Deal Memory</Text>
            <View
              style={[
                styles.outcomeBadge,
                { backgroundColor: outcomeConfig?.color || colors.slate[500] },
              ]}
            >
              <Text style={styles.outcomeBadgeText}>
                {outcomeConfig?.icon} {outcomeConfig?.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Comparison */}
        <View style={styles.comparison}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonLabel} />
            <Text style={styles.comparisonValue}>Predicted</Text>
            <Text style={styles.comparisonValue}>Actual</Text>
          </View>

          {/* ARV/Sale */}
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Sale Price</Text>
            <Text style={styles.comparisonPredicted}>
              {outcome.predicted_arv ? formatCurrency(outcome.predicted_arv) : '--'}
            </Text>
            <Text
              style={[
                styles.comparisonActual,
                { color: getAccuracyColor(outcome.arv_accuracy_pct) },
              ]}
            >
              {outcome.actual_arv ? formatCurrency(outcome.actual_arv) : '--'}
            </Text>
          </View>

          {/* Rehab */}
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Rehab</Text>
            <Text style={styles.comparisonPredicted}>
              {outcome.predicted_rehab_cost ? formatCurrency(outcome.predicted_rehab_cost) : '--'}
            </Text>
            <Text
              style={[
                styles.comparisonActual,
                { color: getAccuracyColor(outcome.rehab_accuracy_pct) },
              ]}
            >
              {outcome.actual_rehab_cost ? formatCurrency(outcome.actual_rehab_cost) : '--'}
            </Text>
          </View>

          {/* Profit */}
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Profit</Text>
            <Text style={styles.comparisonPredicted}>
              {outcome.predicted_profit ? formatCurrency(outcome.predicted_profit) : '--'}
            </Text>
            <Text
              style={[
                styles.comparisonActual,
                {
                  color:
                    outcome.actual_profit && outcome.actual_profit > 0
                      ? colors.success[500]
                      : colors.error[500],
                },
              ]}
            >
              {outcome.actual_profit ? formatCurrency(outcome.actual_profit) : '--'}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {outcome.outcome_notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{outcome.outcome_notes}</Text>
          </View>
        )}
      </Card>
    )
  }

  // Empty state
  return (
    <Card style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No Outcome Logged</Text>
        <Text style={styles.emptyText}>
          Log the final outcome to help FlipMantis learn from this deal
        </Text>
        <TouchableOpacity style={styles.logButton} onPress={() => setIsEditing(true)}>
          <Text style={styles.logButtonText}>Log Outcome</Text>
        </TouchableOpacity>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  cancelText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  editText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  outcomeTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  outcomeType: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.slate[200],
    gap: spacing.xs,
  },
  outcomeIcon: {
    fontSize: 16,
  },
  outcomeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputItem: {
    width: '48%',
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  notesInput: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
    minHeight: 80,
  },
  saveButton: {
    backgroundColor: colors.brand[500],
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    backgroundColor: colors.slate[300],
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  outcomeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  outcomeBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  comparison: {
    marginTop: spacing.sm,
  },
  comparisonHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  comparisonLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  comparisonValue: {
    width: 80,
    textAlign: 'right',
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    textTransform: 'uppercase',
  },
  comparisonPredicted: {
    width: 80,
    textAlign: 'right',
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  comparisonActual: {
    width: 80,
    textAlign: 'right',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  notes: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  notesLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 4,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  logButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  logButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
})

export default OutcomeLogger
