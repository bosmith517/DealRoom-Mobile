/**
 * BuyBoxPreview Component
 *
 * Preview section for buy box form showing:
 * - Validation warnings (weights, aggressive criteria, missing fields)
 * - Lead score distribution preview
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radii, typography } from '../theme'

interface BuyBoxFormState {
  targetZips: string
  maxPurchasePrice: string
  minArv: string
  maxRepairBudget: string
  minProfit: string
  weightLocation: number
  weightPropertyFit: number
  weightFinancial: number
  weightDistress: number
  propertyTypes: string[]
  strategies: string[]
  preferredTags: string[]
}

interface BuyBoxPreviewProps {
  form: BuyBoxFormState
  leadCount?: number
}

interface Warning {
  type: 'error' | 'warning' | 'info'
  message: string
  icon: string
}

export function BuyBoxPreview({ form, leadCount = 0 }: BuyBoxPreviewProps) {
  // Calculate validation warnings
  const warnings = useMemo<Warning[]>(() => {
    const result: Warning[] = []

    // Check weights sum
    const totalWeight = form.weightLocation + form.weightPropertyFit + form.weightFinancial + form.weightDistress
    if (totalWeight !== 100) {
      result.push({
        type: 'warning',
        message: `Weights sum to ${totalWeight}% (should be 100%)`,
        icon: 'alert-circle',
      })
    }

    // Check for no target locations
    if (!form.targetZips.trim()) {
      result.push({
        type: 'info',
        message: 'No target ZIPs selected - will match any location',
        icon: 'information-circle',
      })
    }

    // Check for aggressive criteria
    const maxPurchase = parseFloat(form.maxPurchasePrice) || 0
    const minArv = parseFloat(form.minArv) || 0
    if (maxPurchase > 0 && minArv > 0 && minArv < maxPurchase * 1.5) {
      result.push({
        type: 'warning',
        message: `Max purchase $${formatNumber(maxPurchase)} with min ARV $${formatNumber(minArv)} - tight margin`,
        icon: 'alert-circle',
      })
    }

    // Check for very high repair budget relative to purchase
    const maxRepair = parseFloat(form.maxRepairBudget) || 0
    if (maxPurchase > 0 && maxRepair > maxPurchase * 0.5) {
      result.push({
        type: 'info',
        message: `Repair budget (${formatNumber(maxRepair)}) is >50% of purchase price`,
        icon: 'information-circle',
      })
    }

    // Check for no property types
    if (form.propertyTypes.length === 0) {
      result.push({
        type: 'error',
        message: 'No property types selected',
        icon: 'close-circle',
      })
    }

    // Check for no strategies
    if (form.strategies.length === 0) {
      result.push({
        type: 'error',
        message: 'No exit strategies selected',
        icon: 'close-circle',
      })
    }

    // Check for no distress signals
    if (form.preferredTags.length === 0) {
      result.push({
        type: 'info',
        message: 'No preferred distress signals - AI will score all equally',
        icon: 'information-circle',
      })
    }

    return result
  }, [form])

  // Simulated score distribution based on criteria strictness
  const scoreDistribution = useMemo(() => {
    // Calculate how "strict" the criteria is
    let strictnessScore = 0

    // More ZIPs = less strict
    const zipCount = form.targetZips.split(',').filter(z => z.trim()).length
    strictnessScore += zipCount > 0 ? Math.min(zipCount * 5, 20) : 30

    // Higher min profit = more strict
    const minProfit = parseFloat(form.minProfit) || 0
    if (minProfit > 50000) strictnessScore += 20
    else if (minProfit > 25000) strictnessScore += 10

    // More property types = less strict
    strictnessScore += (5 - form.propertyTypes.length) * 5

    // More distress signals = less strict
    strictnessScore += (8 - form.preferredTags.length) * 3

    // Normalize to 0-100
    strictnessScore = Math.min(100, Math.max(0, strictnessScore))

    // Calculate distribution (more strict = fewer high scores)
    const high = Math.max(5, Math.round(100 - strictnessScore) * 0.3)
    const medium = Math.max(10, Math.round(100 - strictnessScore) * 0.4)
    const low = 100 - high - medium

    return { high, medium, low }
  }, [form])

  const hasErrors = warnings.some(w => w.type === 'error')
  const hasWarnings = warnings.some(w => w.type === 'warning')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="eye" size={20} color={colors.brand[600]} />
        <Text style={styles.title}>Preview</Text>
      </View>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          {warnings.map((warning, index) => (
            <View
              key={index}
              style={[
                styles.warningRow,
                warning.type === 'error' && styles.warningRowError,
                warning.type === 'warning' && styles.warningRowWarning,
              ]}
            >
              <Ionicons
                name={warning.icon as any}
                size={16}
                color={
                  warning.type === 'error'
                    ? colors.error[500]
                    : warning.type === 'warning'
                    ? colors.warning[500]
                    : colors.slate[400]
                }
              />
              <Text
                style={[
                  styles.warningText,
                  warning.type === 'error' && styles.warningTextError,
                  warning.type === 'warning' && styles.warningTextWarning,
                ]}
              >
                {warning.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Score distribution preview */}
      <View style={styles.distributionContainer}>
        <Text style={styles.distributionTitle}>Estimated Lead Distribution</Text>
        <Text style={styles.distributionSubtitle}>
          Based on your criteria strictness
        </Text>

        {/* Bar chart */}
        <View style={styles.barChart}>
          <View style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <View style={[styles.barDot, { backgroundColor: colors.success[500] }]} />
              <Text style={styles.barLabel}>70+ (Strong)</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${scoreDistribution.high}%`, backgroundColor: colors.success[500] },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{scoreDistribution.high}%</Text>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <View style={[styles.barDot, { backgroundColor: colors.warning[500] }]} />
              <Text style={styles.barLabel}>40-69 (Fair)</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${scoreDistribution.medium}%`, backgroundColor: colors.warning[500] },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{scoreDistribution.medium}%</Text>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <View style={[styles.barDot, { backgroundColor: colors.slate[400] }]} />
              <Text style={styles.barLabel}>Below 40</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${scoreDistribution.low}%`, backgroundColor: colors.slate[400] },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{scoreDistribution.low}%</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          {hasErrors ? (
            <View style={styles.summaryRow}>
              <Ionicons name="close-circle" size={18} color={colors.error[500]} />
              <Text style={styles.summaryTextError}>
                Fix errors above before saving
              </Text>
            </View>
          ) : hasWarnings ? (
            <View style={styles.summaryRow}>
              <Ionicons name="alert-circle" size={18} color={colors.warning[500]} />
              <Text style={styles.summaryTextWarning}>
                Review warnings - criteria may be too restrictive
              </Text>
            </View>
          ) : (
            <View style={styles.summaryRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
              <Text style={styles.summaryTextSuccess}>
                Buy box looks good! AI will use these criteria.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${Math.round(num / 1000)}k`
  return num.toString()
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  warningsContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
  },
  warningRowError: {
    backgroundColor: colors.error[50],
  },
  warningRowWarning: {
    backgroundColor: colors.warning[50],
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.slate[600],
    lineHeight: 18,
  },
  warningTextError: {
    color: colors.error[700],
  },
  warningTextWarning: {
    color: colors.warning[700],
  },
  distributionContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.md,
  },
  distributionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2,
  },
  distributionSubtitle: {
    fontSize: 12,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  barChart: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    gap: spacing.xs,
  },
  barDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 12,
    color: colors.slate[600],
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.slate[100],
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barValue: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate[700],
    textAlign: 'right',
  },
  summaryBox: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryTextError: {
    flex: 1,
    fontSize: 13,
    color: colors.error[700],
    fontWeight: '500',
  },
  summaryTextWarning: {
    flex: 1,
    fontSize: 13,
    color: colors.warning[700],
    fontWeight: '500',
  },
  summaryTextSuccess: {
    flex: 1,
    fontSize: 13,
    color: colors.success[700],
    fontWeight: '500',
  },
})

export default BuyBoxPreview
