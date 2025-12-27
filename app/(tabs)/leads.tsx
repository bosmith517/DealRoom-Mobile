/**
 * Leads Tab Screen
 *
 * Shows all captured leads from driving sessions.
 * Allows filtering, sorting, and quick actions.
 * Auto-geocodes leads with only coordinates.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { getLeads } from '../../src/services'
import { supabase } from '../../src/lib/supabase'

// Reverse geocode coordinates to address using expo-location
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
    console.warn('[Leads] Reverse geocode error:', err)
  }
  return null
}

interface Lead {
  id: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  status: string
  priority: string
  triage_status: string | null
  source: string
  created_at: string
  capture_notes: string | null
  lead_score: number | null
}

type FilterType = 'all' | 'new' | 'pending' | 'queued' | 'converted'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Pending' },
  { key: 'queued', label: 'Queued' },
  { key: 'converted', label: 'Converted' },
]

const PRIORITY_COLORS: Record<string, string> = {
  hot: colors.error[500],
  high: colors.warning[500],
  normal: colors.slate[400],
  low: colors.slate[300],
}

export default function LeadsScreen() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')

  const fetchLeads = useCallback(async () => {
    try {
      const { data, error } = await getLeads({ limit: 100 })
      if (error) {
        console.error('Error fetching leads:', error)
      } else {
        setLeads(data || [])

        // Auto-geocode leads that have coordinates but no address
        if (data && data.length > 0) {
          const leadsNeedingGeocode = data.filter(
            (lead: Lead) => !lead.address_line1 && lead.lat && lead.lng
          )

          if (leadsNeedingGeocode.length > 0) {
            console.log(`[Leads] Auto-geocoding ${leadsNeedingGeocode.length} leads...`)
            autoGeocodeLeads(leadsNeedingGeocode)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err)
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
            console.log(`[Leads] Geocoded: ${geocoded.address}, ${geocoded.city}, ${geocoded.state}`)
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (err) {
        console.warn(`[Leads] Failed to geocode lead ${lead.id}:`, err)
      }
    }

    // Refresh if any were updated
    if (updatedCount > 0) {
      console.log(`[Leads] Geocoded ${updatedCount} leads, refreshing...`)
      const { data } = await getLeads({ limit: 100 })
      if (data) setLeads(data)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchLeads()
  }, [fetchLeads])

  // Filter leads based on selected filter
  const filteredLeads = leads.filter((lead) => {
    if (filter === 'all') return true
    if (filter === 'new') return lead.status === 'new'
    if (filter === 'pending') return lead.triage_status === 'pending' || !lead.triage_status
    if (filter === 'queued') return lead.triage_status === 'queued'
    if (filter === 'converted') return lead.status === 'converted'
    return true
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getStatusBadge = (lead: Lead) => {
    if (lead.status === 'converted') {
      return { label: 'Converted', color: colors.success[500], bg: colors.success[50] }
    }
    if (lead.triage_status === 'queued') {
      return { label: 'In Queue', color: colors.brand[500], bg: colors.brand[50] }
    }
    if (lead.triage_status === 'dismissed') {
      return { label: 'Dismissed', color: colors.slate[500], bg: colors.slate[100] }
    }
    if (lead.triage_status === 'watch') {
      return { label: 'Watching', color: colors.warning[500], bg: colors.warning[50] }
    }
    return { label: 'New', color: colors.info[500], bg: colors.info[50] }
  }

  const renderLeadItem = ({ item }: { item: Lead }) => {
    const status = getStatusBadge(item)
    const address = item.address_line1 || `${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`
    const location = [item.city, item.state].filter(Boolean).join(', ')

    return (
      <TouchableOpacity
        style={styles.leadCard}
        onPress={() => router.push(`/lead/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.leadHeader}>
          <View style={styles.leadInfo}>
            <Text style={styles.leadAddress} numberOfLines={1}>
              {address}
            </Text>
            {location ? (
              <Text style={styles.leadLocation}>{location}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.leadMeta}>
          <View style={styles.metaRow}>
            <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] || colors.slate[400] }]} />
            <Text style={styles.metaText}>{item.priority}</Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>{item.source}</Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
          {item.capture_notes && (
            <Text style={styles.notes} numberOfLines={1}>
              📝 {item.capture_notes}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📍</Text>
      <Text style={styles.emptyTitle}>No Leads Yet</Text>
      <Text style={styles.emptyText}>
        Start a driving session to capture property leads while you explore neighborhoods.
      </Text>
      <Button
        variant="primary"
        onPress={() => router.push('/driving')}
        style={styles.emptyButton}
      >
        Start Driving
      </Button>
    </View>
  )

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Leads</Text>
        <Text style={styles.subtitle}>{leads.length} total leads</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/triage')}
        >
          <Text style={styles.actionIcon}>👆</Text>
          <Text style={styles.actionText}>Triage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/analyze')}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Analyze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/driving')}
        >
          <Text style={styles.actionIcon}>🚗</Text>
          <Text style={styles.actionText}>Drive</Text>
        </TouchableOpacity>
      </View>

      {/* Leads list */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        renderItem={renderLeadItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
  },
  filterChipActive: {
    backgroundColor: colors.brand[500],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  actionIcon: {
    fontSize: 16,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
    fontWeight: typography.fontWeight.medium,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  leadCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  leadLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  leadMeta: {
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  metaDivider: {
    marginHorizontal: spacing.xs,
    color: colors.slate[300],
  },
  notes: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 160,
  },
})
