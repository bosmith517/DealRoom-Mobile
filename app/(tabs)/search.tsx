/**
 * Search Screen
 *
 * Search existing deals in database + lookup new properties via ATTOM.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  TextInput,
  Pressable,
  Modal,
} from 'react-native'
import { useRouter, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card, Button, Input } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { getDeals, getLeads, searchProperty, createDealFromProperty, createSavedSearch } from '../../src/services'
import type { Lead } from '../../src/types'
import { DEAL_STAGE_CONFIG } from '../../src/types'
import type { DealWithProperty, DealStage } from '../../src/types'

// Stage filter options
const STAGE_FILTERS: { key: DealStage | 'all'; label: string }[] = [
  { key: 'all', label: 'All Stages' },
  { key: 'lead', label: 'Lead' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'offer_submitted', label: 'Offer' },
  { key: 'under_contract', label: 'Contract' },
  { key: 'closed', label: 'Closed' },
]

// Tab type
type SearchTab = 'deals' | 'distressed' | 'property'

// Distress signal filters
const DISTRESS_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '🔥' },
  { key: 'pre_foreclosure', label: 'Pre-Foreclosure', icon: '⚠️' },
  { key: 'tax_delinquent', label: 'Tax Delinquent', icon: '💰' },
  { key: 'vacant', label: 'Vacant', icon: '🏚️' },
  { key: 'boarded', label: 'Boarded', icon: '🚫' },
  { key: 'code_violation', label: 'Code Violation', icon: '📋' },
  { key: 'absentee', label: 'Absentee', icon: '🏠' },
]

// Distressed Lead Card
function DistressedLeadCard({ lead }: { lead: Lead }) {
  const address = lead.address || lead.address_line1 || 'Unknown Address'
  const city = lead.city || ''
  const score = lead.rank_score || 0
  const signals = lead.distress_signals || []

  return (
    <Link href={`/lead/${lead.id}`} asChild>
      <TouchableOpacity activeOpacity={0.7}>
        <Card style={styles.dealCard} padding="md">
          <View style={styles.leadHeader}>
            <View style={styles.leadHeaderContent}>
              <Text style={styles.dealAddress} numberOfLines={1}>{address}</Text>
              {city && <Text style={styles.dealCity}>{city}</Text>}
            </View>
            <View style={[
              styles.scoreCircle,
              score >= 70 ? styles.scoreHigh : score >= 40 ? styles.scoreMedium : styles.scoreLow
            ]}>
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          </View>

          {/* Distress Signals */}
          {signals.length > 0 && (
            <View style={styles.signalsRow}>
              {signals.slice(0, 3).map((signal: string, index: number) => (
                <View key={index} style={styles.signalChip}>
                  <Text style={styles.signalChipText}>
                    {signal.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
              {signals.length > 3 && (
                <Text style={styles.moreSignals}>+{signals.length - 3}</Text>
              )}
            </View>
          )}

          {/* Reach Status */}
          {lead.reach_status && lead.reach_status !== 'new' && (
            <View style={styles.reachStatusRow}>
              <Ionicons name="radio-outline" size={12} color={colors.brand[500]} />
              <Text style={styles.reachStatusText}>
                {lead.reach_status.replace(/_/g, ' ')}
              </Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    </Link>
  )
}

// Deal Result Card
function DealCard({ deal }: { deal: DealWithProperty }) {
  const stageConfig = DEAL_STAGE_CONFIG[deal.stage as DealStage] || { label: deal.stage, color: '#94a3b8' }
  const address = deal.property?.address_line1 || deal.deal_name || 'Unnamed Deal'
  const city = deal.property?.city || ''
  const price = deal.contract_price || deal.offer_price || deal.asking_price || 0

  return (
    <Link href={`/property/${deal.id}`} asChild>
      <TouchableOpacity activeOpacity={0.7}>
        <Card style={styles.dealCard} padding="md">
          <Text style={styles.dealAddress} numberOfLines={1}>{address}</Text>
          <View style={styles.dealMeta}>
            <View style={[styles.stageBadge, { backgroundColor: `${stageConfig.color}20` }]}>
              <Text style={[styles.stageBadgeText, { color: stageConfig.color }]}>
                {stageConfig.label}
              </Text>
            </View>
            {city && <Text style={styles.dealCity}>{city}</Text>}
          </View>
          {price > 0 && (
            <Text style={styles.dealPrice}>${price.toLocaleString()}</Text>
          )}
        </Card>
      </TouchableOpacity>
    </Link>
  )
}

// Property Result Card (from ATTOM)
function PropertyCard({
  property,
  cacheId,
  onViewDetails,
  onAddToDeal,
  loading,
}: {
  property: any
  cacheId?: string
  onViewDetails: () => void
  onAddToDeal: () => void
  loading: boolean
}) {
  const loc = property.location || {}
  const summary = property.summary || {}
  const valuation = property.valuation || {}
  const sale = property.saleHistory || {}

  return (
    <Card style={styles.propertyCard} padding="md">
      <Text style={styles.propertyAddress}>{loc.address || 'Unknown Address'}</Text>
      <Text style={styles.propertyCity}>
        {[loc.city, loc.state, loc.zipCode].filter(Boolean).join(', ')}
      </Text>

      {/* Property Details */}
      <View style={styles.propertyDetails}>
        {summary.bedrooms > 0 && <Text style={styles.propertyDetail}>{summary.bedrooms} bed</Text>}
        {summary.bedrooms > 0 && summary.bathrooms > 0 && <Text style={styles.detailDot}>•</Text>}
        {summary.bathrooms > 0 && <Text style={styles.propertyDetail}>{summary.bathrooms} bath</Text>}
        {summary.sqft > 0 && (
          <>
            <Text style={styles.detailDot}>•</Text>
            <Text style={styles.propertyDetail}>{summary.sqft.toLocaleString()} sqft</Text>
          </>
        )}
      </View>

      {/* Valuation */}
      <View style={styles.valuationRow}>
        {valuation.avm > 0 && (
          <View style={styles.valuationItem}>
            <Text style={styles.valuationLabel}>Est. Value</Text>
            <Text style={styles.valuationValue}>${valuation.avm.toLocaleString()}</Text>
          </View>
        )}
        {sale.lastSalePrice > 0 && (
          <View style={styles.valuationItem}>
            <Text style={styles.valuationLabel}>Last Sale</Text>
            <Text style={styles.valuationValue}>${sale.lastSalePrice.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {/* Owner Info */}
      {property.ownership?.ownerName && (
        <View style={styles.ownerRow}>
          <Text style={styles.ownerLabel}>Owner:</Text>
          <Text style={styles.ownerName} numberOfLines={1}>{property.ownership.ownerName}</Text>
          {property.ownership.ownerOccupied !== undefined && (
            <View style={[
              styles.ownerBadge,
              property.ownership.ownerOccupied ? styles.ownerOccupied : styles.absenteeOwner
            ]}>
              <Text style={[
                styles.ownerBadgeText,
                property.ownership.ownerOccupied ? styles.ownerOccupiedText : styles.absenteeOwnerText
              ]}>
                {property.ownership.ownerOccupied ? 'Owner Occ.' : 'Absentee'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons - View Details is primary, Add to Pipeline is secondary */}
      <View style={styles.actionButtonsRow}>
        <Button
          variant="primary"
          onPress={onViewDetails}
          style={styles.actionButtonFlex}
        >
          🔍 View Details
        </Button>
        <Button
          variant="outline"
          onPress={onAddToDeal}
          disabled={loading}
          style={styles.actionButtonFlex}
        >
          {loading ? 'Adding...' : '+ Add to Pipeline'}
        </Button>
      </View>
    </Card>
  )
}

export default function SearchScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SearchTab>('deals')
  const searchInputRef = useRef<TextInput>(null)

  // Deal search state
  const [dealQuery, setDealQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<DealStage | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dealResults, setDealResults] = useState<DealWithProperty[]>([])
  const [searchingDeals, setSearchingDeals] = useState(false)

  // Distressed leads state
  const [distressedLeads, setDistressedLeads] = useState<Lead[]>([])
  const [distressFilter, setDistressFilter] = useState<string>('all')
  const [searchingDistressed, setSearchingDistressed] = useState(false)
  const [minScore, setMinScore] = useState(30)

  // Property search state
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [propertyResult, setPropertyResult] = useState<any>(null)
  const [searchingProperty, setSearchingProperty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save search modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [savingSearch, setSavingSearch] = useState(false)

  // Handle save search
  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim()) {
      Alert.alert('Error', 'Please enter a name for this search')
      return
    }

    setSavingSearch(true)
    try {
      const filters: Record<string, any> = {}

      if (activeTab === 'deals') {
        if (dealQuery.trim()) filters.query = dealQuery.trim()
        if (stageFilter !== 'all') filters.stage = stageFilter
      } else if (activeTab === 'distressed') {
        if (distressFilter !== 'all') filters.distress_signals = [distressFilter]
        if (minScore > 0) filters.min_score = minScore
      }

      const result = await createSavedSearch({
        name: saveSearchName.trim(),
        filters,
      })

      if (result) {
        Alert.alert('Saved!', 'Your search has been saved.')
        setShowSaveModal(false)
        setSaveSearchName('')
      } else {
        Alert.alert('Error', 'Failed to save search')
      }
    } catch (err) {
      console.error('Save search error:', err)
      Alert.alert('Error', 'Failed to save search')
    } finally {
      setSavingSearch(false)
    }
  }, [saveSearchName, activeTab, dealQuery, stageFilter, distressFilter, minScore])

  // Search deals in database
  const handleSearchDeals = useCallback(async (dismissKeyboard = false) => {
    if (!dealQuery.trim() && stageFilter === 'all') {
      setDealResults([])
      return
    }

    if (dismissKeyboard) {
      Keyboard.dismiss()
    }
    setSearchingDeals(true)

    try {
      const { data, error: searchError } = await getDeals({
        search: dealQuery.trim() || undefined,
        stage: stageFilter === 'all' ? undefined : stageFilter,
        limit: 20,
      })

      if (searchError) {
        console.error('Deal search error:', searchError)
      } else {
        setDealResults(data)
      }
    } catch (err) {
      console.error('Deal search error:', err)
    } finally {
      setSearchingDeals(false)
    }
  }, [dealQuery, stageFilter])

  // Auto-search deals as user types (debounced) or filter changes
  useEffect(() => {
    if (activeTab !== 'deals') return
    const timer = setTimeout(() => {
      if (dealQuery.trim() || stageFilter !== 'all') {
        handleSearchDeals(false)
      } else {
        setDealResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [dealQuery, stageFilter, activeTab, handleSearchDeals])

  // Search distressed leads
  const handleSearchDistressed = useCallback(async () => {
    setSearchingDistressed(true)
    try {
      const { data, error: fetchError } = await getLeads({
        minScore: minScore,
        distressSignal: distressFilter !== 'all' ? distressFilter : undefined,
        limit: 50,
      })

      if (fetchError) {
        console.error('Distressed leads error:', fetchError)
      } else {
        setDistressedLeads(data || [])
      }
    } catch (err) {
      console.error('Distressed leads error:', err)
    } finally {
      setSearchingDistressed(false)
    }
  }, [distressFilter, minScore])

  // Auto-fetch distressed leads when tab is active or filter changes
  useEffect(() => {
    if (activeTab === 'distressed') {
      handleSearchDistressed()
    }
  }, [activeTab, distressFilter, minScore, handleSearchDistressed])

  // Search property via ATTOM
  const handleSearchProperty = useCallback(async () => {
    if (!address.trim()) {
      setError('Please enter a street address')
      return
    }

    Keyboard.dismiss()
    setSearchingProperty(true)
    setError(null)
    setPropertyResult(null)

    try {
      const { data, error: searchError } = await searchProperty(
        address.trim(),
        city.trim() || undefined,
        state.trim() || undefined
      )

      if (searchError) {
        setError(searchError.message)
        return
      }

      if (!data?.success || !data.property) {
        setError('Property not found. Check the address and try again.')
        return
      }

      setPropertyResult({
        property: data.property,
        cacheId: data.cacheId,
        cached: data.cached || false,
      })
    } catch (err) {
      console.error('Property search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setSearchingProperty(false)
    }
  }, [address, city, state])

  // Create deal from property
  const handleAddToDeal = useCallback(async () => {
    if (!propertyResult?.property) return

    setCreating(true)
    try {
      const { data: deal, error: createError } = await createDealFromProperty(
        propertyResult.property,
        propertyResult.cacheId
      )

      if (createError) {
        Alert.alert('Error', createError.message)
        return
      }

      if (deal) {
        Alert.alert(
          'Deal Created!',
          'Property has been added to your pipeline.',
          [
            { text: 'View Deal', onPress: () => router.push(`/property/${deal.id}`) },
            { text: 'Continue', style: 'cancel' }
          ]
        )
        setPropertyResult(null)
        setAddress('')
        setCity('')
        setState('')
      }
    } catch (err) {
      console.error('Create deal error:', err)
      Alert.alert('Error', 'Failed to create deal')
    } finally {
      setCreating(false)
    }
  }, [propertyResult, router])

  // View property details without creating a deal (like web app)
  const handleViewDetails = useCallback(() => {
    if (!propertyResult?.property) return

    const loc = propertyResult.property.location || {}
    const attomId = propertyResult.property.identifier?.attomId || ''

    // Navigate to property-lookup screen with address params
    // This allows viewing ATTOM data without committing to the pipeline
    router.push({
      pathname: '/property-lookup/[attomId]',
      params: {
        attomId: attomId,
        address: loc.address || address,
        city: loc.city || city,
        state: loc.state || state,
        zip: loc.zipCode || '',
      },
    })
  }, [propertyResult, router, address, city, state])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
        </View>

        {/* Tab Selector - Use Pressable to avoid keyboard dismiss */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'deals' && styles.tabActive]}
            onPress={() => setActiveTab('deals')}
          >
            <Text style={[styles.tabText, activeTab === 'deals' && styles.tabTextActive]}>
              Deals
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'distressed' && styles.tabActive]}
            onPress={() => setActiveTab('distressed')}
          >
            <Text style={[styles.tabText, activeTab === 'distressed' && styles.tabTextActive]}>
              Distressed
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'property' && styles.tabActive]}
            onPress={() => setActiveTab('property')}
          >
            <Text style={[styles.tabText, activeTab === 'property' && styles.tabTextActive]}>
              Lookup
            </Text>
          </Pressable>
        </View>

        {/* Deals Search Tab */}
        {activeTab === 'deals' && (
          <View style={styles.tabContent}>
            {/* Search Input */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search by address or deal name..."
                  placeholderTextColor={colors.slate[400]}
                  value={dealQuery}
                  onChangeText={setDealQuery}
                  returnKeyType="search"
                  onSubmitEditing={() => handleSearchDeals(true)}
                  autoCorrect={false}
                />
                {dealQuery.length > 0 && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => {
                      setDealQuery('')
                      searchInputRef.current?.focus()
                    }}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                style={styles.filterButton}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Text style={styles.filterIcon}>⚙️</Text>
                {stageFilter !== 'all' && <View style={styles.filterDot} />}
              </Pressable>
            </View>

            {/* Filters Panel */}
            {showFilters && (
              <View style={styles.filtersPanel}>
                <View style={styles.filterHeader}>
                  <Text style={styles.filterLabel}>Filter by Stage</Text>
                  <TouchableOpacity
                    style={styles.saveSearchButton}
                    onPress={() => setShowSaveModal(true)}
                  >
                    <Text style={styles.saveSearchButtonText}>💾 Save Search</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.stageFilters}
                >
                  {STAGE_FILTERS.map((sf) => {
                    const isActive = stageFilter === sf.key
                    return (
                      <Pressable
                        key={sf.key}
                        style={[styles.stageChip, isActive && styles.stageChipActive]}
                        onPress={() => setStageFilter(sf.key)}
                      >
                        <Text style={[styles.stageChipText, isActive && styles.stageChipTextActive]}>
                          {sf.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* Results */}
            {searchingDeals ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.brand[500]} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : dealResults.length > 0 ? (
              <>
                <Text style={styles.resultCount}>{dealResults.length} deal(s) found</Text>
                {dealResults.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </>
            ) : dealQuery.trim() || stageFilter !== 'all' ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No deals found{dealQuery.trim() ? ` for "${dealQuery}"` : ''}
                  {stageFilter !== 'all' ? ` in ${STAGE_FILTERS.find(s => s.key === stageFilter)?.label}` : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🔍</Text>
                <Text style={styles.emptyStateTitle}>Search Your Deals</Text>
                <Text style={styles.emptyStateText}>
                  Find deals by address, name, or filter by stage
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Distressed Leads Tab */}
        {activeTab === 'distressed' && (
          <View style={styles.tabContent}>
            {/* Distress Signal Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.distressFilters}
              style={styles.distressFiltersScroll}
            >
              {DISTRESS_FILTERS.map((filter) => {
                const isActive = distressFilter === filter.key
                return (
                  <Pressable
                    key={filter.key}
                    style={[styles.distressChip, isActive && styles.distressChipActive]}
                    onPress={() => setDistressFilter(filter.key)}
                  >
                    <Text style={styles.distressChipIcon}>{filter.icon}</Text>
                    <Text style={[styles.distressChipText, isActive && styles.distressChipTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            {/* Min Score Filter */}
            <View style={styles.scoreFilterRow}>
              <Text style={styles.scoreFilterLabel}>Min Score: {minScore}+</Text>
              <View style={styles.scoreButtons}>
                {[0, 30, 50, 70].map((val) => (
                  <Pressable
                    key={val}
                    style={[styles.scoreButton, minScore === val && styles.scoreButtonActive]}
                    onPress={() => setMinScore(val)}
                  >
                    <Text style={[styles.scoreButtonText, minScore === val && styles.scoreButtonTextActive]}>
                      {val === 0 ? 'All' : val}+
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Results */}
            {searchingDistressed ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.brand[500]} />
                <Text style={styles.loadingText}>Searching distressed leads...</Text>
              </View>
            ) : distressedLeads.length > 0 ? (
              <>
                <Text style={styles.resultCount}>
                  {distressedLeads.length} distressed lead{distressedLeads.length !== 1 ? 's' : ''} found
                </Text>
                {distressedLeads.map((lead) => (
                  <DistressedLeadCard key={lead.id} lead={lead} />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🏚️</Text>
                <Text style={styles.emptyStateTitle}>No Distressed Leads</Text>
                <Text style={styles.emptyStateText}>
                  Capture leads while driving to find distressed properties.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Property Lookup Tab */}
        {activeTab === 'property' && (
          <View style={styles.tabContent}>
            <Card padding="md">
              <Text style={styles.formTitle}>Property Lookup</Text>
              <Text style={styles.formSubtitle}>
                Search any U.S. property address to get valuation, owner info, and sales history.
              </Text>

              <Input
                label="Street Address"
                placeholder="123 Main Street"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
                required
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Input
                    label="City"
                    placeholder="Chicago"
                    value={city}
                    onChangeText={setCity}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.formColSmall}>
                  <Input
                    label="State"
                    placeholder="IL"
                    value={state}
                    onChangeText={setState}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              <Button
                variant="primary"
                onPress={handleSearchProperty}
                disabled={searchingProperty || !address.trim()}
              >
                {searchingProperty ? 'Searching ATTOM...' : 'Search Property'}
              </Button>
            </Card>

            {/* Error */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Loading */}
            {searchingProperty && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brand[500]} />
                <Text style={styles.loadingText}>Searching ATTOM database...</Text>
                <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
              </View>
            )}

            {/* Result */}
            {propertyResult && !searchingProperty && (
              <View style={{ marginTop: spacing.md }}>
                {propertyResult.cached && (
                  <View style={styles.cachedBadge}>
                    <Text style={styles.cachedBadgeText}>📋 Cached Result</Text>
                  </View>
                )}
                <PropertyCard
                  property={propertyResult.property}
                  cacheId={propertyResult.cacheId}
                  onViewDetails={handleViewDetails}
                  onAddToDeal={handleAddToDeal}
                  loading={creating}
                />
              </View>
            )}

            {/* Empty State */}
            {!propertyResult && !searchingProperty && !error && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🏠</Text>
                <Text style={styles.emptyStateTitle}>Find Your Next Deal</Text>
                <Text style={styles.emptyStateText}>
                  Enter a property address above to get instant access to valuation and owner data.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Save Search Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSaveModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Save Search</Text>
            <TouchableOpacity onPress={handleSaveSearch} disabled={savingSearch}>
              {savingSearch ? (
                <ActivityIndicator size="small" color={colors.brand[500]} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Search Name</Text>
            <TextInput
              style={styles.modalInput}
              value={saveSearchName}
              onChangeText={setSaveSearchName}
              placeholder="e.g., Dallas Pre-Foreclosures"
              placeholderTextColor={colors.slate[400]}
              autoFocus
            />
            <Text style={styles.modalHint}>
              {activeTab === 'deals' && dealQuery
                ? `Query: "${dealQuery}"${stageFilter !== 'all' ? `, Stage: ${stageFilter}` : ''}`
                : activeTab === 'distressed'
                ? `Distress filter: ${distressFilter}, Min score: ${minScore}`
                : 'Current search filters will be saved'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  tabActive: {
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  tabTextActive: {
    color: colors.brand[600],
  },
  tabContent: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.slate[400],
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterIcon: {
    fontSize: 20,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: colors.brand[500],
    borderRadius: 4,
  },
  filtersPanel: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  filterLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
    marginBottom: spacing.sm,
  },
  stageFilters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stageChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  stageChipActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  stageChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  stageChipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  searchIcon: {
    fontSize: 16,
    color: colors.slate[400],
  },
  resultCount: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
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
    paddingVertical: 2,
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
  formTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formCol: {
    flex: 2,
  },
  formColSmall: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
  },
  loadingSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  cachedBadge: {
    backgroundColor: colors.brand[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  cachedBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  propertyCard: {
    marginBottom: spacing.sm,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButtonFlex: {
    flex: 1,
  },
  propertyAddress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  propertyCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
  },
  propertyDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
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
  valuationRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  valuationItem: {},
  valuationLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  valuationValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  ownerLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  ownerName: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  ownerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  ownerOccupied: {
    backgroundColor: colors.slate[100],
  },
  absenteeOwner: {
    backgroundColor: colors.warning[100],
  },
  ownerBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  ownerOccupiedText: {
    color: colors.slate[600],
  },
  absenteeOwnerText: {
    color: colors.warning[700],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
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
  // Distressed Lead Card styles
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadHeaderContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreHigh: {
    backgroundColor: colors.success[100],
  },
  scoreMedium: {
    backgroundColor: colors.warning[100],
  },
  scoreLow: {
    backgroundColor: colors.slate[100],
  },
  scoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  signalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  signalChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.error[50],
    borderRadius: radii.full,
  },
  signalChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    textTransform: 'capitalize',
  },
  moreSignals: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    paddingHorizontal: spacing.xs,
    alignSelf: 'center',
  },
  reachStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  reachStatusText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
    textTransform: 'capitalize',
  },
  // Distress filters
  distressFiltersScroll: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  distressFilters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  distressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
    gap: spacing.xs,
  },
  distressChipActive: {
    backgroundColor: colors.error[500],
    borderColor: colors.error[500],
  },
  distressChipIcon: {
    fontSize: 14,
  },
  distressChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  distressChipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  scoreFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  scoreFilterLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  scoreButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  scoreButtonActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  scoreButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  scoreButtonTextActive: {
    color: colors.white,
  },
  // Save Search styles
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  saveSearchButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand[50],
    borderRadius: radii.md,
  },
  saveSearchButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  modalSave: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[500],
  },
  modalContent: {
    padding: spacing.md,
  },
  modalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  modalHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.sm,
  },
})
