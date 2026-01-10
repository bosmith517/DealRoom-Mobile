/**
 * SellerMotivationCard
 *
 * Displays seller motivation score from n8n enrichment workflow.
 * Shows overall score (1-100) with 6 component breakdown:
 * - Ownership Duration
 * - Equity Position
 * - Life Events
 * - Property Condition
 * - Market Behavior
 * - Owner Situation
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { intelligenceService, getMotivationColor } from '../services/intelligenceService'
import type { SellerMotivationScore } from '../types/intelligence'

interface SellerMotivationCardProps {
  /** Lead ID to fetch motivation score for */
  leadId?: string
  /** Deal ID to fetch motivation score for */
  dealId?: string
  /** ATTOM ID to fetch motivation score for */
  attomId?: string
  /** Callback when enrich button is pressed */
  onEnrich?: () => void
  /** Whether enrichment is in progress */
  enriching?: boolean
}

// Component score labels
const SCORE_COMPONENTS = [
  { key: 'ownership_duration_score', label: 'Ownership', icon: '🏠' },
  { key: 'equity_position_score', label: 'Equity', icon: '💰' },
  { key: 'life_events_score', label: 'Life Events', icon: '📋' },
  { key: 'property_condition_score', label: 'Condition', icon: '🔧' },
  { key: 'market_behavior_score', label: 'Market', icon: '📊' },
  { key: 'owner_situation_score', label: 'Owner', icon: '👤' },
] as const

export function SellerMotivationCard({
  leadId,
  dealId,
  attomId,
  onEnrich,
  enriching = false,
}: SellerMotivationCardProps) {
  const [score, setScore] = useState<SellerMotivationScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load motivation score
  const loadScore = useCallback(async () => {
    if (!leadId && !dealId && !attomId) {
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await intelligenceService.getMotivationScore({
        leadId,
        dealId,
        attomId,
      })

      if (fetchError) throw fetchError
      setScore(data)
      setError(null)
    } catch (err) {
      console.error('Error loading motivation score:', err)
      setError('Failed to load motivation score')
    } finally {
      setLoading(false)
    }
  }, [leadId, dealId, attomId])

  useEffect(() => {
    loadScore()
  }, [loadScore])

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Seller Motivation</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    )
  }

  // Render empty state (no score yet)
  if (!score) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Seller Motivation</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No motivation data available yet.
          </Text>
          {onEnrich && (
            <TouchableOpacity
              style={styles.enrichButton}
              onPress={onEnrich}
              disabled={enriching}
            >
              {enriching ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.enrichButtonText}>Enrich Seller Data</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // Get score color
  const scoreColor = getMotivationColor(score.motivation_level)
  const overallScore = score.motivation_score || 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Seller Motivation</Text>
        {score.last_enriched && (
          <Text style={styles.lastUpdated}>
            Updated {formatRelativeTime(score.last_enriched)}
          </Text>
        )}
      </View>

      {/* Overall Score */}
      <View style={styles.overallScoreContainer}>
        <View style={[styles.overallScoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.overallScoreValue, { color: scoreColor }]}>
            {overallScore}
          </Text>
          <Text style={styles.overallScoreLabel}>/ 100</Text>
        </View>
        <View style={styles.overallScoreInfo}>
          <Text style={[styles.motivationLevel, { color: scoreColor }]}>
            {formatMotivationLevel(score.motivation_level)}
          </Text>
          {score.outreach_angle && (
            <Text style={styles.outreachAngle} numberOfLines={2}>
              {score.outreach_angle}
            </Text>
          )}
        </View>
      </View>

      {/* Component Scores */}
      <View style={styles.componentsContainer}>
        {SCORE_COMPONENTS.map(({ key, label, icon }) => {
          const componentScore = (score as any)[key] as number | undefined
          if (componentScore === undefined || componentScore === null) return null

          return (
            <View key={key} style={styles.componentRow}>
              <View style={styles.componentLabel}>
                <Text style={styles.componentIcon}>{icon}</Text>
                <Text style={styles.componentName}>{label}</Text>
              </View>
              <View style={styles.componentBarContainer}>
                <View
                  style={[
                    styles.componentBar,
                    {
                      width: `${componentScore}%`,
                      backgroundColor: getBarColor(componentScore),
                    },
                  ]}
                />
              </View>
              <Text style={styles.componentValue}>{componentScore}</Text>
            </View>
          )
        })}
      </View>

      {/* Risk Factors */}
      {score.risk_factors && score.risk_factors.length > 0 && (
        <View style={styles.riskContainer}>
          <Text style={styles.riskTitle}>Risk Factors</Text>
          <View style={styles.riskList}>
            {score.risk_factors.slice(0, 3).map((risk, index) => (
              <View key={index} style={styles.riskBadge}>
                <Text style={styles.riskText}>{risk}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Refresh button */}
      {onEnrich && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onEnrich}
          disabled={enriching}
        >
          {enriching ? (
            <ActivityIndicator size="small" color={colors.brand[600]} />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh Data</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

// Helper: Format motivation level
function formatMotivationLevel(level?: string): string {
  switch (level) {
    case 'very_high':
      return 'Very High Motivation'
    case 'high':
      return 'High Motivation'
    case 'medium':
      return 'Medium Motivation'
    case 'low':
      return 'Low Motivation'
    default:
      return 'Unknown'
  }
}

// Helper: Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

// Helper: Get bar color based on score
function getBarColor(score: number): string {
  if (score >= 70) return colors.success[500]
  if (score >= 40) return colors.warning[500]
  return colors.slate[300]
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
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
    color: colors.slate[800],
  },
  lastUpdated: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  enrichButton: {
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  enrichButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  overallScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  overallScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
  },
  overallScoreValue: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
  },
  overallScoreLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: -4,
  },
  overallScoreInfo: {
    flex: 1,
  },
  motivationLevel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  outreachAngle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    lineHeight: 20,
  },
  componentsContainer: {
    gap: spacing.sm,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  componentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    gap: spacing.xs,
  },
  componentIcon: {
    fontSize: 12,
  },
  componentName: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  componentBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.slate[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  componentBar: {
    height: '100%',
    borderRadius: 4,
  },
  componentValue: {
    width: 28,
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    textAlign: 'right',
  },
  riskContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  riskTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  riskList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  riskBadge: {
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  riskText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
  },
  refreshButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  refreshButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
})

export default SellerMotivationCard
