/**
 * Property Detail Screen
 *
 * Shows property details with inline editing, underwriting, and activity timeline.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Share,
  Linking,
} from 'react-native'
import { useLocalSearchParams, Stack, Link, useRouter } from 'expo-router'
import { ScreenContainer, Card, Button, PassDealModal, OutcomeLogger, SellerMotivationCard } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import {
  getDeal,
  getLatestUnderwriting,
  updateDealStage,
  updateDeal,
  updateProperty,
  getDealActivityTimeline,
  attomService,
  type ActivityEvent,
} from '../../src/services'
import { DEAL_STAGE_CONFIG } from '../../src/types'
import type { Deal, DealWithProperty, Underwriting, DealStage, Property } from '../../src/types'
import type { PropertyData } from '../../src/types/attom'
import { supabase } from '../../src/contexts/AuthContext'

// Stakeholder types for portal sharing
const STAKEHOLDER_TYPES = [
  { key: 'investor', label: 'Investor', icon: '💰' },
  { key: 'lender', label: 'Lender', icon: '🏦' },
  { key: 'contractor', label: 'Contractor', icon: '🔧' },
  { key: 'agent', label: 'Agent', icon: '🏠' },
  { key: 'partner', label: 'Partner', icon: '🤝' },
  { key: 'other', label: 'Other', icon: '👤' },
]

// Portal capabilities
const PORTAL_CAPABILITIES = [
  { key: 'view_overview', label: 'View Overview', description: 'Property & deal details' },
  { key: 'view_photos', label: 'View Photos', description: 'Evaluation photos' },
  { key: 'upload_photos', label: 'Upload Photos', description: 'Submit photos' },
  { key: 'comment', label: 'Comment', description: 'Add comments' },
]

// Format currency
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  return '$' + value.toLocaleString()
}

// Format relative time
function formatRelativeTime(dateString: string): string {
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

// Stage Badge Component
function StageBadge({ stage }: { stage: DealStage }) {
  const config = DEAL_STAGE_CONFIG[stage] || { label: stage, color: '#94a3b8' }
  return (
    <View style={[styles.stageBadge, { backgroundColor: `${config.color}20` }]}>
      <View style={[styles.stageDot, { backgroundColor: config.color }]} />
      <Text style={[styles.stageBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  )
}

// Editable Field Component
function EditableField({
  label,
  value,
  onChangeText,
  isEditing,
  keyboardType = 'default',
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  isEditing: boolean
  keyboardType?: 'default' | 'numeric' | 'number-pad'
  placeholder?: string
}) {
  return (
    <View style={styles.editableField}>
      <Text style={styles.editableLabel}>{label}</Text>
      {isEditing ? (
        <TextInput
          style={styles.editableInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.slate[400]}
        />
      ) : (
        <Text style={styles.editableValue}>{value || '-'}</Text>
      )}
    </View>
  )
}

// Activity Item Component
function ActivityItem({ event }: { event: ActivityEvent }) {
  const iconMap: Record<string, string> = {
    stage_change: '📊',
    note_added: '📝',
    photo_uploaded: '📷',
    evaluation_started: '📋',
    evaluation_completed: '✅',
    call_made: '📞',
    email_sent: '✉️',
    offer_sent: '💰',
    default: '📌',
  }
  const icon = (event.event_type && iconMap[event.event_type as keyof typeof iconMap]) || iconMap.default

  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{event.title}</Text>
        {event.description && (
          <Text style={styles.activityDescription}>{event.description}</Text>
        )}
        <Text style={styles.activityTime}>{formatRelativeTime(event.created_at)}</Text>
      </View>
    </View>
  )
}

// Expandable Section Component
function ExpandableSection({
  title,
  icon,
  children,
  defaultExpanded = false,
}: {
  title: string
  icon: string
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <Card style={styles.expandableSection} padding="none">
      <TouchableOpacity
        style={styles.expandableHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandableIcon}>{icon}</Text>
        <Text style={styles.expandableTitle}>{title}</Text>
        <Text style={styles.expandableArrow}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.expandableContent}>{children}</View>}
    </Card>
  )
}

// Data Row Component for ATTOM details
function DataRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  )
}

// Confidence Badge Component
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'
  const config = {
    low: { label: 'Low', color: colors.error[500], bg: colors.error[50] },
    medium: { label: 'Medium', color: colors.warning[600], bg: colors.warning[50] },
    high: { label: 'High', color: colors.success[600], bg: colors.success[50] },
  }
  const c = config[level]
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.confidenceBadgeText, { color: c.color }]}>
        {confidence}% {c.label}
      </Text>
    </View>
  )
}

// Foreclosure Status Badge
function ForeclosureBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    none: { label: 'No Distress', color: colors.success[600], bg: colors.success[50] },
    'pre-foreclosure': { label: 'Pre-Foreclosure', color: colors.error[600], bg: colors.error[50] },
    auction: { label: 'Auction', color: colors.error[700], bg: colors.error[100] },
    reo: { label: 'REO', color: colors.warning[700], bg: colors.warning[100] },
  }
  const config = statusConfig[status] || statusConfig.none
  return (
    <View style={[styles.foreclosureBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.foreclosureBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

export default function PropertyDetailScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>()
  const router = useRouter()

  const [deal, setDeal] = useState<DealWithProperty | null>(null)
  const [underwriting, setUnderwriting] = useState<Underwriting | null>(null)
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // ATTOM enriched property data
  const [attomData, setAttomData] = useState<PropertyData | null>(null)
  const [attomLoading, setAttomLoading] = useState(false)
  const [attomError, setAttomError] = useState<string | null>(null)

  // Portal sharing state
  const [showPortalModal, setShowPortalModal] = useState(false)

  // Intelligence components state
  const [showPassModal, setShowPassModal] = useState(false)
  const [enrichingMotivation, setEnrichingMotivation] = useState(false)
  const [portalForm, setPortalForm] = useState({
    stakeholderName: '',
    stakeholderType: 'investor',
    capabilities: ['view_overview', 'view_photos'] as string[],
    expiresInDays: 30,
  })
  const [generatingLink, setGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  // Editable form state
  const [editForm, setEditForm] = useState({
    // Deal fields
    name: '',
    notes: '',
    purchase_price: '',
    arv: '',
    rehab_budget: '',
    expected_profit: '',
    // Property fields
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    year_built: '',
  })

  const fetchData = useCallback(async () => {
    if (!assetId) {
      setError('No property ID provided')
      setLoading(false)
      return
    }

    try {
      setError(null)

      // Fetch deal with property
      const { data: dealData, error: dealError } = await getDeal(assetId)

      if (dealError) {
        setError(`Failed to load: ${dealError.message}`)
        return
      }

      if (!dealData) {
        setError('Property not found. It may have been deleted.')
        return
      }

      setDeal(dealData)

      // Initialize form with current values
      setEditForm({
        name: dealData.name || '',
        notes: dealData.notes || '',
        purchase_price: dealData.purchase_price?.toString() || '',
        arv: dealData.arv?.toString() || '',
        rehab_budget: dealData.rehab_budget?.toString() || '',
        expected_profit: dealData.expected_profit?.toString() || '',
        bedrooms: dealData.property?.bedrooms?.toString() || '',
        bathrooms: dealData.property?.bathrooms?.toString() || '',
        sqft: dealData.property?.sqft?.toString() || '',
        year_built: dealData.property?.year_built?.toString() || '',
      })

      // Fetch underwriting if available
      const { data: uwData } = await getLatestUnderwriting(dealData.id)
      if (uwData) {
        setUnderwriting(uwData)
      }

      // Fetch activity timeline
      try {
        const activityData = await getDealActivityTimeline(dealData.id)
        setActivities(activityData)
      } catch (actErr) {
        console.log('No activity data available')
      }
    } catch (err: any) {
      setError(`Failed to load: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [assetId])

  // Fetch ATTOM enrichment data
  const fetchAttomData = useCallback(async (property: Property) => {
    if (!property?.address_line1 || !property?.city || !property?.state) {
      return
    }

    setAttomLoading(true)
    setAttomError(null)

    try {
      const result = await attomService.getProperty({
        address: property.address_line1,
        city: property.city,
        state: property.state,
        zip: property.zip || '',
      })

      if (result.success && result.data) {
        setAttomData(result.data)
      } else {
        setAttomError(result.error?.message || 'Could not fetch property data')
      }
    } catch (err: any) {
      console.log('ATTOM fetch error:', err?.message)
      setAttomError('Could not enrich property data')
    } finally {
      setAttomLoading(false)
    }
  }, [])

  // Fetch ATTOM data when deal is loaded
  useEffect(() => {
    if (deal?.property && !attomData && !attomLoading) {
      fetchAttomData(deal.property)
    }
  }, [deal?.property, attomData, attomLoading, fetchAttomData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData()
  }, [fetchData])

  const handleSave = useCallback(async () => {
    if (!deal) return

    setSaving(true)
    try {
      // Update deal fields
      const dealUpdates: Partial<DealWithProperty> = {
        name: editForm.name,
        notes: editForm.notes,
        purchase_price: editForm.purchase_price ? parseFloat(editForm.purchase_price) : undefined,
        arv: editForm.arv ? parseFloat(editForm.arv) : undefined,
        rehab_budget: editForm.rehab_budget ? parseFloat(editForm.rehab_budget) : undefined,
        expected_profit: editForm.expected_profit ? parseFloat(editForm.expected_profit) : undefined,
      }

      const { error: dealError } = await updateDeal(deal.id, dealUpdates as Partial<Deal>)
      if (dealError) throw dealError

      // Update property fields if property exists
      if (deal.property?.id) {
        const propertyUpdates: Partial<Property> = {
          bedrooms: editForm.bedrooms ? parseInt(editForm.bedrooms) : undefined,
          bathrooms: editForm.bathrooms ? parseFloat(editForm.bathrooms) : undefined,
          sqft: editForm.sqft ? parseInt(editForm.sqft) : undefined,
          year_built: editForm.year_built ? parseInt(editForm.year_built) : undefined,
        }

        const { error: propError } = await updateProperty(deal.property.id, propertyUpdates)
        if (propError) throw propError
      }

      // Refresh data to get updated values
      await fetchData()
      setIsEditing(false)
      Alert.alert('Saved', 'Property details updated successfully.')
    } catch (err: any) {
      Alert.alert('Error', `Failed to save: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [deal, editForm, fetchData])

  const handleCancelEdit = useCallback(() => {
    if (!deal) return

    // Reset form to current values
    setEditForm({
      name: deal.name || '',
      notes: deal.notes || '',
      purchase_price: deal.purchase_price?.toString() || '',
      arv: deal.arv?.toString() || '',
      rehab_budget: deal.rehab_budget?.toString() || '',
      expected_profit: deal.expected_profit?.toString() || '',
      bedrooms: deal.property?.bedrooms?.toString() || '',
      bathrooms: deal.property?.bathrooms?.toString() || '',
      sqft: deal.property?.sqft?.toString() || '',
      year_built: deal.property?.year_built?.toString() || '',
    })
    setIsEditing(false)
  }, [deal])

  const handleStageChange = useCallback(async (newStage: DealStage) => {
    if (!deal) return

    Alert.alert(
      'Update Stage',
      `Move this deal to "${DEAL_STAGE_CONFIG[newStage]?.label || newStage}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            const { error: updateError } = await updateDealStage(deal.id, newStage)
            if (updateError) {
              Alert.alert('Error', 'Failed to update stage')
            } else {
              setDeal({ ...deal, stage: newStage })
            }
          },
        },
      ]
    )
  }, [deal])

  // Toggle capability in portal form
  const toggleCapability = useCallback((key: string) => {
    setPortalForm((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(key)
        ? prev.capabilities.filter((c) => c !== key)
        : [...prev.capabilities, key],
    }))
  }, [])

  // Generate portal link
  const handleGeneratePortalLink = useCallback(async () => {
    if (!deal || !portalForm.stakeholderName.trim()) {
      Alert.alert('Required', 'Please enter a stakeholder name')
      return
    }

    setGeneratingLink(true)
    setGeneratedLink(null)

    try {
      // Build capabilities object
      const capabilities: Record<string, boolean> = {}
      PORTAL_CAPABILITIES.forEach((cap) => {
        capabilities[cap.key] = portalForm.capabilities.includes(cap.key)
      })

      // Calculate expiry date
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + portalForm.expiresInDays)

      // Call RPC to create portal token
      const { data, error: rpcError } = await supabase.rpc('create_portal_token', {
        p_deal_id: deal.id,
        p_stakeholder_name: portalForm.stakeholderName.trim(),
        p_stakeholder_type: portalForm.stakeholderType,
        p_capabilities: capabilities,
        p_expires_at: expiresAt.toISOString(),
      })

      if (rpcError) throw rpcError

      // Generate the portal URL
      // Use deep link or web URL based on platform
      const baseUrl = 'dealroom://portal' // Deep link for app
      const webUrl = `https://app.dealroom.io/portal/${data.token}`

      setGeneratedLink(webUrl)
    } catch (err: any) {
      console.error('Portal link error:', err)
      Alert.alert('Error', 'Failed to generate portal link. Please try again.')
    } finally {
      setGeneratingLink(false)
    }
  }, [deal, portalForm])

  // Share the generated link
  const handleShareLink = useCallback(async () => {
    if (!generatedLink) return

    try {
      await Share.share({
        message: `You've been invited to view a property on FlipMantis: ${generatedLink}`,
        url: generatedLink,
        title: 'FlipMantis Property Portal',
      })
    } catch (err) {
      console.error('Share error:', err)
    }
  }, [generatedLink])

  // Copy link - uses Share as fallback since expo-clipboard not installed
  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) return

    try {
      // Use Share to let the user copy the link
      await Share.share({
        message: generatedLink,
        title: 'Portal Link',
      })
    } catch (err) {
      // Show the link in an alert as ultimate fallback
      Alert.alert('Portal Link', generatedLink)
    }
  }, [generatedLink])

  // Enrich motivation data
  const handleEnrichMotivation = useCallback(async () => {
    if (!deal) return
    setEnrichingMotivation(true)
    try {
      // This will trigger the n8n workflow to enrich seller data
      console.log('Triggering motivation enrichment for deal:', deal.id)
      // After enrichment, the SellerMotivationCard will reload automatically
    } catch (err) {
      console.error('Error enriching motivation:', err)
    } finally {
      setEnrichingMotivation(false)
    }
  }, [deal])

  // Reset portal modal state
  const handleClosePortalModal = useCallback(() => {
    setShowPortalModal(false)
    setGeneratedLink(null)
    setPortalForm({
      stakeholderName: '',
      stakeholderType: 'investor',
      capabilities: ['view_overview', 'view_photos'],
      expiresInDays: 30,
    })
  }, [])

  // Extract property info
  const property = deal?.property
  const address = property?.address_line1 || deal?.name || 'Unnamed Property'
  const city = property?.city || ''
  const state = property?.state || ''
  const zip = property?.zip || ''
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ScreenContainer scrollable={false}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Loading property...</Text>
          </View>
        </ScreenContainer>
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <ScreenContainer>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="outline" onPress={() => router.back()}>
              Go Back
            </Button>
          </View>
        </ScreenContainer>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: address.length > 20 ? address.substring(0, 17) + '...' : address,
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          >
            {/* Property Header */}
            <Card style={styles.headerCard} padding="lg">
              <View style={styles.headerRow}>
                <View style={styles.headerInfo}>
                  {isEditing ? (
                    <TextInput
                      style={styles.addressInput}
                      value={editForm.name}
                      onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                      placeholder="Property name"
                      placeholderTextColor={colors.slate[400]}
                    />
                  ) : (
                    <Text style={styles.propertyAddress}>{address}</Text>
                  )}
                  <Text style={styles.propertyCity}>{cityStateZip}</Text>
                </View>
                {deal && <StageBadge stage={deal.stage} />}
              </View>

              {/* Property Meta */}
              <View style={styles.propertyMeta}>
                {isEditing ? (
                  <>
                    <View style={styles.metaItem}>
                      <TextInput
                        style={styles.metaInput}
                        value={editForm.bedrooms}
                        onChangeText={(text) => setEditForm({ ...editForm, bedrooms: text })}
                        keyboardType="number-pad"
                        placeholder="-"
                        placeholderTextColor={colors.slate[400]}
                      />
                      <Text style={styles.metaLabel}>Beds</Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <TextInput
                        style={styles.metaInput}
                        value={editForm.bathrooms}
                        onChangeText={(text) => setEditForm({ ...editForm, bathrooms: text })}
                        keyboardType="decimal-pad"
                        placeholder="-"
                        placeholderTextColor={colors.slate[400]}
                      />
                      <Text style={styles.metaLabel}>Baths</Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <TextInput
                        style={styles.metaInput}
                        value={editForm.sqft}
                        onChangeText={(text) => setEditForm({ ...editForm, sqft: text })}
                        keyboardType="number-pad"
                        placeholder="-"
                        placeholderTextColor={colors.slate[400]}
                      />
                      <Text style={styles.metaLabel}>Sqft</Text>
                    </View>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <TextInput
                        style={styles.metaInput}
                        value={editForm.year_built}
                        onChangeText={(text) => setEditForm({ ...editForm, year_built: text })}
                        keyboardType="number-pad"
                        placeholder="-"
                        placeholderTextColor={colors.slate[400]}
                      />
                      <Text style={styles.metaLabel}>Built</Text>
                    </View>
                  </>
                ) : (
                  <>
                    {property?.bedrooms !== undefined && (
                      <>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaValue}>{property.bedrooms}</Text>
                          <Text style={styles.metaLabel}>Beds</Text>
                        </View>
                        <View style={styles.metaDivider} />
                      </>
                    )}
                    {property?.bathrooms !== undefined && (
                      <>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaValue}>{property.bathrooms}</Text>
                          <Text style={styles.metaLabel}>Baths</Text>
                        </View>
                        <View style={styles.metaDivider} />
                      </>
                    )}
                    {property?.sqft && (
                      <>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaValue}>{property.sqft.toLocaleString()}</Text>
                          <Text style={styles.metaLabel}>Sqft</Text>
                        </View>
                        <View style={styles.metaDivider} />
                      </>
                    )}
                    {property?.year_built && (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaValue}>{property.year_built}</Text>
                        <Text style={styles.metaLabel}>Built</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </Card>

            {/* Financial Info */}
            <Text style={styles.sectionTitle}>Financials</Text>
            <Card padding="md">
              {isEditing ? (
                <>
                  <EditableField
                    label="Purchase Price"
                    value={editForm.purchase_price}
                    onChangeText={(text) => setEditForm({ ...editForm, purchase_price: text })}
                    isEditing={true}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                  />
                  <EditableField
                    label="ARV"
                    value={editForm.arv}
                    onChangeText={(text) => setEditForm({ ...editForm, arv: text })}
                    isEditing={true}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                  />
                  <EditableField
                    label="Rehab Budget"
                    value={editForm.rehab_budget}
                    onChangeText={(text) => setEditForm({ ...editForm, rehab_budget: text })}
                    isEditing={true}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                  />
                  <EditableField
                    label="Expected Profit"
                    value={editForm.expected_profit}
                    onChangeText={(text) => setEditForm({ ...editForm, expected_profit: text })}
                    isEditing={true}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                  />
                </>
              ) : (
                <>
                  <View style={styles.underwritingRow}>
                    <Text style={styles.underwritingLabel}>Purchase Price</Text>
                    <Text style={styles.underwritingValue}>{formatCurrency(deal?.purchase_price)}</Text>
                  </View>
                  <View style={styles.underwritingRow}>
                    <Text style={styles.underwritingLabel}>ARV</Text>
                    <Text style={styles.underwritingValue}>{formatCurrency(deal?.arv)}</Text>
                  </View>
                  <View style={styles.underwritingRow}>
                    <Text style={styles.underwritingLabel}>Rehab Budget</Text>
                    <Text style={styles.underwritingValue}>{formatCurrency(deal?.rehab_budget)}</Text>
                  </View>
                  {deal?.expected_profit !== undefined && (
                    <View style={[styles.underwritingRow, styles.underwritingTotal]}>
                      <Text style={styles.underwritingLabelBold}>Expected Profit</Text>
                      <Text style={[
                        styles.underwritingValueProfit,
                        (deal.expected_profit || 0) < 0 && { color: colors.error[600] }
                      ]}>
                        {formatCurrency(deal.expected_profit)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </Card>

            {/* Underwriting Summary (if available) */}
            {underwriting && !isEditing && (
              <>
                <Text style={styles.sectionTitle}>Latest Underwriting</Text>
                <Card padding="md">
                  {underwriting.asking_price && (
                    <View style={styles.underwritingRow}>
                      <Text style={styles.underwritingLabel}>Asking Price</Text>
                      <Text style={styles.underwritingValue}>{formatCurrency(underwriting.asking_price)}</Text>
                    </View>
                  )}
                  {underwriting.offer_price && (
                    <View style={styles.underwritingRow}>
                      <Text style={styles.underwritingLabel}>Offer Price</Text>
                      <Text style={styles.underwritingValue}>{formatCurrency(underwriting.offer_price)}</Text>
                    </View>
                  )}
                  {underwriting.max_allowable_offer && (
                    <View style={styles.underwritingRow}>
                      <Text style={styles.underwritingLabel}>MAO</Text>
                      <Text style={styles.underwritingValue}>{formatCurrency(underwriting.max_allowable_offer)}</Text>
                    </View>
                  )}
                  {underwriting.roi_percent !== undefined && (
                    <View style={styles.roiRow}>
                      <Text style={styles.roiLabel}>ROI: </Text>
                      <Text style={[
                        styles.roiValue,
                        underwriting.roi_percent < 15 && { color: colors.warning[600] },
                        underwriting.roi_percent < 0 && { color: colors.error[600] },
                      ]}>
                        {underwriting.roi_percent.toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </Card>
              </>
            )}

            {/* ATTOM Property Intelligence */}
            {!isEditing && (
              <>
                {/* Loading State */}
                {attomLoading && (
                  <Card padding="md" style={{ marginTop: spacing.md }}>
                    <View style={styles.attomLoadingRow}>
                      <ActivityIndicator size="small" color={colors.brand[500]} />
                      <Text style={styles.attomLoadingText}>Loading property intelligence...</Text>
                    </View>
                  </Card>
                )}

                {/* ATTOM Data Sections */}
                {attomData && (
                  <>
                    {/* Valuation Section */}
                    <ExpandableSection title="Valuation & Equity" icon="💰" defaultExpanded={true}>
                      {attomData.avm && (
                        <>
                          <View style={styles.avmHeader}>
                            <View>
                              <Text style={styles.avmLabel}>Automated Valuation</Text>
                              <Text style={styles.avmValue}>{formatCurrency(attomData.avm.value)}</Text>
                              <Text style={styles.avmRange}>
                                Range: {formatCurrency(attomData.avm.low)} - {formatCurrency(attomData.avm.high)}
                              </Text>
                            </View>
                            <ConfidenceBadge confidence={attomData.avm.confidence} />
                          </View>
                          <View style={styles.valuationGrid}>
                            <View style={styles.valuationItem}>
                              <Text style={styles.valuationItemLabel}>Est. Equity</Text>
                              <Text style={styles.valuationItemValue}>
                                {formatCurrency(attomData.estimatedEquity)}
                              </Text>
                            </View>
                            <View style={styles.valuationItem}>
                              <Text style={styles.valuationItemLabel}>LTV Ratio</Text>
                              <Text style={styles.valuationItemValue}>
                                {attomData.ltvRatio ? `${attomData.ltvRatio.toFixed(1)}%` : '-'}
                              </Text>
                            </View>
                            <View style={styles.valuationItem}>
                              <Text style={styles.valuationItemLabel}>Rental Value</Text>
                              <Text style={styles.valuationItemValue}>
                                {formatCurrency(attomData.rentalAvm)}/mo
                              </Text>
                            </View>
                            <View style={styles.valuationItem}>
                              <Text style={styles.valuationItemLabel}>Tax Assessed</Text>
                              <Text style={styles.valuationItemValue}>
                                {formatCurrency(attomData.taxAssessment)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </ExpandableSection>

                    {/* Owner Information */}
                    {attomData.owner && (
                      <ExpandableSection title="Owner Information" icon="👤" defaultExpanded={true}>
                        <DataRow label="Owner Name" value={attomData.owner.name} />
                        {attomData.owner.name2 && <DataRow label="Owner 2" value={attomData.owner.name2} />}
                        <DataRow label="Owner Type" value={attomData.owner.type} />
                        <View style={styles.ownerBadgeRow}>
                          <View style={[
                            styles.ownerStatusBadge,
                            { backgroundColor: attomData.owner.occupied ? colors.success[50] : colors.warning[50] }
                          ]}>
                            <Text style={[
                              styles.ownerStatusText,
                              { color: attomData.owner.occupied ? colors.success[600] : colors.warning[600] }
                            ]}>
                              {attomData.owner.occupied ? 'Owner Occupied' : 'Non-Owner Occupied'}
                            </Text>
                          </View>
                          {attomData.owner.absentee && (
                            <View style={[styles.ownerStatusBadge, { backgroundColor: colors.brand[50] }]}>
                              <Text style={[styles.ownerStatusText, { color: colors.brand[600] }]}>
                                Absentee Owner
                              </Text>
                            </View>
                          )}
                        </View>
                        {attomData.owner.mailingAddress && (
                          <>
                            <Text style={styles.subsectionTitle}>Mailing Address</Text>
                            <DataRow label="Address" value={attomData.owner.mailingAddress} />
                            <DataRow
                              label="City/State"
                              value={[attomData.owner.mailingCity, attomData.owner.mailingState, attomData.owner.mailingZip]
                                .filter(Boolean)
                                .join(', ')}
                            />
                          </>
                        )}
                      </ExpandableSection>
                    )}

                    {/* Foreclosure/Distress */}
                    {attomData.foreclosure && attomData.foreclosure.status !== 'none' && (
                      <ExpandableSection title="Distress Signals" icon="⚠️" defaultExpanded={true}>
                        <View style={styles.distressHeader}>
                          <ForeclosureBadge status={attomData.foreclosure.status} />
                        </View>
                        <DataRow label="Recording Date" value={attomData.foreclosure.recordingDate} />
                        <DataRow label="Default Amount" value={formatCurrency(attomData.foreclosure.defaultAmount)} />
                        <DataRow label="Auction Date" value={attomData.foreclosure.auctionDate} />
                        <DataRow label="Auction Location" value={attomData.foreclosure.auctionLocation} />
                        <DataRow label="Trustee" value={attomData.foreclosure.trusteeName} />
                        <DataRow label="Lender" value={attomData.foreclosure.lenderName} />
                        {attomData.foreclosure.isLisPendens && (
                          <View style={styles.distressFlag}>
                            <Text style={styles.distressFlagText}>⚠️ Lis Pendens Filed</Text>
                          </View>
                        )}
                        {attomData.foreclosure.isNoticeOfDefault && (
                          <View style={styles.distressFlag}>
                            <Text style={styles.distressFlagText}>⚠️ Notice of Default</Text>
                          </View>
                        )}
                        {attomData.foreclosure.isNoticeOfSale && (
                          <View style={styles.distressFlag}>
                            <Text style={styles.distressFlagText}>⚠️ Notice of Sale</Text>
                          </View>
                        )}
                      </ExpandableSection>
                    )}

                    {/* Last Sale */}
                    {attomData.lastSale && (
                      <ExpandableSection title="Last Sale" icon="🏷️">
                        <DataRow label="Sale Date" value={attomData.lastSale.date} />
                        <DataRow label="Sale Price" value={formatCurrency(attomData.lastSale.price)} />
                        <DataRow label="Price/Sqft" value={formatCurrency(attomData.lastSale.pricePerSqft)} />
                        <DataRow label="Transaction Type" value={attomData.lastSale.transactionType} />
                        <DataRow label="Buyer" value={attomData.lastSale.buyerName} />
                        <DataRow label="Seller" value={attomData.lastSale.sellerName} />
                        <DataRow label="Mortgage Amount" value={formatCurrency(attomData.lastSale.mortgageAmount)} />
                        <DataRow label="Lender" value={attomData.lastSale.lenderName} />
                      </ExpandableSection>
                    )}

                    {/* Construction Details */}
                    {attomData.construction && (
                      <ExpandableSection title="Construction Details" icon="🔨">
                        <DataRow label="Foundation" value={attomData.construction.foundationType} />
                        <DataRow label="Roof Type" value={attomData.construction.roofType} />
                        <DataRow label="Roof Cover" value={attomData.construction.roofCover} />
                        <DataRow label="Exterior Walls" value={attomData.construction.wallType} />
                        <DataRow label="Heating" value={attomData.construction.heatingType} />
                        <DataRow label="Cooling" value={attomData.construction.coolingType} />
                        <DataRow label="Fireplaces" value={attomData.construction.fireplaceCount} />
                        <DataRow label="Basement" value={attomData.construction.basementType} />
                        <DataRow label="Garage Type" value={attomData.construction.garageType} />
                        <DataRow label="Garage Spaces" value={attomData.construction.garageSpaces} />
                        <DataRow label="Parking Spaces" value={attomData.construction.parkingSpaces} />
                        <DataRow label="Pool" value={attomData.construction.pool ? 'Yes' : 'No'} />
                        <DataRow label="Quality" value={attomData.construction.quality} />
                        <DataRow label="Condition" value={attomData.construction.condition} />
                      </ExpandableSection>
                    )}

                    {/* Tax Information */}
                    {attomData.tax && (
                      <ExpandableSection title="Tax Information" icon="📋">
                        <DataRow label="Tax Year" value={attomData.tax.taxYear} />
                        <DataRow label="Annual Tax" value={formatCurrency(attomData.tax.taxAmount)} />
                        <DataRow label="Assessed Value" value={formatCurrency(attomData.tax.assessedValue)} />
                        <DataRow label="Land Value" value={formatCurrency(attomData.tax.assessedLandValue)} />
                        <DataRow label="Improvement Value" value={formatCurrency(attomData.tax.assessedImprovementValue)} />
                        <DataRow label="Market Value" value={formatCurrency(attomData.tax.marketValue)} />
                        {attomData.tax.isDelinquent && (
                          <View style={styles.distressFlag}>
                            <Text style={styles.distressFlagText}>⚠️ Tax Delinquent: {formatCurrency(attomData.tax.delinquentAmount)}</Text>
                          </View>
                        )}
                      </ExpandableSection>
                    )}

                    {/* Mortgages */}
                    {attomData.mortgages && attomData.mortgages.length > 0 && (
                      <ExpandableSection title={`Mortgages (${attomData.mortgages.length})`} icon="🏦">
                        {attomData.mortgages.map((mortgage, idx) => (
                          <View key={idx} style={styles.mortgageItem}>
                            <Text style={styles.mortgagePosition}>
                              {mortgage.position === 1 ? '1st' : mortgage.position === 2 ? '2nd' : `${mortgage.position}th`} Lien
                            </Text>
                            <DataRow label="Original Amount" value={formatCurrency(mortgage.originalAmount)} />
                            <DataRow label="Est. Balance" value={formatCurrency(mortgage.estimatedBalance)} />
                            <DataRow label="Loan Type" value={mortgage.loanType} />
                            <DataRow label="Interest Rate" value={mortgage.interestRate ? `${mortgage.interestRate}%` : undefined} />
                            <DataRow label="Rate Type" value={mortgage.interestRateType} />
                            <DataRow label="Lender" value={mortgage.lenderName} />
                            <DataRow label="Originated" value={mortgage.originationDate} />
                            <DataRow label="Maturity" value={mortgage.maturityDate} />
                          </View>
                        ))}
                      </ExpandableSection>
                    )}

                    {/* Nearby Schools */}
                    {attomData.schools && attomData.schools.length > 0 && (
                      <ExpandableSection title={`Nearby Schools (${attomData.schools.length})`} icon="🏫">
                        {attomData.schools.slice(0, 5).map((school, idx) => (
                          <View key={idx} style={styles.schoolItem}>
                            <View style={styles.schoolHeader}>
                              <Text style={styles.schoolName}>{school.schoolName}</Text>
                              {school.rating && (
                                <View style={styles.schoolRating}>
                                  <Text style={styles.schoolRatingText}>{school.rating}/10</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.schoolType}>
                              {school.schoolType} • {school.distance.toFixed(1)} mi
                            </Text>
                            {school.gradeRange && (
                              <Text style={styles.schoolGrades}>Grades: {school.gradeRange}</Text>
                            )}
                          </View>
                        ))}
                      </ExpandableSection>
                    )}

                    {/* Sales History */}
                    {attomData.salesHistory && attomData.salesHistory.length > 1 && (
                      <ExpandableSection title={`Sales History (${attomData.salesHistory.length})`} icon="📜">
                        {attomData.salesHistory.map((sale, idx) => (
                          <View key={idx} style={styles.saleHistoryItem}>
                            <View style={styles.saleHistoryHeader}>
                              <Text style={styles.saleHistoryPrice}>{formatCurrency(sale.price)}</Text>
                              <Text style={styles.saleHistoryDate}>{sale.date}</Text>
                            </View>
                            {sale.transactionType && (
                              <Text style={styles.saleHistoryType}>{sale.transactionType}</Text>
                            )}
                          </View>
                        ))}
                      </ExpandableSection>
                    )}

                    {/* Property Identifiers */}
                    <ExpandableSection title="Property Identifiers" icon="🔑">
                      <DataRow label="Property ID" value={attomData.attomId} />
                      <DataRow label="APN" value={attomData.apn} />
                      <DataRow label="FIPS" value={attomData.fips} />
                      <DataRow label="County" value={attomData.county} />
                      <DataRow label="Lat/Long" value={`${attomData.latitude?.toFixed(5)}, ${attomData.longitude?.toFixed(5)}`} />
                    </ExpandableSection>
                  </>
                )}

                {/* ATTOM Error */}
                {attomError && !attomLoading && (
                  <Card padding="md" style={{ marginTop: spacing.md }}>
                    <View style={styles.attomErrorRow}>
                      <Text style={styles.attomErrorText}>⚠️ {attomError}</Text>
                      <TouchableOpacity onPress={() => deal?.property && fetchAttomData(deal.property)}>
                        <Text style={styles.attomRetryText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                )}
              </>
            )}

            {/* Notes */}
            <Text style={styles.sectionTitle}>Notes</Text>
            <Card padding="md">
              {isEditing ? (
                <TextInput
                  style={styles.notesInput}
                  value={editForm.notes}
                  onChangeText={(text) => setEditForm({ ...editForm, notes: text })}
                  placeholder="Add notes about this property..."
                  placeholderTextColor={colors.slate[400]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : deal?.notes ? (
                <Text style={styles.notesText}>{deal.notes}</Text>
              ) : (
                <Text style={styles.notesPlaceholder}>No notes yet</Text>
              )}
            </Card>

            {/* Save Button (when editing) */}
            {isEditing && (
              <Button
                variant="primary"
                onPress={handleSave}
                disabled={saving}
                style={styles.saveButton}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}

            {/* Seller Motivation Score */}
            {!isEditing && deal && (
              <>
                <Text style={styles.sectionTitle}>Seller Intelligence</Text>
                <SellerMotivationCard
                  dealId={deal.id}
                  attomId={attomData?.attomId}
                  onEnrich={handleEnrichMotivation}
                  enriching={enrichingMotivation}
                />
              </>
            )}

            {/* Deal Outcome Logger (for completed deals) */}
            {!isEditing && deal && ['closing', 'closed', 'sold', 'lost'].includes(deal.stage) && (
              <>
                <Text style={styles.sectionTitle}>Deal Memory</Text>
                <OutcomeLogger
                  dealId={deal.id}
                  dealName={deal.name}
                  initialPredictions={{
                    arv: deal.arv,
                    rehabCost: deal.rehab_budget,
                    profit: deal.expected_profit,
                  }}
                />
              </>
            )}

            {/* Quick Actions */}
            {!isEditing && (
              <>
                <Text style={styles.sectionTitle}>Actions</Text>
                <View style={styles.actionsRow}>
                  <Link href={`/evaluation/new?dealId=${deal?.id}`} asChild>
                    <Button variant="primary" style={styles.actionButton}>
                      Start Evaluation
                    </Button>
                  </Link>
                  <Link href={`/property/costs/${deal?.id}`} asChild>
                    <Button variant="outline" style={styles.actionButton}>
                      View Costs
                    </Button>
                  </Link>
                </View>
                <View style={[styles.actionsRow, { marginTop: spacing.sm }]}>
                  <Button
                    variant="outline"
                    style={styles.actionButton}
                    onPress={() => setShowPortalModal(true)}
                  >
                    Share Portal
                  </Button>
                  <Button
                    variant="outline"
                    style={[styles.actionButton, styles.passButton]}
                    onPress={() => setShowPassModal(true)}
                  >
                    Pass on Deal
                  </Button>
                </View>
              </>
            )}

            {/* Market Intelligence Navigation */}
            {!isEditing && attomData && (
              <>
                <Text style={styles.sectionTitle}>Market Intelligence</Text>
                <View style={styles.actionsRow}>
                  <Link
                    href={{
                      pathname: '/property/comps',
                      params: { attomId: attomData.attomId, address: attomData.address },
                    }}
                    asChild
                  >
                    <Button variant="outline" style={styles.actionButton}>
                      📊 View Comps
                    </Button>
                  </Link>
                  <Link
                    href={{
                      pathname: '/property/trends',
                      params: { zip: attomData.zip || property?.zip },
                    }}
                    asChild
                  >
                    <Button variant="outline" style={styles.actionButton}>
                      📈 Market Trends
                    </Button>
                  </Link>
                </View>
              </>
            )}

            {/* Stage Change */}
            {deal && !isEditing && (
              <>
                <Text style={styles.sectionTitle}>Move to Stage</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageScrollView}>
                  <View style={styles.stageRow}>
                    {(['lead', 'researching', 'evaluating', 'analyzing', 'offer_pending', 'under_contract', 'closing'] as DealStage[]).map((stage) => {
                      const config = DEAL_STAGE_CONFIG[stage]
                      const isActive = deal.stage === stage
                      return (
                        <Button
                          key={stage}
                          variant={isActive ? 'primary' : 'outline'}
                          size="sm"
                          onPress={() => !isActive && handleStageChange(stage)}
                          style={[styles.stageButton, isActive && { backgroundColor: config.color }]}
                        >
                          {config.label}
                        </Button>
                      )
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Activity Timeline */}
            {!isEditing && (
              <>
                <Text style={styles.sectionTitle}>Activity</Text>
                <Card padding="md">
                  {activities.length > 0 ? (
                    activities.slice(0, 5).map((event) => (
                      <ActivityItem key={event.id} event={event} />
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>📋</Text>
                      <Text style={styles.emptyStateText}>No activity yet</Text>
                      <Text style={styles.emptyStateSubtext}>
                        Activity will appear here as you work on this deal
                      </Text>
                    </View>
                  )}
                </Card>
              </>
            )}

            {/* Debug Info */}
            <Text style={styles.debugText}>Deal ID: {assetId}</Text>
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>

      {/* Portal Sharing Modal */}
      <Modal
        visible={showPortalModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePortalModal}
      >
        <View style={styles.portalModalContainer}>
          <View style={styles.portalModalHeader}>
            <Text style={styles.portalModalTitle}>Share Portal</Text>
            <TouchableOpacity onPress={handleClosePortalModal}>
              <Text style={styles.portalModalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.portalModalContent}>
            {!generatedLink ? (
              <>
                {/* Stakeholder Name */}
                <Text style={styles.portalLabel}>Stakeholder Name *</Text>
                <TextInput
                  style={styles.portalInput}
                  placeholder="Enter name..."
                  value={portalForm.stakeholderName}
                  onChangeText={(text) => setPortalForm((p) => ({ ...p, stakeholderName: text }))}
                />

                {/* Stakeholder Type */}
                <Text style={styles.portalLabel}>Stakeholder Type</Text>
                <View style={styles.portalTypeRow}>
                  {STAKEHOLDER_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.portalTypeButton,
                        portalForm.stakeholderType === type.key && styles.portalTypeButtonActive,
                      ]}
                      onPress={() => setPortalForm((p) => ({ ...p, stakeholderType: type.key }))}
                    >
                      <Text style={styles.portalTypeIcon}>{type.icon}</Text>
                      <Text
                        style={[
                          styles.portalTypeLabel,
                          portalForm.stakeholderType === type.key && styles.portalTypeLabelActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Capabilities */}
                <Text style={styles.portalLabel}>Permissions</Text>
                {PORTAL_CAPABILITIES.map((cap) => (
                  <TouchableOpacity
                    key={cap.key}
                    style={styles.portalCapRow}
                    onPress={() => toggleCapability(cap.key)}
                  >
                    <View style={styles.portalCapInfo}>
                      <Text style={styles.portalCapLabel}>{cap.label}</Text>
                      <Text style={styles.portalCapDesc}>{cap.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.portalCapCheck,
                        portalForm.capabilities.includes(cap.key) && styles.portalCapCheckActive,
                      ]}
                    >
                      {portalForm.capabilities.includes(cap.key) && (
                        <Text style={styles.portalCapCheckIcon}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Expiry */}
                <Text style={styles.portalLabel}>Link Expires In</Text>
                <View style={styles.portalExpiryRow}>
                  {[7, 30, 90].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.portalExpiryButton,
                        portalForm.expiresInDays === days && styles.portalExpiryButtonActive,
                      ]}
                      onPress={() => setPortalForm((p) => ({ ...p, expiresInDays: days }))}
                    >
                      <Text
                        style={[
                          styles.portalExpiryLabel,
                          portalForm.expiresInDays === days && styles.portalExpiryLabelActive,
                        ]}
                      >
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Generate Button */}
                <Button
                  variant="primary"
                  style={styles.portalGenerateButton}
                  onPress={handleGeneratePortalLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    'Generate Portal Link'
                  )}
                </Button>
              </>
            ) : (
              /* Link Generated */
              <View style={styles.portalLinkGenerated}>
                <Text style={styles.portalLinkIcon}>✅</Text>
                <Text style={styles.portalLinkTitle}>Link Generated!</Text>
                <Text style={styles.portalLinkDesc}>
                  Share this link with {portalForm.stakeholderName}
                </Text>

                <View style={styles.portalLinkBox}>
                  <Text style={styles.portalLinkText} numberOfLines={2}>
                    {generatedLink}
                  </Text>
                </View>

                <View style={styles.portalLinkActions}>
                  <Button variant="primary" style={styles.portalLinkButton} onPress={handleShareLink}>
                    Share Link
                  </Button>
                </View>

                <TouchableOpacity
                  style={styles.portalNewLink}
                  onPress={() => setGeneratedLink(null)}
                >
                  <Text style={styles.portalNewLinkText}>Generate Another Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Pass Deal Modal */}
      {deal && (
        <PassDealModal
          visible={showPassModal}
          onClose={() => setShowPassModal(false)}
          onPassed={() => {
            // Optionally navigate away or update UI
            Alert.alert('Deal Passed', 'This deal has been moved to the passed pile.')
          }}
          dealId={deal.id}
          attomId={attomData?.attomId}
          address={address}
          city={city}
          state={state}
          zipCode={zip}
          askingPrice={deal.purchase_price}
          maxOffer={underwriting?.max_allowable_offer}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold,
  },
  propertyAddress: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  addressInput: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand[500],
    paddingVertical: spacing.xs,
  },
  propertyCity: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  metaInput: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.brand[500],
    minWidth: 40,
    paddingVertical: spacing.xs,
  },
  metaLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.slate[200],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  editableField: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  editableLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  editableValue: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  editableInput: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.slate[50],
  },
  underwritingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  underwritingTotal: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  underwritingLabel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  underwritingLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  underwritingValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  underwritingValueProfit: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  roiRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  roiLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  roiValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  notesInput: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.sm,
    padding: spacing.sm,
    backgroundColor: colors.slate[50],
    minHeight: 100,
  },
  notesText: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    lineHeight: 22,
  },
  notesPlaceholder: {
    fontSize: typography.fontSize.base,
    color: colors.slate[400],
    fontStyle: 'italic',
  },
  saveButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  passButton: {
    borderColor: colors.error[200],
  },
  stageScrollView: {
    marginBottom: spacing.md,
  },
  stageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  stageButton: {
    minWidth: 100,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  activityIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  activityDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginTop: 2,
  },
  activityTime: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: 'center',
  },
  debugText: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    fontSize: typography.fontSize.xs,
    color: colors.slate[300],
    textAlign: 'center',
  },

  // Portal Modal Styles
  portalModalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  portalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  portalModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  portalModalClose: {
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  portalModalContent: {
    flex: 1,
    padding: spacing.md,
  },
  portalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  portalInput: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  portalTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  portalTypeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    minWidth: 80,
  },
  portalTypeButtonActive: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  portalTypeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  portalTypeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  portalTypeLabelActive: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  portalCapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  portalCapInfo: {
    flex: 1,
  },
  portalCapLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  portalCapDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  portalCapCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalCapCheckActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  portalCapCheckIcon: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },
  portalExpiryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  portalExpiryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  portalExpiryButtonActive: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  portalExpiryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  portalExpiryLabelActive: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  portalGenerateButton: {
    marginTop: spacing.xl,
  },
  portalLinkGenerated: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  portalLinkIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  portalLinkTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  portalLinkDesc: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    marginBottom: spacing.lg,
  },
  portalLinkBox: {
    width: '100%',
    padding: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  portalLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  portalLinkActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  portalLinkButton: {
    flex: 1,
    minWidth: 120,
  },
  portalNewLink: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  portalNewLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Expandable Section Styles
  expandableSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  expandableIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  expandableTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  expandableArrow: {
    fontSize: 12,
    color: colors.slate[400],
  },
  expandableContent: {
    padding: spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },

  // Data Row Styles
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[50],
  },
  dataLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    flex: 1,
  },
  dataValue: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },

  // Confidence Badge
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  confidenceBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Foreclosure Badge
  foreclosureBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  foreclosureBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // AVM Header
  avmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avmLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  avmValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[700],
  },
  avmRange: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },

  // Valuation Grid
  valuationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  valuationItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.slate[50],
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  valuationItemLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  valuationItemValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },

  // Owner Badge Row
  ownerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  ownerStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  ownerStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },

  // Subsection Title
  subsectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Distress Styles
  distressHeader: {
    marginBottom: spacing.md,
  },
  distressFlag: {
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  distressFlagText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Mortgage Item
  mortgageItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  mortgagePosition: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
    marginBottom: spacing.xs,
  },

  // School Item
  schoolItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    flex: 1,
  },
  schoolRating: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  schoolRatingText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  schoolType: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  schoolGrades: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },

  // Sale History Item
  saleHistoryItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  saleHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleHistoryPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  saleHistoryDate: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  saleHistoryType: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },

  // ATTOM Loading/Error
  attomLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attomLoadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  attomErrorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attomErrorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  attomRetryText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
})
