/**
 * Pipeline Screen - Enhanced v2
 *
 * A premium Kanban-style deal pipeline with:
 * - Search bar for filtering deals
 * - Summary stats bar with key metrics
 * - View mode toggle (Kanban/List/Compact)
 * - Rich deal cards with exit strategy, profit, ROI%
 * - Stage insights (value, count, bottleneck warnings)
 * - Quick actions with working Move Stage, Call, Archive
 * - Snap-to-column scrolling
 * - Collapsed empty stages (chips)
 * - Smooth animations + haptic feedback
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  TextInput,
  Alert,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { Link, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Swipeable } from 'react-native-gesture-handler'
import { ScreenContainer, StuckDealsAlert, DealTimelinePreview, type StuckDeal } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { DEAL_STAGE_CONFIG } from '../../src/types'
import { getDeals, updateDealStage, pipelineService } from '../../src/services'
import type { DealStage, DealWithProperty } from '../../src/types'
import type { Pipeline } from '../../src/services/pipelineService'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_WIDTH = SCREEN_WIDTH * 0.85
const COMPACT_COLUMN_WIDTH = SCREEN_WIDTH * 0.48
const COLUMN_GAP = spacing.md

// View modes
type ViewMode = 'kanban' | 'list' | 'compact'

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

// Exit strategy display config
const EXIT_STRATEGY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  flip: { label: 'Flip', color: '#059669', bg: '#d1fae5' },
  brrrr: { label: 'BRRRR', color: '#7c3aed', bg: '#ede9fe' },
  wholesale: { label: 'Wholesale', color: '#0891b2', bg: '#cffafe' },
  hold: { label: 'Hold', color: '#ca8a04', bg: '#fef9c3' },
  subject_to: { label: 'Sub-To', color: '#dc2626', bg: '#fee2e2' },
  lease_option: { label: 'L/O', color: '#2563eb', bg: '#dbeafe' },
  other: { label: 'Other', color: '#64748b', bg: '#f1f5f9' },
}

// Calculate days in current stage
function getDaysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt)
  const now = new Date()
  return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24))
}

// Get urgency level based on days in stage
function getUrgencyLevel(days: number, stage: DealStage): 'normal' | 'warning' | 'critical' {
  const thresholds: Record<string, { warning: number; critical: number }> = {
    lead: { warning: 3, critical: 7 },
    researching: { warning: 5, critical: 10 },
    evaluating: { warning: 7, critical: 14 },
    analyzing: { warning: 5, critical: 10 },
    offer_pending: { warning: 3, critical: 7 },
    under_contract: { warning: 14, critical: 30 },
    due_diligence: { warning: 10, critical: 21 },
    closing: { warning: 7, critical: 14 },
  }
  const threshold = thresholds[stage] || { warning: 7, critical: 14 }
  if (days >= threshold.critical) return 'critical'
  if (days >= threshold.warning) return 'warning'
  return 'normal'
}

// Format price
function formatPrice(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  return `$${Math.round(value / 1000)}K`
}

// Format compact number
function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return value.toString()
}

// Calculate ROI percentage
function calculateROI(profit: number, investment: number): number | null {
  if (!profit || !investment || investment === 0) return null
  return Math.round((profit / investment) * 100)
}

// Get progress percentage based on stage
function getStageProgress(stage: DealStage): number {
  const stageIndex = PIPELINE_STAGES.indexOf(stage)
  if (stageIndex === -1) return 0
  return Math.round(((stageIndex + 1) / PIPELINE_STAGES.length) * 100)
}

// ============================================================================
// SEARCH BAR COMPONENT
// ============================================================================

interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
}

function SearchBar({ value, onChangeText, placeholder = 'Search deals...' }: SearchBarProps) {
  return (
    <View style={searchStyles.container}>
      <Text style={searchStyles.icon}>🔍</Text>
      <TextInput
        style={searchStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate[400]}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={searchStyles.clearButton}>
          <Text style={searchStyles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const searchStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    height: 40,
  },
  icon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearIcon: {
    fontSize: 12,
    color: colors.slate[400],
  },
})

// ============================================================================
// SIMPLIFIED STAT CARD COMPONENT (Mobile-optimized)
// ============================================================================

interface StatCardProps {
  label: string
  value: string
  icon: string
  color: string
  highlight?: boolean
}

function StatCard({ label, value, icon, color, highlight }: StatCardProps) {
  return (
    <View style={[statStyles.card, highlight && statStyles.cardHighlight]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  )
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  cardHighlight: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
})

// ============================================================================
// VIEW MODE TOGGLE
// ============================================================================

interface ViewModeToggleProps {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
}

function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  const modes: { key: ViewMode; icon: string; label: string }[] = [
    { key: 'kanban', icon: '▣', label: 'Kanban' },
    { key: 'list', icon: '☰', label: 'List' },
    { key: 'compact', icon: '⊞', label: 'Compact' },
  ]

  return (
    <View style={toggleStyles.container}>
      {modes.map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[toggleStyles.button, mode === m.key && toggleStyles.buttonActive]}
          onPress={() => onModeChange(m.key)}
        >
          <Text style={[toggleStyles.icon, mode === m.key && toggleStyles.iconActive]}>
            {m.icon}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const toggleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    padding: 3,
  },
  button: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  buttonActive: {
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  icon: {
    fontSize: 16,
    color: colors.slate[400],
  },
  iconActive: {
    color: colors.brand[600],
  },
})

// ============================================================================
// ENHANCED DEAL CARD
// ============================================================================

// Helper to get next stage
function getNextStage(currentStage: DealStage): DealStage | null {
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage)
  if (currentIndex === -1 || currentIndex >= PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[currentIndex + 1]
}

interface DealCardProps {
  deal: DealWithProperty
  compact?: boolean
  onLongPress?: () => void
  onSwipeAdvance?: (dealId: string, newStage: DealStage) => void
  timelineExpanded?: boolean
  onToggleTimeline?: () => void
}

function DealCard({ deal, compact = false, onLongPress, onSwipeAdvance, timelineExpanded = false, onToggleTimeline }: DealCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const swipeableRef = useRef<Swipeable>(null)

  const address = deal.property?.address_line1 || deal.deal_name || 'Unnamed'
  const city = deal.property?.city || ''
  const price = deal.contract_price || deal.offer_price || deal.asking_price || 0
  const arv = deal.arv || 0
  const profit = deal.expected_profit || 0
  const roi = calculateROI(profit, price)
  const daysInStage = deal.stage_entered_at ? getDaysInStage(deal.stage_entered_at) : 0
  const urgency = getUrgencyLevel(daysInStage, deal.stage)
  const exitStrategy = deal.exit_strategy || 'other'
  const exitConfig = EXIT_STRATEGY_CONFIG[exitStrategy] || EXIT_STRATEGY_CONFIG.other
  const nextStage = getNextStage(deal.stage)
  const nextStageConfig = nextStage ? DEAL_STAGE_CONFIG[nextStage] : null

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start()
  }

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onLongPress?.()
  }

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    if (direction === 'right' && nextStage && onSwipeAdvance) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSwipeAdvance(deal.id, nextStage)
      swipeableRef.current?.close()
    }
  }

  // Render the swipe action (shown when swiping right)
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!nextStage || !nextStageConfig) return null

    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    })

    return (
      <Animated.View
        style={[
          cardStyles.swipeAction,
          { transform: [{ translateX }] },
        ]}
      >
        <View style={[cardStyles.swipeActionContent, { backgroundColor: nextStageConfig.color }]}>
          <Text style={cardStyles.swipeActionIcon}>→</Text>
          <Text style={cardStyles.swipeActionText}>{nextStageConfig.label}</Text>
        </View>
      </Animated.View>
    )
  }

  // Compact card (no swipe support)
  if (compact) {
    return (
      <Link href={`/property/${deal.id}`} asChild>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          delayLongPress={400}
        >
          <Animated.View style={[cardStyles.compactCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={cardStyles.compactAddress} numberOfLines={1}>{address}</Text>
            <View style={cardStyles.compactRow}>
              {price > 0 && <Text style={cardStyles.compactPrice}>{formatPrice(price)}</Text>}
              <View style={[cardStyles.compactBadge, { backgroundColor: exitConfig.bg }]}>
                <Text style={[cardStyles.compactBadgeText, { color: exitConfig.color }]}>{exitConfig.label}</Text>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Link>
    )
  }

  // Full card with swipe-to-advance
  const cardContent = (
    <Animated.View style={[cardStyles.card, { transform: [{ scale: scaleAnim }] }]}>
      {/* Urgency indicator */}
      {urgency !== 'normal' && (
        <View style={[
          cardStyles.urgencyBar,
          urgency === 'warning' && cardStyles.urgencyWarning,
          urgency === 'critical' && cardStyles.urgencyCritical,
        ]} />
      )}

      {/* Header row */}
      <View style={cardStyles.headerRow}>
        <View style={[cardStyles.exitBadge, { backgroundColor: exitConfig.bg }]}>
          <Text style={[cardStyles.exitBadgeText, { color: exitConfig.color }]}>
            {exitConfig.label}
          </Text>
        </View>
        <View style={[
          cardStyles.daysContainer,
          urgency === 'warning' && cardStyles.daysWarning,
          urgency === 'critical' && cardStyles.daysCritical,
        ]}>
          <Text style={[
            cardStyles.daysText,
            urgency === 'warning' && { color: '#d97706' },
            urgency === 'critical' && { color: '#dc2626' },
          ]}>
            {daysInStage}d
          </Text>
        </View>
      </View>

      {/* Address */}
      <Text style={cardStyles.address} numberOfLines={2}>{address}</Text>
      {city && <Text style={cardStyles.city}>{city}</Text>}

      {/* Price & profit row */}
      <View style={cardStyles.metricsRow}>
        {price > 0 && (
          <View style={cardStyles.metric}>
            <Text style={cardStyles.metricLabel}>Price</Text>
            <Text style={cardStyles.metricValue}>{formatPrice(price)}</Text>
          </View>
        )}
        {arv > 0 && (
          <View style={cardStyles.metric}>
            <Text style={cardStyles.metricLabel}>ARV</Text>
            <Text style={cardStyles.metricValue}>{formatPrice(arv)}</Text>
          </View>
        )}
        {profit > 0 && (
          <View style={cardStyles.metric}>
            <Text style={cardStyles.metricLabel}>Profit</Text>
            <Text style={[cardStyles.metricValue, cardStyles.profitValue]}>
              {formatPrice(profit)}
            </Text>
          </View>
        )}
        {roi !== null && (
          <View style={cardStyles.metric}>
            <Text style={cardStyles.metricLabel}>ROI</Text>
            <Text style={[cardStyles.metricValue, roi >= 20 ? cardStyles.roiGood : cardStyles.roiNormal]}>
              {roi}%
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar showing deal progress */}
      <View style={cardStyles.progressContainer}>
        <View style={cardStyles.progressBg}>
          <View
            style={[
              cardStyles.progressFill,
              { width: `${getStageProgress(deal.stage)}%` },
            ]}
          />
        </View>
      </View>

      {/* Swipe hint for deals with next stage */}
      {nextStage && (
        <View style={cardStyles.swipeHint}>
          <Text style={cardStyles.swipeHintText}>← swipe to advance</Text>
        </View>
      )}

      {/* Expandable Timeline Preview */}
      {onToggleTimeline && (
        <DealTimelinePreview
          dealId={deal.id}
          expanded={timelineExpanded}
          onToggle={onToggleTimeline}
        />
      )}
    </Animated.View>
  )

  // Wrap in Swipeable if there's a next stage
  if (nextStage && onSwipeAdvance) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeOpen}
        rightThreshold={80}
        overshootRight={false}
      >
        <Link href={`/property/${deal.id}`} asChild>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            delayLongPress={400}
          >
            {cardContent}
          </Pressable>
        </Link>
      </Swipeable>
    )
  }

  // No swipe for last stage
  return (
    <Link href={`/property/${deal.id}`} asChild>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        {cardContent}
      </Pressable>
    </Link>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    ...shadows.soft,
    overflow: 'hidden',
  },
  compactCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  compactAddress: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactPrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  compactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  compactBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  urgencyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  urgencyWarning: {
    backgroundColor: '#fbbf24',
  },
  urgencyCritical: {
    backgroundColor: '#ef4444',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exitBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  exitBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  daysContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
    backgroundColor: colors.slate[100],
  },
  daysWarning: {
    backgroundColor: '#fef3c7',
  },
  daysCritical: {
    backgroundColor: '#fee2e2',
  },
  daysText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  address: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    lineHeight: 24,
  },
  city: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  profitValue: {
    color: '#059669',
  },
  roiGood: {
    color: '#059669',
  },
  roiNormal: {
    color: colors.ink,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBg: {
    height: 3,
    backgroundColor: colors.slate[100],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand[500],
    borderRadius: 2,
  },
  // Swipe-to-advance styles
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  swipeActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    marginRight: spacing.sm,
    minWidth: 100,
    height: '100%',
  },
  swipeActionIcon: {
    fontSize: 20,
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.xs,
  },
  swipeActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  swipeHint: {
    marginTop: spacing.xs,
    alignItems: 'flex-end',
  },
  swipeHintText: {
    fontSize: 10,
    color: colors.slate[300],
    fontStyle: 'italic',
  },
})

// ============================================================================
// LIST VIEW DEAL ROW
// ============================================================================

interface ListDealRowProps {
  deal: DealWithProperty
  onLongPress?: () => void
}

function ListDealRow({ deal, onLongPress }: ListDealRowProps) {
  const address = deal.property?.address_line1 || deal.deal_name || 'Unnamed'
  const price = deal.contract_price || deal.offer_price || 0
  const profit = deal.expected_profit || 0
  const exitStrategy = deal.exit_strategy || 'other'
  const exitConfig = EXIT_STRATEGY_CONFIG[exitStrategy] || EXIT_STRATEGY_CONFIG.other
  const stageConfig = DEAL_STAGE_CONFIG[deal.stage]
  const daysInStage = deal.stage_entered_at ? getDaysInStage(deal.stage_entered_at) : 0

  return (
    <Link href={`/property/${deal.id}`} asChild>
      <TouchableOpacity
        style={listStyles.row}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onLongPress?.()
        }}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={[listStyles.stageDot, { backgroundColor: stageConfig.color }]} />
        <View style={listStyles.info}>
          <Text style={listStyles.address} numberOfLines={1}>{address}</Text>
          <View style={listStyles.metaRow}>
            <Text style={listStyles.stage}>{stageConfig.label}</Text>
            <Text style={listStyles.separator}>•</Text>
            <Text style={listStyles.days}>{daysInStage}d</Text>
          </View>
        </View>
        <View style={listStyles.metrics}>
          {price > 0 && <Text style={listStyles.price}>{formatPrice(price)}</Text>}
          {profit > 0 && <Text style={listStyles.profit}>+{formatPrice(profit)}</Text>}
        </View>
        <View style={[listStyles.exitBadge, { backgroundColor: exitConfig.bg }]}>
          <Text style={[listStyles.exitText, { color: exitConfig.color }]}>{exitConfig.label}</Text>
        </View>
      </TouchableOpacity>
    </Link>
  )
}

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
  },
  address: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stage: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  separator: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[300],
    marginHorizontal: spacing.xs,
  },
  days: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
  metrics: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  price: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  profit: {
    fontSize: typography.fontSize.sm,
    color: '#059669',
    fontWeight: typography.fontWeight.semibold,
  },
  exitBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
  },
  exitText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
})

// ============================================================================
// STAGE COLUMN COMPONENT
// ============================================================================

interface StageColumnProps {
  stage: DealStage
  deals: DealWithProperty[]
  viewMode: ViewMode
  onQuickAction: (deal: DealWithProperty) => void
  onSwipeAdvance?: (dealId: string, newStage: DealStage) => void
}

function StageColumn({ stage, deals, viewMode, onQuickAction, onSwipeAdvance }: StageColumnProps) {
  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set())
  const config = DEAL_STAGE_CONFIG[stage]
  const stageDeals = deals.filter((d) => d.stage === stage)
  const totalValue = stageDeals.reduce((sum, d) => sum + (d.contract_price || d.offer_price || 0), 0)
  const totalProfit = stageDeals.reduce((sum, d) => sum + (d.expected_profit || 0), 0)
  const avgDays = stageDeals.length > 0
    ? Math.round(stageDeals.reduce((sum, d) => sum + (d.stage_entered_at ? getDaysInStage(d.stage_entered_at) : 0), 0) / stageDeals.length)
    : 0

  // Check for bottleneck (too many deals or high avg days)
  const isBottleneck = stageDeals.length >= 5 || avgDays > 10

  const columnWidth = viewMode === 'compact' ? COMPACT_COLUMN_WIDTH : COLUMN_WIDTH

  const toggleTimeline = (dealId: string) => {
    setExpandedTimelines((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }
      return next
    })
  }

  return (
    <View style={[columnStyles.container, { width: columnWidth }]}>
      {/* Stage Header */}
      <LinearGradient
        colors={[config.color + '15', 'transparent']}
        style={columnStyles.headerGradient}
      >
        <View style={columnStyles.header}>
          <View style={columnStyles.headerTop}>
            <View style={[columnStyles.dot, { backgroundColor: config.color }]} />
            <Text style={columnStyles.title}>{config.label}</Text>
            <View style={[columnStyles.count, isBottleneck && columnStyles.countWarning]}>
              <Text style={[columnStyles.countText, isBottleneck && { color: '#dc2626' }]}>
                {stageDeals.length}
              </Text>
            </View>
          </View>
          {viewMode !== 'compact' && (
            <View style={columnStyles.headerMeta}>
              <Text style={columnStyles.metaText}>
                {totalValue > 0 ? formatCompact(totalValue) : '$0'}
              </Text>
              {totalProfit > 0 && (
                <>
                  <Text style={columnStyles.metaSeparator}>•</Text>
                  <Text style={[columnStyles.metaText, columnStyles.profitText]}>
                    +{formatCompact(totalProfit)}
                  </Text>
                </>
              )}
              <Text style={columnStyles.metaSeparator}>•</Text>
              <Text style={[columnStyles.metaText, avgDays > 7 && { color: '#f59e0b' }]}>
                ~{avgDays}d avg
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Deal Cards */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={columnStyles.content}
        nestedScrollEnabled
      >
        {stageDeals.length === 0 ? (
          <View style={columnStyles.empty}>
            <Text style={columnStyles.emptyIcon}>📭</Text>
            <Text style={columnStyles.emptyText}>No deals</Text>
          </View>
        ) : (
          stageDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              compact={viewMode === 'compact'}
              onLongPress={() => onQuickAction(deal)}
              onSwipeAdvance={onSwipeAdvance}
              timelineExpanded={expandedTimelines.has(deal.id)}
              onToggleTimeline={viewMode !== 'compact' ? () => toggleTimeline(deal.id) : undefined}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const columnStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.xl,
    marginRight: COLUMN_GAP,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  headerGradient: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  count: {
    backgroundColor: colors.slate[200],
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    minWidth: 32,
    alignItems: 'center',
  },
  countWarning: {
    backgroundColor: '#fee2e2',
  },
  countText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[600],
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingLeft: 20,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  profitText: {
    color: '#059669',
    fontWeight: typography.fontWeight.semibold,
  },
  metaSeparator: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[300],
    marginHorizontal: spacing.sm,
  },
  content: {
    padding: spacing.sm,
    paddingTop: 0,
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
})

// ============================================================================
// COLLAPSED STAGE CHIP (for empty stages)
// ============================================================================

interface StageChipProps {
  stage: DealStage
  count: number
  onPress: () => void
}

function StageChip({ stage, count, onPress }: StageChipProps) {
  const config = DEAL_STAGE_CONFIG[stage]
  return (
    <TouchableOpacity style={chipStyles.chip} onPress={onPress} activeOpacity={0.7}>
      <View style={[chipStyles.dot, { backgroundColor: config.color }]} />
      <Text style={chipStyles.label}>{config.label}</Text>
      <Text style={chipStyles.count}>{count}</Text>
    </TouchableOpacity>
  )
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    marginRight: spacing.xs,
  },
  count: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
})

// ============================================================================
// MOVE STAGE MODAL
// ============================================================================

interface MoveStageModalProps {
  visible: boolean
  deal: DealWithProperty | null
  onClose: () => void
  onMove: (dealId: string, newStage: DealStage) => void
}

function MoveStageModal({ visible, deal, onClose, onMove }: MoveStageModalProps) {
  if (!deal) return null

  const currentStageIndex = PIPELINE_STAGES.indexOf(deal.stage)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={moveStyles.overlay} onPress={onClose}>
        <View style={moveStyles.content}>
          <View style={moveStyles.handle} />
          <Text style={moveStyles.title}>Move to Stage</Text>
          <Text style={moveStyles.dealName} numberOfLines={1}>
            {deal.property?.address_line1 || deal.deal_name}
          </Text>
          <ScrollView style={moveStyles.stageList}>
            {PIPELINE_STAGES.map((stage, index) => {
              const config = DEAL_STAGE_CONFIG[stage]
              const isCurrent = deal.stage === stage
              const isPast = index < currentStageIndex
              const isNext = index === currentStageIndex + 1

              return (
                <TouchableOpacity
                  key={stage}
                  style={[
                    moveStyles.stageOption,
                    isCurrent && moveStyles.stageOptionCurrent,
                    isNext && moveStyles.stageOptionNext,
                  ]}
                  onPress={() => {
                    if (!isCurrent) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onMove(deal.id, stage)
                    }
                  }}
                  disabled={isCurrent}
                >
                  <View style={[moveStyles.stageDot, { backgroundColor: config.color }]} />
                  <Text style={[
                    moveStyles.stageName,
                    isCurrent && moveStyles.stageNameCurrent,
                  ]}>
                    {config.label}
                  </Text>
                  {isCurrent && <Text style={moveStyles.currentBadge}>Current</Text>}
                  {isNext && <Text style={moveStyles.nextBadge}>Next →</Text>}
                  {isPast && <Text style={moveStyles.pastIcon}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  )
}

const moveStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 20,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  dealName: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  stageList: {
    paddingHorizontal: spacing.md,
  },
  stageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.slate[50],
  },
  stageOptionCurrent: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[200],
  },
  stageOptionNext: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  stageName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  stageNameCurrent: {
    color: colors.brand[700],
  },
  currentBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.semibold,
  },
  nextBadge: {
    fontSize: typography.fontSize.xs,
    color: '#16a34a',
    fontWeight: typography.fontWeight.semibold,
  },
  pastIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
})

// ============================================================================
// QUICK ACTION MODAL
// ============================================================================

interface QuickActionModalProps {
  visible: boolean
  deal: DealWithProperty | null
  onClose: () => void
  onAction: (action: string) => void
}

function QuickActionModal({ visible, deal, onClose, onAction }: QuickActionModalProps) {
  if (!deal) return null

  const actions = [
    { key: 'call', icon: '📞', label: 'Call Owner', color: '#059669' },
    { key: 'note', icon: '📝', label: 'Add Note', color: '#2563eb' },
    { key: 'task', icon: '✓', label: 'Add Task', color: '#7c3aed' },
    { key: 'move', icon: '→', label: 'Move Stage', color: '#f59e0b' },
    { key: 'analyze', icon: '📊', label: 'Run Analysis', color: '#0891b2' },
    { key: 'archive', icon: '📁', label: 'Archive', color: '#64748b' },
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <View style={modalStyles.content}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.dealName} numberOfLines={1}>
            {deal.property?.address_line1 || deal.deal_name}
          </Text>
          <View style={modalStyles.grid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={modalStyles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAction(action.key)
                }}
              >
                <View style={[modalStyles.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <Text style={modalStyles.actionIconText}>{action.icon}</Text>
                </View>
                <Text style={modalStyles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  dealName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionButton: {
    width: '30%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
    textAlign: 'center',
  },
})

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function PipelineScreen() {
  const router = useRouter()
  const [deals, setDeals] = useState<DealWithProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [selectedStage, setSelectedStage] = useState<DealStage | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Multi-pipeline state
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [showPipelineSelector, setShowPipelineSelector] = useState(false)

  // Quick action state
  const [quickActionDeal, setQuickActionDeal] = useState<DealWithProperty | null>(null)
  const [showQuickAction, setShowQuickAction] = useState(false)

  // Move stage state
  const [showMoveStage, setShowMoveStage] = useState(false)
  const [moveStageDeal, setMoveStageDeal] = useState<DealWithProperty | null>(null)

  // Filter deals by search query
  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals
    const query = searchQuery.toLowerCase()
    return deals.filter((deal) => {
      const address = (deal.property?.address_line1 || '').toLowerCase()
      const city = (deal.property?.city || '').toLowerCase()
      const name = (deal.deal_name || '').toLowerCase()
      return address.includes(query) || city.includes(query) || name.includes(query)
    })
  }, [deals, searchQuery])

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalValue = filteredDeals.reduce((sum, d) => sum + (d.contract_price || d.offer_price || 0), 0)
    const totalProfit = filteredDeals.reduce((sum, d) => sum + (d.expected_profit || 0), 0)
    const needsAttention = filteredDeals.filter((d) => {
      const days = d.stage_entered_at ? getDaysInStage(d.stage_entered_at) : 0
      return getUrgencyLevel(days, d.stage) !== 'normal'
    }).length
    const closedCount = filteredDeals.filter((d) => d.stage === 'closing' || d.stage === 'under_contract').length

    return {
      totalDeals: filteredDeals.length,
      totalValue,
      totalProfit,
      needsAttention,
      closedCount,
    }
  }, [filteredDeals])

  // Calculate stuck deals for alert banner
  const stuckDeals = useMemo((): StuckDeal[] => {
    return filteredDeals
      .filter((d) => {
        const days = d.stage_entered_at ? getDaysInStage(d.stage_entered_at) : 0
        return getUrgencyLevel(days, d.stage) !== 'normal'
      })
      .map((d) => ({
        id: d.id,
        name: d.property?.address_line1 || d.deal_name || 'Unnamed',
        stage: DEAL_STAGE_CONFIG[d.stage]?.label || d.stage,
        daysStuck: d.stage_entered_at ? getDaysInStage(d.stage_entered_at) : 0,
      }))
      .sort((a, b) => b.daysStuck - a.daysStuck)
  }, [filteredDeals])

  // State for dismissing stuck deals alert
  const [stuckAlertDismissed, setStuckAlertDismissed] = useState(false)

  // Fetch pipelines on mount
  useEffect(() => {
    async function loadPipelines() {
      const { data } = await pipelineService.getPipelines()
      if (data && data.length > 0) {
        setPipelines(data)
        const defaultPipeline = data.find((p) => p.is_default) || data[0]
        setSelectedPipeline(defaultPipeline)
      }
    }
    loadPipelines()
  }, [])

  const fetchDeals = useCallback(async () => {
    try {
      const { data, error } = await getDeals({
        status: 'active',
        limit: 100,
        pipeline_id: selectedPipeline?.id,
      })
      if (error) {
        console.error('Error fetching pipeline deals:', error)
      } else {
        // Animate layout changes when deals update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setDeals(data)
      }
    } catch (err) {
      console.error('Pipeline fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedPipeline])

  useEffect(() => {
    if (selectedPipeline || pipelines.length === 0) {
      fetchDeals()
    }
  }, [fetchDeals, selectedPipeline, pipelines.length])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchDeals()
  }, [fetchDeals])

  const handleSelectPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline)
    setShowPipelineSelector(false)
    setLoading(true)
  }

  const handleQuickAction = (deal: DealWithProperty) => {
    setQuickActionDeal(deal)
    setShowQuickAction(true)
  }

  const handleMoveStage = async (dealId: string, newStage: DealStage) => {
    try {
      // Trigger layout animation before state changes
      LayoutAnimation.configureNext({
        duration: 300,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      })

      const { error } = await updateDealStage(dealId, newStage)
      if (error) {
        Alert.alert('Error', 'Failed to move deal')
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setShowMoveStage(false)
        setMoveStageDeal(null)
        fetchDeals()
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong')
    }
  }

  const handleActionSelect = async (action: string) => {
    setShowQuickAction(false)
    if (!quickActionDeal) return

    switch (action) {
      case 'call':
        // Try to get owner phone from property
        const phone = quickActionDeal.property?.owner_phone
        if (phone) {
          const phoneUrl = Platform.OS === 'ios' ? `tel:${phone}` : `tel:${phone}`
          Linking.canOpenURL(phoneUrl).then((supported) => {
            if (supported) {
              Linking.openURL(phoneUrl)
            } else {
              Alert.alert('Cannot Make Call', 'Phone dialer is not available')
            }
          })
        } else {
          Alert.alert('No Phone Number', 'This deal does not have an owner phone number.')
        }
        break
      case 'note':
        router.push(`/property/${quickActionDeal.id}?tab=notes`)
        break
      case 'task':
        router.push(`/property/${quickActionDeal.id}?tab=tasks`)
        break
      case 'move':
        setMoveStageDeal(quickActionDeal)
        setShowMoveStage(true)
        break
      case 'analyze':
        router.push(`/property/${quickActionDeal.id}?tab=analysis`)
        break
      case 'archive':
        Alert.alert(
          'Archive Deal',
          `Are you sure you want to archive "${quickActionDeal.property?.address_line1 || quickActionDeal.deal_name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Archive',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { error } = await updateDealStage(quickActionDeal.id, 'dead')
                  if (error) {
                    Alert.alert('Error', 'Failed to archive deal')
                  } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    fetchDeals()
                  }
                } catch (err) {
                  Alert.alert('Error', 'Something went wrong')
                }
              },
            },
          ]
        )
        break
    }
  }

  // Get stages with deals and empty stages
  const stagesWithCounts = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      count: filteredDeals.filter((d) => d.stage === stage).length,
    }))
  }, [filteredDeals])

  const emptyStages = stagesWithCounts.filter((s) => s.count === 0)
  const activeStages = stagesWithCounts.filter((s) => s.count > 0)

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

  const filteredStages = selectedStage === 'all'
    ? PIPELINE_STAGES
    : PIPELINE_STAGES.filter((s) => s === selectedStage)

  // Render List View
  const renderListView = () => {
    // Group deals by stage
    const groupedDeals = PIPELINE_STAGES.map((stage) => ({
      stage,
      config: DEAL_STAGE_CONFIG[stage],
      deals: filteredDeals.filter((d) => d.stage === stage),
    })).filter((g) => g.deals.length > 0 || selectedStage === g.stage)

    return (
      <FlatList
        data={groupedDeals}
        keyExtractor={(item) => item.stage}
        renderItem={({ item }) => (
          <View style={styles.listSection}>
            <View style={styles.listSectionHeader}>
              <View style={[styles.listSectionDot, { backgroundColor: item.config.color }]} />
              <Text style={styles.listSectionTitle}>{item.config.label}</Text>
              <Text style={styles.listSectionCount}>{item.deals.length}</Text>
            </View>
            {item.deals.map((deal) => (
              <ListDealRow
                key={deal.id}
                deal={deal}
                onLongPress={() => handleQuickAction(deal)}
              />
            ))}
            {item.deals.length === 0 && (
              <Text style={styles.listEmptyText}>No deals in this stage</Text>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
      />
    )
  }

  return (
    <ScreenContainer scrollable={false} padding={false}>
      {/* Pipeline Selector Modal */}
      <Modal
        visible={showPipelineSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPipelineSelector(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPipelineSelector(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Pipeline</Text>
            {pipelines.map((pipeline) => (
              <TouchableOpacity
                key={pipeline.id}
                style={[
                  styles.pipelineOption,
                  selectedPipeline?.id === pipeline.id && styles.pipelineOptionActive,
                ]}
                onPress={() => handleSelectPipeline(pipeline)}
              >
                <View style={[styles.pipelineColor, { backgroundColor: pipeline.color }]} />
                <View style={styles.pipelineInfo}>
                  <Text
                    style={[
                      styles.pipelineName,
                      selectedPipeline?.id === pipeline.id && styles.pipelineNameActive,
                    ]}
                  >
                    {pipeline.name}
                  </Text>
                  <Text style={styles.pipelineMeta}>
                    {pipeline.deal_count} deals
                    {pipeline.is_default && ' • Default'}
                  </Text>
                </View>
                {selectedPipeline?.id === pipeline.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Quick Action Modal */}
      <QuickActionModal
        visible={showQuickAction}
        deal={quickActionDeal}
        onClose={() => setShowQuickAction(false)}
        onAction={handleActionSelect}
      />

      {/* Move Stage Modal */}
      <MoveStageModal
        visible={showMoveStage}
        deal={moveStageDeal}
        onClose={() => {
          setShowMoveStage(false)
          setMoveStageDeal(null)
        }}
        onMove={handleMoveStage}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Pipeline</Text>
            {pipelines.length > 1 && (
              <TouchableOpacity
                style={styles.pipelineSelector}
                onPress={() => setShowPipelineSelector(true)}
              >
                <View
                  style={[styles.selectorDot, { backgroundColor: selectedPipeline?.color || colors.brand[500] }]}
                />
                <Text style={styles.selectorText} numberOfLines={1}>
                  {selectedPipeline?.name || 'All Pipelines'}
                </Text>
                <Text style={styles.selectorArrow}>▾</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshIcon}>↻</Text>
            </TouchableOpacity>
            <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by address or name..."
      />

      {/* Stuck Deals Alert Banner */}
      {!stuckAlertDismissed && stuckDeals.length > 0 && (
        <StuckDealsAlert
          stuckDeals={stuckDeals}
          onPress={() => {
            // Navigate to first stuck deal
            if (stuckDeals.length > 0) {
              router.push(`/property/${stuckDeals[0].id}`)
            }
          }}
          onDismiss={() => setStuckAlertDismissed(true)}
        />
      )}

      {/* Stats Row - Simplified 3-stat display */}
      <View style={styles.statsRow}>
        <StatCard
          icon="📋"
          label="Active Deals"
          value={stats.totalDeals.toString()}
          color={colors.brand[600]}
        />
        <StatCard
          icon="💰"
          label="Pipeline"
          value={formatCompact(stats.totalValue)}
          color="#059669"
        />
        <StatCard
          icon="⚠️"
          label="Attention"
          value={stats.needsAttention.toString()}
          color={stats.needsAttention > 0 ? '#dc2626' : colors.slate[400]}
          highlight={stats.needsAttention > 0}
        />
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
          <Text style={[styles.filterPillText, selectedStage === 'all' && styles.filterPillTextActive]}>
            All ({stats.totalDeals})
          </Text>
        </TouchableOpacity>
        {PIPELINE_STAGES.map((stage) => {
          const stageCount = filteredDeals.filter((d) => d.stage === stage).length
          if (stageCount === 0 && viewMode !== 'list') return null // Hide empty in kanban
          return (
            <TouchableOpacity
              key={stage}
              style={[styles.filterPill, selectedStage === stage && styles.filterPillActive]}
              onPress={() => setSelectedStage(stage)}
            >
              <View style={[styles.filterDot, { backgroundColor: DEAL_STAGE_CONFIG[stage].color }]} />
              <Text style={[styles.filterPillText, selectedStage === stage && styles.filterPillTextActive]}>
                {DEAL_STAGE_CONFIG[stage].label}
              </Text>
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{stageCount}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* View Content */}
      {viewMode === 'list' ? (
        renderListView()
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanbanContainer}
          snapToInterval={viewMode === 'compact' ? COMPACT_COLUMN_WIDTH + COLUMN_GAP : COLUMN_WIDTH + COLUMN_GAP}
          decelerationRate="fast"
          snapToAlignment="start"
        >
          {filteredStages.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              deals={filteredDeals}
              viewMode={viewMode}
              onQuickAction={handleQuickAction}
              onSwipeAdvance={handleMoveStage}
            />
          ))}
        </ScrollView>
      )}

      {/* Empty State */}
      {stats.totalDeals === 0 && !searchQuery && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
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

      {/* No Search Results */}
      {stats.totalDeals === 0 && searchQuery && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyText}>
            No deals match "{searchQuery}"
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setSearchQuery('')}>
            <Text style={styles.emptyButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/property/new')
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.brand[500], colors.brand[600]]}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 18,
    color: colors.slate[600],
  },
  // Pipeline Selector
  pipelineSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  selectorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  selectorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    maxWidth: 150,
  },
  selectorArrow: {
    fontSize: 10,
    color: colors.slate[400],
    marginLeft: spacing.xs,
  },
  // Stats Row - simplified horizontal layout
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  // Chips Row
  chipsRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginRight: spacing.sm,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    width: '100%',
    maxWidth: 320,
    ...shadows.large,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pipelineOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  pipelineOptionActive: {
    backgroundColor: colors.brand[50],
  },
  pipelineColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  pipelineInfo: {
    flex: 1,
  },
  pipelineName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  pipelineNameActive: {
    color: colors.brand[700],
  },
  pipelineMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.bold,
  },
  // Filter Row
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[100],
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.brand[100],
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterPillText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  filterPillTextActive: {
    color: colors.brand[700],
  },
  filterCount: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginLeft: 4,
  },
  filterCountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[500],
  },
  // Kanban
  kanbanContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg + 80,
  },
  // List View
  listContainer: {
    paddingBottom: spacing.xl + 80,
  },
  listSection: {
    marginBottom: spacing.sm,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[50],
  },
  listSectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  listSectionTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
  listEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    fontStyle: 'italic',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  // Loading
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
  // Empty State
  emptyContainer: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    ...shadows.large,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    fontWeight: typography.fontWeight.normal,
    marginTop: -2,
  },
})
