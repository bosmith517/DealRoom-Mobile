/**
 * Pipeline Screen
 *
 * Kanban-style deal pipeline view with real data from Supabase.
 */

import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { ScreenContainer, Card } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { DEAL_STAGE_CONFIG } from '../../src/types'
import { getDeals } from '../../src/services'
import type { DealStage, DealWithProperty } from '../../src/types'

// Visible stages for pipeline view (active stages only)
const PIPELINE_STAGES: DealStage[] = [
  'lead',
  'researching',
  'evaluating',
  'analyzing',
  'offer_pending',
  'under_contract',
  'due_diligence',
  'closing',
]

// Calculate days in current stage
function getDaysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt)
  const now = new Date()
  return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24))
}

// Format price
function formatPrice(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  return `$${(value / 1000).toFixed(0)}K`
}

// Stage column component
function StageColumn({
  stage,
  deals,
}: {
  stage: DealStage
  deals: DealWithProperty[]
}) {
  const config = DEAL_STAGE_CONFIG[stage]
  const stageDeals = deals.filter((d) => d.stage === stage)

  return (
    <View style={styles.stageColumn}>
      {/* Stage Header */}
      <View style={styles.stageHeader}>
        <View style={[styles.stageDot, { backgroundColor: config.color }]} />
        <Text style={styles.stageTitle}>{config.label}</Text>
        <View style={styles.stageCount}>
          <Text style={styles.stageCountText}>{stageDeals.length}</Text>
        </View>
      </View>

      {/* Deal Cards */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.stageContent}
      >
        {stageDeals.length === 0 ? (
          <View style={styles.emptyStage}>
            <Text style={styles.emptyStageText}>No deals</Text>
          </View>
        ) : (
          stageDeals.map((deal) => {
            const address = deal.property?.address_line1 || deal.deal_name || 'Unnamed'
            const city = deal.property?.city || ''
            const price = deal.contract_price || deal.offer_price || deal.asking_price || 0
            const daysInStage = getDaysInStage(deal.stage_entered_at)

            return (
              <Link key={deal.id} href={`/property/${deal.id}`} asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Card style={styles.dealCard} padding="sm">
                    <Text style={styles.dealAddress} numberOfLines={1}>
                      {address}
                    </Text>
                    {city && <Text style={styles.dealCity}>{city}</Text>}
                    <View style={styles.dealMeta}>
                      {price > 0 && (
                        <Text style={styles.dealPrice}>{formatPrice(price)}</Text>
                      )}
                      <Text style={styles.dealDays}>{daysInStage}d</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              </Link>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

export default function PipelineScreen() {
  const [deals, setDeals] = useState<DealWithProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStage, setSelectedStage] = useState<DealStage | 'all'>('all')

  const fetchDeals = useCallback(async () => {
    try {
      const { data, error } = await getDeals({ status: 'active', limit: 100 })
      if (error) {
        console.error('Error fetching pipeline deals:', error)
      } else {
        setDeals(data)
      }
    } catch (err) {
      console.error('Pipeline fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchDeals()
  }, [fetchDeals])

  const totalDeals = deals.length

  if (loading) {
    return (
      <ScreenContainer scrollable={false} padding={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading pipeline...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer scrollable={false} padding={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deal Pipeline</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.dealCount}>{totalDeals} deals</Text>
        </View>
      </View>

      {/* Stage Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterPill, selectedStage === 'all' && styles.filterPillActive]}
          onPress={() => setSelectedStage('all')}
        >
          <Text
            style={[
              styles.filterPillText,
              selectedStage === 'all' && styles.filterPillTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {PIPELINE_STAGES.map((stage) => (
          <TouchableOpacity
            key={stage}
            style={[
              styles.filterPill,
              selectedStage === stage && styles.filterPillActive,
            ]}
            onPress={() => setSelectedStage(stage)}
          >
            <View
              style={[
                styles.filterDot,
                { backgroundColor: DEAL_STAGE_CONFIG[stage].color },
              ]}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedStage === stage && styles.filterPillTextActive,
              ]}
            >
              {DEAL_STAGE_CONFIG[stage].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Kanban View */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanbanContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[500]}
          />
        }
      >
        {PIPELINE_STAGES.filter(
          (stage) => selectedStage === 'all' || selectedStage === stage
        ).map((stage) => (
          <StageColumn key={stage} stage={stage} deals={deals} />
        ))}
      </ScrollView>

      {/* Empty State */}
      {totalDeals === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No active deals</Text>
          <Text style={styles.emptyText}>
            Create a deal to see it in your pipeline.
          </Text>
          <Link href="/property/new" asChild>
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>+ New Deal</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealCount: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.slate[100],
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.brand[100],
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterPillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  filterPillTextActive: {
    color: colors.brand[700],
  },
  kanbanContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  stageColumn: {
    width: 260,
    backgroundColor: colors.slate[50],
    borderRadius: radii.xl,
    padding: spacing.sm,
    maxHeight: '100%',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    marginBottom: spacing.sm,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  stageTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  stageCount: {
    backgroundColor: colors.slate[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  stageCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  stageContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyStage: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyStageText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
  dealCard: {
    backgroundColor: colors.white,
  },
  dealAddress: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  dealCity: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  dealMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealPrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  dealDays: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  emptyContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
  emptyButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
})
