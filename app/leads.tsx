/**
 * Leads Inbox Screen
 *
 * View and manage captured leads from driving sessions.
 * Swipe actions: Analyze, Convert to Deal, Archive
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Stack, useRouter, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, Button } from '../src/components'
import { colors, spacing, typography, radii, shadows } from '../src/theme'
import { getLeads, updateLead, createDeal } from '../src/services'
import type { Lead, DealStage } from '../src/types'

// Filter options
const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: '🔥 Hot' },
  { key: 'to_analyze', label: 'To Analyze' },
  { key: 'active', label: 'Active' },
]

// Format time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Lead Card Component
function LeadCard({
  lead,
  onConvert,
  onArchive,
  converting,
}: {
  lead: Lead
  onConvert: () => void
  onArchive: () => void
  converting: boolean
}) {
  const router = useRouter()
  const displayAddress = lead.address || `📍 ${lead.lat.toFixed(4)}, ${lead.lng.toFixed(4)}`
  const timeAgo = getTimeAgo(lead.created_at)
  const priorityColors: Record<string, string> = {
    hot: colors.error[500],
    high: colors.warning[500],
    normal: colors.slate[500],
    low: colors.slate[300],
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/lead/${lead.id}`)}
    >
      <Card style={styles.leadCard} padding="md">
        {/* Header */}
        <View style={styles.leadHeader}>
          <View style={styles.leadInfo}>
            <Text style={styles.leadAddress} numberOfLines={1}>
              {displayAddress}
            </Text>
            <Text style={styles.leadTime}>{timeAgo}</Text>
          </View>
          {lead.priority && lead.priority !== 'normal' && (
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: `${priorityColors[lead.priority] || colors.slate[500]}20` },
              ]}
            >
              <Text
                style={[
                  styles.priorityBadgeText,
                  { color: priorityColors[lead.priority] || colors.slate[500] },
                ]}
              >
                {lead.priority === 'hot' ? '🔥 ' : ''}
                {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {lead.tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag.replace(/_/g, ' ')}</Text>
              </View>
            ))}
            {lead.tags.length > 4 && (
              <Text style={styles.moreTagsText}>+{lead.tags.length - 4}</Text>
            )}
          </View>
        )}

        {/* Notes */}
        {lead.notes && (
          <Text style={styles.leadNotes} numberOfLines={2}>
            {lead.notes}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Button
            variant="primary"
            size="sm"
            onPress={onConvert}
            disabled={converting}
            style={styles.actionButton}
          >
            {converting ? 'Converting...' : '→ Convert to Deal'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={onArchive}
            style={styles.archiveButton}
          >
            🗑️
          </Button>
        </View>
      </Card>
    </TouchableOpacity>
  )
}

export default function LeadsInboxScreen() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    try {
      const { data, error } = await getLeads({ limit: 100 })
      if (error) {
        console.error('Error fetching leads:', error)
      } else if (data) {
        setLeads(data)
      }
    } catch (err) {
      console.error('Failed to load leads:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchLeads()
  }, [fetchLeads])

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (filter === 'all') return true
    if (filter === 'hot') return lead.priority === 'hot'
    if (filter === 'to_analyze') return lead.tags?.includes('to_analyze')
    if (filter === 'active') return lead.status === 'active'
    return true
  })

  // Convert lead to deal
  const handleConvert = useCallback(
    async (lead: Lead) => {
      setConvertingId(lead.id)
      try {
        const dealName = lead.address || `Lead ${lead.lat.toFixed(4)}, ${lead.lng.toFixed(4)}`

        const { data: deal, error } = await createDeal({
          name: dealName,
          stage: 'lead' as DealStage,
          source: 'driving',
          address_line1: lead.address || undefined,
          lat: lead.lat,
          lng: lead.lng,
          notes: lead.notes || undefined,
          tags: lead.tags,
          lead_id: lead.id,
        })

        if (error) {
          Alert.alert('Error', error.message)
          return
        }

        if (deal) {
          // Remove from list
          setLeads((prev) => prev.filter((l) => l.id !== lead.id))
          Alert.alert('Success!', 'Lead converted to deal', [
            { text: 'View Deal', onPress: () => router.push(`/property/${deal.id}`) },
            { text: 'Continue', style: 'cancel' },
          ])
        }
      } catch (err) {
        console.error('Convert error:', err)
        Alert.alert('Error', 'Failed to convert lead')
      } finally {
        setConvertingId(null)
      }
    },
    [router]
  )

  // Archive lead
  const handleArchive = useCallback(async (lead: Lead) => {
    Alert.alert('Archive Lead?', 'This lead will be moved to your archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateLead(lead.id, { status: 'archived' })
            setLeads((prev) => prev.filter((l) => l.id !== lead.id))
          } catch (err) {
            console.error('Archive error:', err)
            Alert.alert('Error', 'Failed to archive lead')
          }
        },
      },
    ])
  }, [])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Leads Inbox',
          headerShown: true,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterChip, filter === opt.key && styles.filterChipActive]}
                onPress={() => setFilter(opt.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === opt.key && styles.filterChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brand[500]} />
              <Text style={styles.loadingText}>Loading leads...</Text>
            </View>
          ) : filteredLeads.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📍</Text>
              <Text style={styles.emptyStateTitle}>
                {filter === 'all' ? 'No Leads Yet' : 'No Matching Leads'}
              </Text>
              <Text style={styles.emptyStateText}>
                {filter === 'all'
                  ? 'Start a driving session to capture leads while exploring neighborhoods.'
                  : 'Try adjusting your filters or capture more leads.'}
              </Text>
              {filter === 'all' && (
                <Link href="/driving" asChild>
                  <Button variant="primary" style={{ marginTop: spacing.md }}>
                    🚗 Start Driving
                  </Button>
                </Link>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
              </Text>
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onConvert={() => handleConvert(lead)}
                  onArchive={() => handleArchive(lead)}
                  converting={convertingId === lead.id}
                />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  filtersContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.slate[100],
    borderRadius: radii.full,
  },
  filterChipActive: {
    backgroundColor: colors.brand[500],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  filterChipTextActive: {
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  resultCount: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
  },
  leadCard: {
    marginBottom: spacing.md,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  leadInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  leadAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  leadTime: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  priorityBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagChip: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  tagChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  moreTagsText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    alignSelf: 'center',
  },
  leadNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  archiveButton: {
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
})
