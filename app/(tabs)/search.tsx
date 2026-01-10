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
  Linking,
} from 'react-native'
import { useRouter, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Card, Button, Input, AddressAutocomplete, TrialLimitModal, MarketAlertBanner, FlipMantisMap, type ParsedAddress, type MapPin } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { getDeals, getLeads, searchProperty, createDealFromProperty, createSavedSearch, UsageLimitError, attomService } from '../../src/services'
import type { ComparableSale } from '../../src/types/attom'
import { useSearchHistoryStore, type RecentSearch } from '../../src/stores'
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
          {lead.reach_status && lead.reach_status !== 'not_started' && (
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

  // Comps state
  const [showComps, setShowComps] = useState(false)
  const [comps, setComps] = useState<ComparableSale[]>([])
  const [compsLoading, setCompsLoading] = useState(false)
  const [arvAnalysis, setArvAnalysis] = useState<{
    arv: number
    medianPrice: number
    avgPricePerSqft: number
    confidence: string
  } | null>(null)

  // Fetch comps when expanded
  const handleToggleComps = useCallback(async () => {
    if (!showComps && comps.length === 0 && property.identifier?.attomId) {
      setCompsLoading(true)
      try {
        const result = await attomService.getComparablesWithARV(property.identifier.attomId)
        if (result.success && result.data) {
          setComps(result.data.comparables || [])
          if (result.data.arvAnalysis) {
            setArvAnalysis(result.data.arvAnalysis)
          }
        }
      } catch (err) {
        console.error('Error fetching comps:', err)
      } finally {
        setCompsLoading(false)
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowComps(!showComps)
  }, [showComps, comps.length, property.identifier?.attomId])

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

      {/* Owner Contact Info (if skip traced) */}
      {(property.ownership?.phone || property.ownership?.email || property.contacts?.length > 0) && (
        <View style={styles.contactInfoSection}>
          <Text style={styles.contactInfoLabel}>Contact Info</Text>
          {/* Primary contact from ownership */}
          {property.ownership?.phone && (
            <View style={styles.contactRow}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactIcon}>📞</Text>
                <Text style={styles.contactText}>{property.ownership.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    Linking.openURL(`tel:${property.ownership.phone}`)
                  }}
                >
                  <Text style={styles.contactButtonText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    Linking.openURL(`sms:${property.ownership.phone}`)
                  }}
                >
                  <Text style={styles.contactButtonText}>Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {property.ownership?.email && (
            <View style={styles.contactRow}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactIcon}>✉️</Text>
                <Text style={styles.contactText} numberOfLines={1}>{property.ownership.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  Linking.openURL(`mailto:${property.ownership.email}`)
                }}
              >
                <Text style={styles.contactButtonText}>Email</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Additional contacts from skip trace */}
          {property.contacts?.slice(0, 2).map((contact: any, idx: number) => (
            <View key={idx} style={styles.contactRow}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactIcon}>{contact.phone ? '📞' : '✉️'}</Text>
                <Text style={styles.contactText} numberOfLines={1}>
                  {contact.phone || contact.email}
                </Text>
              </View>
              {contact.phone && (
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      Linking.openURL(`tel:${contact.phone}`)
                    }}
                  >
                    <Text style={styles.contactButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      Linking.openURL(`sms:${contact.phone}`)
                    }}
                  >
                    <Text style={styles.contactButtonText}>Text</Text>
                  </TouchableOpacity>
                </View>
              )}
              {contact.email && !contact.phone && (
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    Linking.openURL(`mailto:${contact.email}`)
                  }}
                >
                  <Text style={styles.contactButtonText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Comps Preview Section */}
      {property.identifier?.attomId && (
        <View style={styles.compsSection}>
          <TouchableOpacity
            style={styles.compsToggle}
            onPress={handleToggleComps}
            activeOpacity={0.7}
          >
            <View style={styles.compsToggleLeft}>
              <Text style={styles.compsToggleIcon}>📊</Text>
              <Text style={styles.compsToggleText}>
                {showComps ? 'Hide Comparables' : 'View Comparables'}
              </Text>
            </View>
            <Text style={styles.compsToggleArrow}>{showComps ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {showComps && (
            <View style={styles.compsContent}>
              {compsLoading ? (
                <View style={styles.compsLoading}>
                  <ActivityIndicator size="small" color={colors.brand[500]} />
                  <Text style={styles.compsLoadingText}>Loading comps...</Text>
                </View>
              ) : comps.length > 0 ? (
                <>
                  {/* ARV Analysis Summary */}
                  {arvAnalysis && (
                    <View style={styles.arvSummary}>
                      <View style={styles.arvItem}>
                        <Text style={styles.arvLabel}>Est. ARV</Text>
                        <Text style={styles.arvValue}>${arvAnalysis.arv.toLocaleString()}</Text>
                      </View>
                      <View style={styles.arvItem}>
                        <Text style={styles.arvLabel}>$/SqFt</Text>
                        <Text style={styles.arvValue}>${arvAnalysis.avgPricePerSqft}</Text>
                      </View>
                      <View style={[
                        styles.confidenceBadge,
                        arvAnalysis.confidence === 'high' ? styles.confidenceHigh :
                        arvAnalysis.confidence === 'medium' ? styles.confidenceMedium : styles.confidenceLow
                      ]}>
                        <Text style={styles.confidenceText}>{arvAnalysis.confidence}</Text>
                      </View>
                    </View>
                  )}

                  {/* Comps List */}
                  {comps.slice(0, 3).map((comp, idx) => (
                    <View key={comp.attomId || idx} style={styles.compCard}>
                      <View style={styles.compHeader}>
                        <Text style={styles.compAddress} numberOfLines={1}>{comp.address}</Text>
                        <Text style={styles.compDistance}>{comp.distance.toFixed(1)} mi</Text>
                      </View>
                      <View style={styles.compDetails}>
                        <Text style={styles.compPrice}>${comp.salePrice.toLocaleString()}</Text>
                        <Text style={styles.compMeta}>
                          {comp.bedrooms}bd/{comp.bathrooms}ba • {comp.sqft.toLocaleString()} sqft
                        </Text>
                      </View>
                      <Text style={styles.compDate}>
                        Sold {comp.daysAgo} days ago • ${comp.pricePerSqft}/sqft
                      </Text>
                    </View>
                  ))}

                  {comps.length > 3 && (
                    <Text style={styles.compsMoreText}>
                      +{comps.length - 3} more comparables
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.compsEmptyText}>No comparable sales found nearby</Text>
              )}
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

  // Search history store
  const { recentSearches, addSearch, removeSearch, clearHistory } = useSearchHistoryStore()

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
  const [propertyViewMode, setPropertyViewMode] = useState<'list' | 'map'>('list')

  // Save search modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [savingSearch, setSavingSearch] = useState(false)

  // Trial limit modal state
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)
  const [trialLimitData, setTrialLimitData] = useState<{
    feature: 'property_search' | 'skip_trace'
    used: number
    trialLimit: number
    paidLimit: number
    costPerUnit: number
    dailyUsed?: number
    dailyLimit?: number
    isDailyLimit: boolean
  } | null>(null)

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

      // Save to recent searches
      addSearch({
        address: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: data.property?.location?.zipCode || undefined,
      })
    } catch (err) {
      console.error('Property search error:', err)

      // Check if this is a usage limit error
      if (err instanceof UsageLimitError) {
        setTrialLimitData({
          feature: 'property_search',
          used: err.used || 0,
          trialLimit: err.trialLimit || 50,
          paidLimit: err.paidLimit || -1,
          costPerUnit: err.costPerUnit || 0.25,
          dailyUsed: err.dailyUsed,
          dailyLimit: err.dailyLimit,
          isDailyLimit: err.isDailyLimit,
        })
        setShowTrialLimitModal(true)
        setError(err.isDailyLimit
          ? 'Daily search limit reached'
          : 'Search limit reached')
      } else {
        setError('Search failed. Please try again.')
      }
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

  // Use a recent search
  const handleUseRecentSearch = useCallback((search: RecentSearch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setAddress(search.address)
    setCity(search.city || '')
    setState(search.state || '')
    // Auto-search after a brief delay
    setTimeout(() => handleSearchProperty(), 100)
  }, [handleSearchProperty])

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
            {/* Market Alerts Banner */}
            <View style={styles.marketAlertContainer}>
              <MarketAlertBanner maxAlerts={3} autoRotate rotateInterval={5000} />
            </View>

            {/* Recent Searches */}
            {recentSearches.length > 0 && !propertyResult && (
              <View style={styles.recentSearchesContainer}>
                <View style={styles.recentSearchesHeader}>
                  <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearHistory}>
                    <Text style={styles.recentSearchesClear}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentSearchesScroll}
                >
                  {recentSearches.map((search) => (
                    <TouchableOpacity
                      key={search.id}
                      style={styles.recentSearchChip}
                      onPress={() => handleUseRecentSearch(search)}
                    >
                      <Text style={styles.recentSearchIcon}>📍</Text>
                      <View style={styles.recentSearchContent}>
                        <Text style={styles.recentSearchAddress} numberOfLines={1}>
                          {search.address}
                        </Text>
                        {(search.city || search.state) && (
                          <Text style={styles.recentSearchCity} numberOfLines={1}>
                            {[search.city, search.state].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Card padding="md">
              <Text style={styles.formTitle}>Property Lookup</Text>
              <Text style={styles.formSubtitle}>
                Search any U.S. property address to get valuation, owner info, and sales history.
              </Text>

              <AddressAutocomplete
                label="Property Address"
                placeholder="Start typing an address..."
                onAddressSelected={(parsed: ParsedAddress) => {
                  setAddress(parsed.streetAddress)
                  setCity(parsed.city)
                  setState(parsed.state)
                  // Auto-search after selecting an address
                  setTimeout(() => handleSearchProperty(), 100)
                }}
              />

              {/* Show selected address details */}
              {address && (
                <View style={styles.selectedAddressContainer}>
                  <Text style={styles.selectedAddressLabel}>Selected:</Text>
                  <Text style={styles.selectedAddressText}>
                    {address}{city ? `, ${city}` : ''}{state ? `, ${state}` : ''}
                  </Text>
                </View>
              )}

              <Button
                variant="primary"
                onPress={handleSearchProperty}
                disabled={searchingProperty || !address.trim()}
              >
                {searchingProperty ? 'Hunting...' : 'Search Property'}
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
                <Text style={styles.loadingText}>Mantis hunting property intel...</Text>
                <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
              </View>
            )}

            {/* Result */}
            {propertyResult && !searchingProperty && (
              <View style={{ marginTop: spacing.md }}>
                {/* View Mode Toggle */}
                <View style={styles.viewModeToggleContainer}>
                  {propertyResult.cached && (
                    <View style={styles.cachedBadge}>
                      <Text style={styles.cachedBadgeText}>📋 Cached</Text>
                    </View>
                  )}
                  <View style={styles.viewModeToggle}>
                    <TouchableOpacity
                      style={[styles.viewModeButton, propertyViewMode === 'list' && styles.viewModeButtonActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setPropertyViewMode('list')
                      }}
                    >
                      <Text style={styles.viewModeIcon}>📋</Text>
                      <Text style={[styles.viewModeText, propertyViewMode === 'list' && styles.viewModeTextActive]}>List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewModeButton, propertyViewMode === 'map' && styles.viewModeButtonActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setPropertyViewMode('map')
                      }}
                    >
                      <Text style={styles.viewModeIcon}>🗺️</Text>
                      <Text style={[styles.viewModeText, propertyViewMode === 'map' && styles.viewModeTextActive]}>Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* List View */}
                {propertyViewMode === 'list' && (
                  <PropertyCard
                    property={propertyResult.property}
                    cacheId={propertyResult.cacheId}
                    onViewDetails={handleViewDetails}
                    onAddToDeal={handleAddToDeal}
                    loading={creating}
                  />
                )}

                {/* Map View */}
                {propertyViewMode === 'map' && (
                  <View style={styles.mapContainer}>
                    <FlipMantisMap
                      initialCenter={[
                        propertyResult.property?.location?.longitude || -87.6298,
                        propertyResult.property?.location?.latitude || 41.8781
                      ]}
                      initialZoom={15}
                      pins={[{
                        id: 'property-result',
                        lat: propertyResult.property?.location?.latitude || 41.8781,
                        lng: propertyResult.property?.location?.longitude || -87.6298,
                        label: propertyResult.property?.location?.address || address,
                        type: 'property',
                      }]}
                      showUserLocation={false}
                      style={styles.map}
                    />
                    {/* Property Info Overlay */}
                    <View style={styles.mapPropertyOverlay}>
                      <Text style={styles.mapPropertyAddress} numberOfLines={1}>
                        {propertyResult.property?.location?.address || address}
                      </Text>
                      {propertyResult.property?.valuation?.avm > 0 && (
                        <Text style={styles.mapPropertyValue}>
                          ${propertyResult.property.valuation.avm.toLocaleString()}
                        </Text>
                      )}
                      <View style={styles.mapPropertyActions}>
                        <Button variant="primary" size="sm" onPress={handleViewDetails}>
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" onPress={handleAddToDeal} disabled={creating}>
                          {creating ? 'Adding...' : 'Add to Pipeline'}
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
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

      {/* Trial Limit Modal */}
      {trialLimitData && (
        <TrialLimitModal
          visible={showTrialLimitModal}
          onClose={() => {
            setShowTrialLimitModal(false)
            setTrialLimitData(null)
          }}
          feature={trialLimitData.feature}
          used={trialLimitData.used}
          trialLimit={trialLimitData.trialLimit}
          paidLimit={trialLimitData.paidLimit}
          costPerUnit={trialLimitData.costPerUnit}
          dailyUsed={trialLimitData.dailyUsed}
          dailyLimit={trialLimitData.dailyLimit}
          isDailyLimit={trialLimitData.isDailyLimit}
        />
      )}
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
  selectedAddressContainer: {
    backgroundColor: colors.brand[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectedAddressLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  selectedAddressText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[800],
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
  // Recent Searches styles
  recentSearchesContainer: {
    marginBottom: spacing.md,
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentSearchesTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
  },
  recentSearchesClear: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.medium,
  },
  recentSearchesScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    gap: spacing.sm,
    maxWidth: 200,
    ...shadows.soft,
  },
  recentSearchIcon: {
    fontSize: 16,
  },
  recentSearchContent: {
    flex: 1,
    minWidth: 0,
  },
  recentSearchAddress: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  recentSearchCity: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 1,
  },
  // Contact Info styles
  contactInfoSection: {
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  contactInfoLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  contactIcon: {
    fontSize: 14,
  },
  contactText: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    flex: 1,
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contactButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand[50],
    borderRadius: radii.md,
  },
  contactButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  // Market Alert Banner container
  marketAlertContainer: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  // View Mode Toggle styles
  viewModeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    padding: 4,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  viewModeButtonActive: {
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  viewModeIcon: {
    fontSize: 14,
  },
  viewModeText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    fontWeight: typography.fontWeight.medium,
  },
  viewModeTextActive: {
    color: colors.brand[600],
  },
  // Map View styles
  mapContainer: {
    height: 400,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.slate[100],
  },
  map: {
    flex: 1,
  },
  mapPropertyOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  mapPropertyAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  mapPropertyValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
    marginBottom: spacing.sm,
  },
  mapPropertyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Comps Preview styles
  compsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  compsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  compsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compsToggleIcon: {
    fontSize: 16,
  },
  compsToggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  compsToggleArrow: {
    fontSize: 12,
    color: colors.slate[400],
  },
  compsContent: {
    paddingTop: spacing.sm,
  },
  compsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  compsLoadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  arvSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.lg,
  },
  arvItem: {
    flex: 1,
  },
  arvLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
    marginBottom: 2,
  },
  arvValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[700],
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  confidenceHigh: {
    backgroundColor: colors.success[100],
  },
  confidenceMedium: {
    backgroundColor: colors.warning[100],
  },
  confidenceLow: {
    backgroundColor: colors.slate[100],
  },
  confidenceText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  compCard: {
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  compAddress: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.sm,
  },
  compDistance: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  compDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  compPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  compMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  compDate: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  compsMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  compsEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
})
