/**
 * Dashboard / Today Screen
 *
 * Start of day view with:
 * - Quick actions (Start Driving, New Deal, Search)
 * - Hot leads (last 24h captures not yet analyzed)
 * - Today's tasks/follow-ups
 * - Pipeline KPIs
 * - Recent deals
 */

import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { Link, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { ScreenContainer, Card, Button, GoalTrackingWidget, WeekCalendarStrip, PipelineHealthGauge, QuickWinCard } from '../../src/components'
import { colors, spacing, typography, shadows, radii } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'
import { useSettings } from '../../src/contexts/SettingsContext'
import { useFeatureGate } from '../../src/hooks/useFeatureGate'
import { getDashboardStats, getRecentDeals, getLeads, getUpcomingFollowups, getOverdueFollowups, calendarService, getDailyFocus, getTimeBasedGreeting } from '../../src/services'
import type { CalendarEvent } from '../../src/services/calendarService'
import type { DailyFocus } from '../../src/services/dashboardService'
import { supabase } from '../../src/lib/supabase'
import { DEAL_STAGE_CONFIG } from '../../src/types'
import type { DashboardStats, DealWithProperty, DealStage, Lead, Followup } from '../../src/types'

// Reverse geocode coordinates to address
async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
} | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (results && results.length > 0) {
      const loc = results[0]
      const streetNumber = loc.streetNumber || ''
      const street = loc.street || ''
      const address = streetNumber && street
        ? `${streetNumber} ${street}`.trim()
        : street || loc.name || null

      return {
        address,
        city: loc.city || loc.subregion || null,
        state: loc.region || null,
        zip: loc.postalCode || null,
      }
    }
  } catch (err) {
    console.warn('[Dashboard] Reverse geocode error:', err)
  }
  return null
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

// Stat Card Component
function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  loading = false,
}: {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  loading?: boolean
}) {
  const changeColor =
    changeType === 'positive'
      ? colors.success[500]
      : changeType === 'negative'
      ? colors.error[500]
      : colors.slate[500]

  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.brand[500]} style={{ marginVertical: 8 }} />
      ) : (
        <>
          <Text style={styles.statValue}>{value}</Text>
          {change && <Text style={[styles.statChange, { color: changeColor }]}>{change}</Text>}
        </>
      )}
    </View>
  )
}

// Recent Deal Card
function RecentDealCard({ deal }: { deal: DealWithProperty }) {
  const stageConfig = DEAL_STAGE_CONFIG[deal.stage as DealStage] || { label: deal.stage, color: '#94a3b8' }
  const address = deal.property?.address_line1 || deal.deal_name || 'Unnamed Deal'
  const city = deal.property?.city || ''
  const price = deal.contract_price || deal.offer_price || deal.asking_price || 0

  return (
    <Link href={`/property/${deal.id}`} asChild>
      <Card style={styles.dealCard} padding="md">
        <Text style={styles.dealAddress} numberOfLines={1}>
          {address}
        </Text>
        <View style={styles.dealMeta}>
          <View style={[styles.stageBadge, { backgroundColor: `${stageConfig.color}20` }]}>
            <Text style={[styles.stageBadgeText, { color: stageConfig.color }]}>{stageConfig.label}</Text>
          </View>
          {city && <Text style={styles.dealCity}>{city}</Text>}
        </View>
        {price > 0 && (
          <Text style={styles.dealPrice}>{formatCurrency(price)}</Text>
        )}
      </Card>
    </Link>
  )
}

// Hot Lead Card (captured in last 24h, not yet analyzed)
function HotLeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const displayAddress = lead.address || `📍 ${lead.lat.toFixed(4)}, ${lead.lng.toFixed(4)}`
  const timeAgo = getTimeAgo(lead.created_at)
  const priorityColors: Record<string, string> = {
    hot: colors.error[500],
    high: colors.warning[500],
    normal: colors.slate[500],
  }

  return (
    <TouchableOpacity style={styles.hotLeadCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.hotLeadHeader}>
        <Text style={styles.hotLeadAddress} numberOfLines={1}>{displayAddress}</Text>
        {lead.priority === 'hot' && <Text style={styles.hotLeadHot}>🔥</Text>}
      </View>
      <View style={styles.hotLeadMeta}>
        <Text style={styles.hotLeadTime}>{timeAgo}</Text>
        {lead.tags && lead.tags.length > 0 && (
          <View style={styles.hotLeadTags}>
            {lead.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.miniTag}>
                <Text style={styles.miniTagText}>{tag.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// Get time ago string
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// Today Appointment Card
function AppointmentCard({
  event,
  onPress,
}: {
  event: CalendarEvent
  onPress: () => void
}) {
  const icon = calendarService.getEventTypeIcon(event.event_type)
  const color = calendarService.getEventTypeColor(event.event_type)
  const timeStr = calendarService.formatEventTime(event.start_time, event.end_time, event.all_day)

  return (
    <TouchableOpacity style={styles.appointmentCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.appointmentIcon, { backgroundColor: `${color}20` }]}>
        <Text style={styles.appointmentIconText}>{icon}</Text>
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.appointmentTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.appointmentTime}>{timeStr}</Text>
        {event.location && (
          <Text style={styles.appointmentLocation} numberOfLines={1}>
            📍 {event.location}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// Empty State
function EmptyState() {
  return (
    <Card style={styles.emptyState} padding="lg">
      <Text style={styles.emptyStateTitle}>No deals yet</Text>
      <Text style={styles.emptyStateText}>
        Create your first deal to start tracking your real estate pipeline.
      </Text>
      <Link href="/property/new" asChild>
        <Button variant="primary" style={{ marginTop: spacing.md }}>
          + Create Deal
        </Button>
      </Link>
    </Card>
  )
}

export default function DashboardScreen() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const router = useRouter()
  const { canTriage, canEvaluate } = useFeatureGate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentDeals, setRecentDeals] = useState<DealWithProperty[]>([])
  const [hotLeads, setHotLeads] = useState<Lead[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [todayAppointments, setTodayAppointments] = useState<CalendarEvent[]>([])
  const [dailyFocus, setDailyFocus] = useState<DailyFocus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)

      // Fetch all data in parallel
      const [statsResult, dealsResult, leadsResult, overdueResult, appointmentsResult, dailyFocusResult] = await Promise.all([
        getDashboardStats(),
        getRecentDeals(5),
        getLeads({ limit: 10 }), // Recent unconverted leads
        getOverdueFollowups(),
        calendarService.getTodayEvents(),
        getDailyFocus(),
      ])

      if (statsResult.error) {
        console.warn('Stats error:', statsResult.error)
      } else {
        setStats(statsResult.data)
      }

      if (dealsResult.error) {
        console.warn('Deals error:', dealsResult.error)
      } else {
        setRecentDeals(dealsResult.data)
      }

      if (leadsResult.error) {
        console.warn('Leads error:', leadsResult.error)
      } else {
        // Filter to last 24 hours for "hot" leads
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentLeads = leadsResult.data.filter((l: Lead) => l.created_at >= last24h)
        setHotLeads(recentLeads.slice(0, 5))

        // Auto-geocode leads that have coordinates but no address
        const leadsNeedingGeocode = leadsResult.data.filter(
          (lead: Lead) => !lead.address && lead.lat && lead.lng
        )
        if (leadsNeedingGeocode.length > 0) {
          autoGeocodeLeads(leadsNeedingGeocode)
        }
      }

      if (overdueResult.error) {
        console.warn('Overdue error:', overdueResult.error)
      } else {
        setOverdueCount(overdueResult.data?.length || 0)
      }

      if (appointmentsResult.error) {
        console.warn('Appointments error:', appointmentsResult.error)
      } else {
        setTodayAppointments(appointmentsResult.data || [])
      }

      if (dailyFocusResult.error) {
        console.warn('Daily focus error:', dailyFocusResult.error)
      } else {
        setDailyFocus(dailyFocusResult.data)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auto-geocode leads with coordinates but no address
  const autoGeocodeLeads = async (leadsToGeocode: Lead[]) => {
    let updatedCount = 0

    for (const lead of leadsToGeocode) {
      if (!lead.lat || !lead.lng) continue

      try {
        const geocoded = await reverseGeocode(lead.lat, lead.lng)
        if (geocoded && geocoded.address) {
          const { error: updateError } = await supabase
            .from('dealroom_leads')
            .update({
              address_line1: geocoded.address,
              city: geocoded.city,
              state: geocoded.state,
              zip: geocoded.zip,
            })
            .eq('id', lead.id)

          if (!updateError) {
            updatedCount++
            console.log(`[Dashboard] Geocoded: ${geocoded.address}, ${geocoded.city}`)
          }
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (err) {
        console.warn(`[Dashboard] Failed to geocode lead ${lead.id}:`, err)
      }
    }

    // Refresh hot leads if any were updated
    if (updatedCount > 0) {
      const { data } = await getLeads({ limit: 10 })
      if (data) {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentLeads = data.filter((l: Lead) => l.created_at >= last24h)
        setHotLeads(recentLeads.slice(0, 5))
      }
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData()
  }, [fetchData])

  const userName = settings.displayName || user?.email?.split('@')[0] || 'Investor'

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[500]}
          />
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {/* Header with personalized greeting */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/profile')}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarText}>
                {userName[0]?.toUpperCase() || '?'}
              </Text>
            </TouchableOpacity>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{getTimeBasedGreeting()}, {userName}!</Text>
              {dailyFocus?.greeting_context && (
                <Text style={styles.greetingContext} numberOfLines={2}>
                  {dailyFocus.greeting_context}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/profile')}
              activeOpacity={0.7}
            >
              <Text style={styles.headerIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button size="sm" variant="outline" onPress={onRefresh}>
              Retry
            </Button>
          </View>
        )}

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Pipeline Overview</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatCard
            label="Active Deals"
            value={stats?.activeDeals?.toString() || '0'}
            loading={loading}
          />
          <StatCard
            label="Pipeline Value"
            value={stats ? formatCurrency(stats.pipelineValue) : '$0'}
            loading={loading}
          />
          <StatCard
            label="Closed YTD"
            value={stats?.closedYTD?.toString() || '0'}
            loading={loading}
          />
          <StatCard
            label="Avg. Days to Close"
            value={stats?.avgDaysToClose?.toString() || '-'}
            loading={loading}
          />
        </ScrollView>

        {/* Primary Actions - Big buttons */}
        <View style={styles.primaryActions}>
          <Link href="/driving" asChild>
            <TouchableOpacity style={styles.primaryActionCard} activeOpacity={0.7}>
              <Text style={styles.primaryActionIcon}>🚗</Text>
              <Text style={styles.primaryActionLabel}>Start Driving</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/property/new" asChild>
            <TouchableOpacity style={styles.primaryActionCard} activeOpacity={0.7}>
              <Text style={styles.primaryActionIcon}>📝</Text>
              <Text style={styles.primaryActionLabel}>New Deal</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/search" asChild>
            <TouchableOpacity style={styles.primaryActionCard} activeOpacity={0.7}>
              <Text style={styles.primaryActionIcon}>🔍</Text>
              <Text style={styles.primaryActionLabel}>Search</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Workflow Actions - Triage + Analyze */}
        <View style={styles.workflowActions}>
          <TouchableOpacity
            style={[styles.workflowCard, !canTriage && styles.workflowCardLocked]}
            activeOpacity={0.7}
            onPress={() => {
              if (canTriage) {
                router.push('/triage')
              } else {
                Alert.alert(
                  'Feature Not Available',
                  'Swipe Triage is not included in your current plan. Contact support for assistance.'
                )
              }
            }}
          >
            <View style={[styles.workflowIcon, { backgroundColor: '#EF444420' }]}>
              <Text style={styles.workflowIconText}>👆</Text>
            </View>
            <View style={styles.workflowInfo}>
              <Text style={styles.workflowTitle}>Swipe Triage</Text>
              <Text style={styles.workflowSubtext}>Tinder for properties</Text>
            </View>
            {canTriage ? (
              <Text style={styles.workflowArrow}>→</Text>
            ) : (
              <View style={styles.lockBadge}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.workflowCard, !canEvaluate && styles.workflowCardLocked]}
            activeOpacity={0.7}
            onPress={() => {
              if (canEvaluate) {
                router.push('/analyze')
              } else {
                Alert.alert(
                  'Feature Not Available',
                  'Analyze Queue is not included in your current plan. Contact support for assistance.'
                )
              }
            }}
          >
            <View style={[styles.workflowIcon, { backgroundColor: '#3B82F620' }]}>
              <Text style={styles.workflowIconText}>📊</Text>
            </View>
            <View style={styles.workflowInfo}>
              <Text style={styles.workflowTitle}>Analyze Queue</Text>
              <Text style={styles.workflowSubtext}>Run quick underwriting</Text>
            </View>
            {canEvaluate ? (
              <Text style={styles.workflowArrow}>→</Text>
            ) : (
              <View style={styles.lockBadge}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Week Calendar Strip */}
        <WeekCalendarStrip />

        {/* Pipeline Health & Goals Row */}
        <View style={styles.widgetsRow}>
          <View style={styles.widgetHalf}>
            <PipelineHealthGauge compact />
          </View>
        </View>

        {/* Goal Tracking Widget */}
        <GoalTrackingWidget
          onAddGoal={() => {
            // TODO: Navigate to goal creation modal
            Alert.alert('Coming Soon', 'Goal creation will be available in the next update.')
          }}
        />

        {/* Quick Win Suggestions */}
        <QuickWinCard limit={3} />

        {/* Overdue Alert */}
        {overdueCount > 0 && (
          <TouchableOpacity
            style={styles.overdueAlert}
            onPress={() => router.push('/tasks')}
            activeOpacity={0.7}
          >
            <View style={styles.overdueIcon}>
              <Text style={styles.overdueIconText}>⚠️</Text>
            </View>
            <View style={styles.overdueInfo}>
              <Text style={styles.overdueTitle}>{overdueCount} overdue follow-up{overdueCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.overdueSubtext}>Tap to view and complete</Text>
            </View>
            <Text style={styles.overdueArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Today's Appointments */}
        {todayAppointments.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Today's Schedule</Text>
              <TouchableOpacity onPress={() => router.push('/calendar')}>
                <Text style={styles.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.appointmentsList}>
              {todayAppointments.slice(0, 3).map((event) => (
                <AppointmentCard
                  key={event.id}
                  event={event}
                  onPress={() => {
                    // Navigate based on linked entity
                    if (event.deal_id) {
                      router.push(`/property/${event.deal_id}`)
                    } else if (event.lead_id) {
                      router.push(`/lead/${event.lead_id}`)
                    } else if (event.contact_id) {
                      router.push(`/contact/${event.contact_id}`)
                    } else {
                      router.push('/calendar')
                    }
                  }}
                />
              ))}
              {todayAppointments.length > 3 && (
                <TouchableOpacity
                  style={styles.moreAppointments}
                  onPress={() => router.push('/calendar')}
                >
                  <Text style={styles.moreAppointmentsText}>
                    +{todayAppointments.length - 3} more appointment{todayAppointments.length - 3 !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Hot Leads (last 24h) */}
        {hotLeads.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Hot Leads</Text>
              <Link href="/leads" asChild>
                <Text style={styles.seeAll}>See All →</Text>
              </Link>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hotLeadsRow}
            >
              {hotLeads.map((lead) => (
                <HotLeadCard
                  key={lead.id}
                  lead={lead}
                  onPress={() => router.push(`/lead/${lead.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Recent Deals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Deals</Text>
          <Link href="/pipeline" asChild>
            <Text style={styles.seeAll}>See All →</Text>
          </Link>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Loading deals...</Text>
          </View>
        ) : recentDeals.length === 0 ? (
          <EmptyState />
        ) : (
          recentDeals.map((deal) => <RecentDealCard key={deal.id} deal={deal} />)
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  greetingContext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  userName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    minWidth: 140,
    ...shadows.soft,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  statChange: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  primaryActionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.soft,
  },
  primaryActionBrand: {
    backgroundColor: colors.brand[500],
  },
  primaryActionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  primaryActionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  primaryActionLabelLight: {
    color: colors.white,
  },
  workflowActions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  widgetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  widgetHalf: {
    flex: 1,
  },
  workflowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  workflowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  workflowIconText: {
    fontSize: 20,
  },
  workflowInfo: {
    flex: 1,
  },
  workflowTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  workflowSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  workflowArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.slate[400],
  },
  workflowCardLocked: {
    opacity: 0.7,
    backgroundColor: colors.slate[50],
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 14,
  },
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  overdueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  overdueIconText: {
    fontSize: 18,
  },
  overdueInfo: {
    flex: 1,
  },
  overdueTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  overdueSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: 2,
  },
  overdueArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.error[400],
  },
  hotLeadsRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  hotLeadCard: {
    width: 180,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  hotLeadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  hotLeadAddress: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  hotLeadHot: {
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  hotLeadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hotLeadTime: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  hotLeadTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  miniTag: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  miniTagText: {
    fontSize: 10,
    color: colors.slate[600],
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
  },
  dealCard: {
    marginBottom: spacing.sm,
  },
  dealAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  dealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stageBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.full,
  },
  stageBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  dealCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  dealPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.semibold,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  // Appointments
  appointmentsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  appointmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  appointmentIconText: {
    fontSize: 20,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  appointmentLocation: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  moreAppointments: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moreAppointmentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
})
