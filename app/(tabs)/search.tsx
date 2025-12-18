/**
 * Search Screen
 *
 * Property search with map and list fallback.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Link } from 'expo-router'
import { ScreenContainer, Card, SearchInput, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'

// Mock property data
const MOCK_PROPERTIES = [
  {
    id: '1',
    address: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    price: 185000,
    beds: 3,
    baths: 2,
    sqft: 1450,
    status: 'Active',
  },
  {
    id: '2',
    address: '456 Oak Ave',
    city: 'Naperville',
    state: 'IL',
    zip: '60540',
    price: 325000,
    beds: 4,
    baths: 2.5,
    sqft: 2200,
    status: 'Active',
  },
  {
    id: '3',
    address: '789 Pine Rd',
    city: 'Aurora',
    state: 'IL',
    zip: '60506',
    price: 145000,
    beds: 2,
    baths: 1,
    sqft: 950,
    status: 'Pending',
  },
]

// Property Card Component
function PropertyCard({
  id,
  address,
  city,
  state,
  price,
  beds,
  baths,
  sqft,
  status,
}: {
  id: string
  address: string
  city: string
  state: string
  price: number
  beds: number
  baths: number
  sqft: number
  status: string
}) {
  return (
    <Link href={`/property/${id}`} asChild>
      <TouchableOpacity activeOpacity={0.7}>
        <Card style={styles.propertyCard} padding="md">
          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              status === 'Pending' && styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                status === 'Pending' && styles.statusBadgeTextPending,
              ]}
            >
              {status}
            </Text>
          </View>

          {/* Address */}
          <Text style={styles.propertyAddress}>{address}</Text>
          <Text style={styles.propertyCity}>
            {city}, {state}
          </Text>

          {/* Price */}
          <Text style={styles.propertyPrice}>
            ${price.toLocaleString()}
          </Text>

          {/* Details */}
          <View style={styles.propertyDetails}>
            <Text style={styles.propertyDetail}>{beds} bed</Text>
            <Text style={styles.detailDot}>•</Text>
            <Text style={styles.propertyDetail}>{baths} bath</Text>
            <Text style={styles.detailDot}>•</Text>
            <Text style={styles.propertyDetail}>{sqft.toLocaleString()} sqft</Text>
          </View>
        </Card>
      </TouchableOpacity>
    </Link>
  )
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  const filteredProperties = MOCK_PROPERTIES.filter(
    (p) =>
      p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ScreenContainer scrollable={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Property Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search address, city, or ZIP..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === 'list' && styles.toggleButtonTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
          onPress={() => setViewMode('map')}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === 'map' && styles.toggleButtonTextActive,
            ]}
          >
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {viewMode === 'list' ? (
        <FlatList
          data={filteredProperties}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PropertyCard {...item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🏠</Text>
              <Text style={styles.emptyStateTitle}>No properties found</Text>
              <Text style={styles.emptyStateText}>
                Try adjusting your search criteria
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
            <Text style={styles.mapPlaceholderText}>Map View Coming Soon</Text>
            <Text style={styles.mapPlaceholderSubtext}>
              Mapbox integration pending
            </Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  searchContainer: {
    marginBottom: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  toggleButtonActive: {
    backgroundColor: colors.white,
  },
  toggleButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  toggleButtonTextActive: {
    color: colors.brand[600],
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  propertyCard: {
    marginBottom: spacing.sm,
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.full,
  },
  statusBadgePending: {
    backgroundColor: colors.warning[100],
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  statusBadgeTextPending: {
    color: colors.warning[700],
  },
  propertyAddress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginRight: 80,
  },
  propertyCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
  },
  propertyPrice: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
    marginBottom: spacing.xs,
  },
  propertyDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyDetail: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  detailDot: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[300],
    marginHorizontal: spacing.xs,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate[100],
    borderRadius: radii.xl,
    margin: spacing.md,
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  mapPlaceholderText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  mapPlaceholderSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
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
  },
})
