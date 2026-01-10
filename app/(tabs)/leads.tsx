/**
 * Leads Tab Screen
 *
 * Shows all captured leads from driving sessions.
 * Features:
 * - Lead scoring visualization
 * - Batch selection mode
 * - Smart sorting by conversion likelihood
 * - Lead source indicators
 * - Photo thumbnails
 * - Quick call/text buttons
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { ScreenContainer, Card, Button, LeadScoreBar } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { getLeads, intelligenceService, getMotivationColor } from '../../src/services'
import { openDialer, openSMS, getLeadSourceIcon, getLeadSourceLabel } from '../../src/utils/communications'
import type { MotivationLevel } from '../../src/types/intelligence'
import { supabase } from '../../src/lib/supabase'
import type { Lead } from '../../src/types/contracts'

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

type FilterType = 'all' | 'new' | 'pending' | 'queued' | 'converted'
type SortType = 'recent' | 'conversion' | 'priority' | 'alphabetical'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Pending' },
  { key: 'queued', label: 'Queued' },
  { key: 'converted', label: 'Converted' },
]

const SORT_OPTIONS: { key: SortType; label: string; icon: string }[] = [
  { key: 'conversion', label: 'Likely to Convert', icon: '🎯' },
  { key: 'recent', label: 'Most Recent', icon: '🕐' },
  { key: 'priority', label: 'Priority', icon: '🔥' },
  { key: 'alphabetical', label: 'A-Z', icon: '🔤' },
]

const PRIORITY_COLORS: Record<string, string> = {
  hot: colors.error[500],
  high: colors.warning[500],
  normal: colors.slate[400],
  low: colors.slate[300],
}

const PRIORITY_ORDER: Record<string, number> = {
  hot: 0,
  high: 1,
  normal: 2,
  low: 3,
}

// Motivation score map type
type MotivationMap = Record<string, { level: MotivationLevel; score: number }>

export default function LeadsScreen() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('conversion')
  const [showSortPicker, setShowSortPicker] = useState(false)
  const [motivationScores, setMotivationScores] = useState<MotivationMap>({})

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchLeads = useCallback(async () => {
    try {
      const { data, error } = await getLeads({ limit: 100 })
      if (error) {
        console.error('Error fetching leads:', error)
      } else {
        setLeads(data || [])

        // Fetch motivation scores for leads
        if (data && data.length > 0) {
          const leadIds = data.map((l: Lead) => l.id)
          const { data: scores } = await intelligenceService.getMotivationScoresForLeads(leadIds)
          if (scores && scores.size > 0) {
            const scoreMap: MotivationMap = {}
            scores.forEach((s, leadId) => {
              scoreMap[leadId] = {
                level: s.motivation_level || 'low',
                score: s.motivation_score || 0,
              }
            })
            setMotivationScores(scoreMap)
          }

          // Auto-geocode leads that have coordinates but no address
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

  // Calculate conversion score for sorting
  const getConversionScore = (lead: Lead): number => {
    const motivation = motivationScores[lead.id]
    const motivationScore = motivation?.score || 0
    const priorityBonus = { hot: 30, high: 20, normal: 10, low: 0 }[lead.priority] || 0
    const daysSinceCapture = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)
    const recencyBonus = daysSinceCapture <= 1 ? 15 : daysSinceCapture <= 3 ? 10 : daysSinceCapture <= 7 ? 5 : 0
    return motivationScore + priorityBonus + recencyBonus
  }

  // Filter and sort leads
  const processedLeads = useMemo(() => {
    // First filter
    let result = leads.filter((lead) => {
      if (filter === 'all') return true
      if (filter === 'new') return lead.triage_status === 'new' || !lead.triage_status
      if (filter === 'pending') return lead.triage_status === 'new' || !lead.triage_status
      if (filter === 'queued') return lead.triage_status === 'queued'
      if (filter === 'converted') return lead.status === 'converted'
      return true
    })

    // Then sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'conversion':
          return getConversionScore(b) - getConversionScore(a)
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'priority':
          return (PRIORITY_ORDER[a.priority] || 3) - (PRIORITY_ORDER[b.priority] || 3)
        case 'alphabetical':
          const addrA = a.address_line1 || ''
          const addrB = b.address_line1 || ''
          return addrA.localeCompare(addrB)
        default:
          return 0
      }
    })

    return result
  }, [leads, filter, sortBy, motivationScores])

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

  // Selection handlers
  const handleLongPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectionMode(true)
    setSelectedIds(new Set([id]))
  }

  const toggleSelection = (id: string) => {
    Haptics.selectionAsync()
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)

    // Exit selection mode if nothing selected
    if (newSet.size === 0) {
      setSelectionMode(false)
    }
  }

  const selectAll = () => {
    const allIds = new Set(processedLeads.map(l => l.id))
    setSelectedIds(allIds)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  // Batch actions
  const handleBatchDismiss = async () => {
    Alert.alert(
      'Dismiss Selected',
      `Are you sure you want to dismiss ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = Array.from(selectedIds)
              await supabase
                .from('dealroom_leads')
                .update({ triage_status: 'dismissed', updated_at: new Date().toISOString() })
                .in('id', ids)

              clearSelection()
              fetchLeads()
            } catch (err) {
              console.error('Batch dismiss error:', err)
              Alert.alert('Error', 'Failed to dismiss leads')
            }
          },
        },
      ]
    )
  }

  const handleBatchQueue = async () => {
    try {
      const ids = Array.from(selectedIds)
      await supabase
        .from('dealroom_leads')
        .update({ triage_status: 'queued', updated_at: new Date().toISOString() })
        .in('id', ids)

      clearSelection()
      fetchLeads()
      Alert.alert('Success', `${ids.length} lead${ids.length !== 1 ? 's' : ''} added to analyze queue`)
    } catch (err) {
      console.error('Batch queue error:', err)
      Alert.alert('Error', 'Failed to queue leads')
    }
  }

  // Quick communication handlers
  const handleCall = (phoneNumber: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openDialer(phoneNumber)
  }

  const handleText = (phoneNumber: string, address?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const message = address
      ? `Hi, I'm interested in purchasing your property at ${address}. Would you be open to discussing a sale?`
      : undefined
    openSMS(phoneNumber, message)
  }

  const renderLeadItem = ({ item }: { item: Lead }) => {
    const status = getStatusBadge(item)
    const address = item.address_line1 || `${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`
    const location = [item.city, item.state].filter(Boolean).join(', ')
    const motivation = motivationScores[item.id]
    const sourceIcon = getLeadSourceIcon(item.source)
    const sourceLabel = getLeadSourceLabel(item.source)
    const isSelected = selectedIds.has(item.id)
    const daysSinceCapture = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000)

    // Check if lead has skip trace data with phone
    const hasPhone = item.skip_trace_data?.phones?.length > 0
    const primaryPhone = hasPhone ? item.skip_trace_data.phones[0]?.number : null

    // Check for photos
    const hasPhotos = item.photos && item.photos.length > 0

    const handlePress = () => {
      if (selectionMode) {
        toggleSelection(item.id)
      } else {
        router.push(`/lead/${item.id}`)
      }
    }

    return (
      <TouchableOpacity
        style={[styles.leadCard, isSelected && styles.leadCardSelected]}
        onPress={handlePress}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}

        <View style={styles.leadContent}>
          {/* Header row */}
          <View style={styles.leadHeader}>
            <View style={styles.leadInfo}>
              <View style={styles.addressRow}>
                {/* Source icon */}
                <Text style={styles.sourceIcon}>{sourceIcon}</Text>
                <Text style={styles.leadAddress} numberOfLines={1}>
                  {address}
                </Text>
              </View>
              {location ? (
                <Text style={styles.leadLocation}>{location}</Text>
              ) : null}
            </View>
            <View style={styles.badgesContainer}>
              {motivation && (motivation.level === 'high' || motivation.level === 'very_high') && (
                <View style={[styles.motivationBadge, { backgroundColor: getMotivationColor(motivation.level) + '20' }]}>
                  <Text style={[styles.motivationText, { color: getMotivationColor(motivation.level) }]}>
                    {motivation.level === 'very_high' ? '🔥' : '📈'} {motivation.score}
                  </Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
          </View>

          {/* Photo thumbnails */}
          {hasPhotos && (
            <View style={styles.photoRow}>
              {item.photos.slice(0, 3).map((photo: string, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: photo }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              ))}
              {item.photos.length > 3 && (
                <View style={styles.morePhotos}>
                  <Text style={styles.morePhotosText}>+{item.photos.length - 3}</Text>
                </View>
              )}
            </View>
          )}

          {/* Lead score bar */}
          <LeadScoreBar
            motivationScore={motivation?.score || 0}
            priority={item.priority as any}
            daysSinceCapture={daysSinceCapture}
          />

          {/* Meta row */}
          <View style={styles.leadMeta}>
            <View style={styles.metaRow}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] || colors.slate[400] }]} />
              <Text style={styles.metaText}>{item.priority}</Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>{sourceLabel}</Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
            </View>
            {item.capture_notes && (
              <Text style={styles.notes} numberOfLines={1}>
                📝 {item.capture_notes}
              </Text>
            )}
          </View>

          {/* Quick action buttons */}
          {primaryPhone && !selectionMode && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => handleCall(primaryPhone)}
              >
                <Text style={styles.quickActionIcon}>📞</Text>
                <Text style={styles.quickActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => handleText(primaryPhone, address)}
              >
                <Text style={styles.quickActionIcon}>💬</Text>
                <Text style={styles.quickActionText}>Text</Text>
              </TouchableOpacity>
            </View>
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Leads</Text>
            <Text style={styles.subtitle}>{leads.length} total leads</Text>
          </View>
          {/* Sort picker button */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortPicker(!showSortPicker)}
          >
            <Text style={styles.sortButtonIcon}>
              {SORT_OPTIONS.find(s => s.key === sortBy)?.icon}
            </Text>
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
            </Text>
            <Text style={styles.sortChevron}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Sort picker dropdown */}
        {showSortPicker && (
          <View style={styles.sortPicker}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortBy === option.key && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortBy(option.key)
                  setShowSortPicker(false)
                }}
              >
                <Text style={styles.sortOptionIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === option.key && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.key && (
                  <Text style={styles.sortOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
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

      {/* Quick actions (hidden in selection mode) */}
      {!selectionMode && (
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
      )}

      {/* Batch selection bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
            <TouchableOpacity onPress={selectAll}>
              <Text style={styles.selectAllBtn}>Select All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.batchBtn} onPress={handleBatchQueue}>
              <Text style={styles.batchBtnIcon}>📊</Text>
              <Text style={styles.batchBtnText}>Queue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.batchBtn, styles.batchBtnDanger]} onPress={handleBatchDismiss}>
              <Text style={styles.batchBtnIcon}>🗑️</Text>
              <Text style={styles.batchBtnText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={clearSelection}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Leads list */}
      <FlatList
        data={processedLeads}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  sortButtonIcon: {
    fontSize: 14,
  },
  sortButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
    fontWeight: typography.fontWeight.medium,
  },
  sortChevron: {
    fontSize: 10,
    color: colors.slate[500],
  },
  sortPicker: {
    position: 'absolute',
    top: 70,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xs,
    ...shadows.medium,
    zIndex: 100,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  sortOptionActive: {
    backgroundColor: colors.brand[50],
  },
  sortOptionIcon: {
    fontSize: 16,
  },
  sortOptionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
  },
  sortOptionTextActive: {
    color: colors.brand[600],
    fontWeight: typography.fontWeight.semibold,
  },
  sortOptionCheck: {
    color: colors.brand[500],
    fontWeight: typography.fontWeight.bold,
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
  // Selection bar
  selectionBar: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectionCount: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  selectAllBtn: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
    textDecorationLine: 'underline',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  batchBtnDanger: {
    backgroundColor: colors.error[50],
  },
  batchBtnIcon: {
    fontSize: 14,
  },
  batchBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  leadCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  leadCardSelected: {
    backgroundColor: colors.brand[50],
    borderWidth: 2,
    borderColor: colors.brand[500],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.slate[300],
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  checkmark: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: 14,
  },
  leadContent: {
    flex: 1,
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sourceIcon: {
    fontSize: 14,
  },
  leadAddress: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  leadLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
    marginLeft: 22, // Align with address (after icon)
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  motivationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  motivationText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  photoThumb: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
  },
  morePhotos: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePhotosText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
  },
  leadMeta: {
    gap: spacing.xs,
    marginTop: spacing.sm,
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
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  quickActionIcon: {
    fontSize: 14,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[600],
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
