/**
 * Pipeline Screen
 *
 * Kanban-style deal pipeline view.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Link } from 'expo-router'
import { ScreenContainer, Card } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { DEAL_STAGE_CONFIG, DealStage } from '../../src/types'

// Mock deals data
const MOCK_DEALS = [
  { id: '1', address: '123 Main St', city: 'Chicago', stage: 'lead' as DealStage, arv: 285000, daysInStage: 3 },
  { id: '2', address: '456 Oak Ave', city: 'Naperville', stage: 'researching' as DealStage, arv: 425000, daysInStage: 5 },
  { id: '3', address: '789 Pine Rd', city: 'Aurora', stage: 'negotiating' as DealStage, arv: 195000, daysInStage: 12 },
  { id: '4', address: '321 Elm St', city: 'Evanston', stage: 'under_contract' as DealStage, arv: 310000, daysInStage: 7 },
  { id: '5', address: '654 Maple Dr', city: 'Schaumburg', stage: 'due_diligence' as DealStage, arv: 275000, daysInStage: 4 },
  { id: '6', address: '987 Cedar Ln', city: 'Oak Park', stage: 'closing' as DealStage, arv: 365000, daysInStage: 2 },
]

// Stage column component
function StageColumn({
  stage,
  deals,
}: {
  stage: DealStage
  deals: typeof MOCK_DEALS
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
        {stageDeals.map((deal) => (
          <Link key={deal.id} href={`/property/${deal.id}`} asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Card style={styles.dealCard} padding="sm">
                <Text style={styles.dealAddress} numberOfLines={1}>
                  {deal.address}
                </Text>
                <Text style={styles.dealCity}>{deal.city}</Text>
                <View style={styles.dealMeta}>
                  <Text style={styles.dealArv}>
                    ${(deal.arv / 1000).toFixed(0)}K
                  </Text>
                  <Text style={styles.dealDays}>{deal.daysInStage}d</Text>
                </View>
              </Card>
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>
    </View>
  )
}

// Visible stages for pipeline view
const PIPELINE_STAGES: DealStage[] = [
  'lead',
  'researching',
  'contacted',
  'negotiating',
  'offer_sent',
  'under_contract',
  'due_diligence',
  'closing',
]

export default function PipelineScreen() {
  const [selectedStage, setSelectedStage] = useState<DealStage | 'all'>('all')

  return (
    <ScreenContainer scrollable={false} padding={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deal Pipeline</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.dealCount}>{MOCK_DEALS.length} deals</Text>
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
      >
        {PIPELINE_STAGES.filter(
          (stage) => selectedStage === 'all' || selectedStage === stage
        ).map((stage) => (
          <StageColumn key={stage} stage={stage} deals={MOCK_DEALS} />
        ))}
      </ScrollView>
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
  dealArv: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  dealDays: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
})
