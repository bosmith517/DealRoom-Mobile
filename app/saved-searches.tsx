/**
 * Saved Searches Screen
 *
 * View, run, and manage saved searches.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { ScreenContainer, Card, Button } from '../src/components'
import { colors, spacing, typography, radii } from '../src/theme'
import {
  getSavedSearches,
  deleteSavedSearch,
  runSavedSearch,
  type SavedSearch,
} from '../src/services'

// Format date for display
function formatDate(dateString?: string): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Search Card Component
function SearchCard({
  search,
  onRun,
  onDelete,
  isRunning,
}: {
  search: SavedSearch
  onRun: () => void
  onDelete: () => void
  isRunning: boolean
}) {
  const filterSummary = []
  if (search.filters.query) filterSummary.push(`"${search.filters.query}"`)
  if (search.filters.stage) filterSummary.push(search.filters.stage)
  if (search.filters.distress_signals?.length) {
    filterSummary.push(`${search.filters.distress_signals.length} signals`)
  }
  if (search.filters.zip_codes?.length) {
    filterSummary.push(`${search.filters.zip_codes.length} ZIPs`)
  }

  return (
    <Card style={styles.searchCard} padding="md">
      <View style={styles.searchHeader}>
        <View style={styles.searchInfo}>
          <Text style={styles.searchName}>{search.name}</Text>
          {search.description && (
            <Text style={styles.searchDesc} numberOfLines={1}>
              {search.description}
            </Text>
          )}
        </View>
        {search.auto_run_enabled && (
          <View style={styles.autoBadge}>
            <Text style={styles.autoBadgeText}>Auto</Text>
          </View>
        )}
      </View>

      {/* Filters Summary */}
      {filterSummary.length > 0 && (
        <View style={styles.filterRow}>
          {filterSummary.map((filter, i) => (
            <View key={i} style={styles.filterChip}>
              <Text style={styles.filterChipText}>{filter}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Last Run</Text>
          <Text style={styles.statValue}>{formatDate(search.last_run_at)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Results</Text>
          <Text style={styles.statValue}>
            {search.last_result_count ?? '-'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Runs</Text>
          <Text style={styles.statValue}>{search.run_count || 0}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={onRun}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.runButtonText}>Run Search</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  )
}

export default function SavedSearchesScreen() {
  const router = useRouter()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  const loadSearches = useCallback(async () => {
    try {
      const data = await getSavedSearches()
      setSearches(data)
    } catch (err) {
      console.error('Failed to load saved searches:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadSearches()
  }, [loadSearches])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    loadSearches()
  }, [loadSearches])

  const handleRun = useCallback(async (search: SavedSearch) => {
    setRunningId(search.id)
    try {
      const result = await runSavedSearch(search.id)
      if (result) {
        Alert.alert(
          'Search Complete',
          `Found ${result.count} results`,
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'View Results',
              onPress: () => {
                // Navigate to search with results
                router.push({
                  pathname: '/(tabs)/search',
                  params: { savedSearchId: search.id },
                })
              },
            },
          ]
        )
        // Refresh to update stats
        loadSearches()
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to run search')
    } finally {
      setRunningId(null)
    }
  }, [router, loadSearches])

  const handleDelete = useCallback((search: SavedSearch) => {
    Alert.alert(
      'Delete Search',
      `Are you sure you want to delete "${search.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSavedSearch(search.id)
            if (success) {
              setSearches((prev) => prev.filter((s) => s.id !== search.id))
            } else {
              Alert.alert('Error', 'Failed to delete search')
            }
          },
        },
      ]
    )
  }, [])

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Saved Searches',
            headerStyle: { backgroundColor: colors.white },
            headerTintColor: colors.ink,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Saved Searches',
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
        }}
      />
      <ScreenContainer scrollable={false} padding={false}>
        {searches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No Saved Searches</Text>
            <Text style={styles.emptyDesc}>
              Save searches from the Search screen to quickly run them again later.
            </Text>
            <Button
              variant="primary"
              onPress={() => router.push('/(tabs)/search')}
              style={{ marginTop: spacing.lg }}
            >
              Go to Search
            </Button>
          </View>
        ) : (
          <FlatList
            data={searches}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.brand[500]}
              />
            }
            renderItem={({ item }) => (
              <SearchCard
                search={item}
                onRun={() => handleRun(item)}
                onDelete={() => handleDelete(item)}
                isRunning={runningId === item.id}
              />
            )}
          />
        )}
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  searchCard: {
    marginBottom: spacing.md,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  searchInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  searchName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  searchDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  autoBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  autoBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[700],
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    backgroundColor: colors.error[50],
  },
  deleteButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  runButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.brand[500],
  },
  runButtonDisabled: {
    backgroundColor: colors.brand[300],
  },
  runButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyDesc: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
  },
})
