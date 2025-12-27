/**
 * New Deal Screen
 *
 * Deal Creation Hub - presents 3 paths to create a deal:
 * 1. Search & Create - lookup property via ATTOM
 * 2. From Lead - convert a captured driving lead
 * 3. Manual Entry - quick create with minimal info
 */

import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native'
import { Stack, useRouter, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, Button } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { createDeal, getLeads } from '../../src/services'
import { useAuth } from '../../src/contexts/AuthContext'
import type { DealStage } from '../../src/types'

// Creation mode options
type CreationMode = 'select' | 'manual' | 'leads'

// Lead type for display
interface LeadItem {
  id: string
  address?: string
  lat: number
  lng: number
  tags: string[]
  priority: string
  notes?: string
  created_at: string
}

// Strategy options
const STRATEGY_OPTIONS = [
  { key: 'flip', label: 'Flip', icon: '🔨' },
  { key: 'brrrr', label: 'BRRRR', icon: '🏠' },
  { key: 'wholesale', label: 'Wholesale', icon: '💰' },
  { key: 'buy_hold', label: 'Buy & Hold', icon: '📈' },
  { key: 'unknown', label: 'Not Sure Yet', icon: '❓' },
]

// Lead Card Component
function LeadCard({
  lead,
  onConvert,
  converting,
}: {
  lead: LeadItem
  onConvert: (lead: LeadItem) => void
  converting: boolean
}) {
  const displayAddress = lead.address || `${lead.lat.toFixed(5)}, ${lead.lng.toFixed(5)}`
  const createdDate = new Date(lead.created_at).toLocaleDateString()
  const priorityColors: Record<string, string> = {
    hot: colors.error[500],
    high: colors.warning[500],
    normal: colors.slate[500],
    low: colors.slate[300],
  }

  return (
    <Card style={styles.leadCard} padding="md">
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <Text style={styles.leadAddress} numberOfLines={1}>
            {displayAddress}
          </Text>
          <Text style={styles.leadDate}>Captured {createdDate}</Text>
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
            <Text style={styles.moreTagsText}>+{lead.tags.length - 4} more</Text>
          )}
        </View>
      )}

      {/* Notes */}
      {lead.notes && (
        <Text style={styles.leadNotes} numberOfLines={2}>
          {lead.notes}
        </Text>
      )}

      {/* Convert Button */}
      <Button
        variant="primary"
        size="sm"
        onPress={() => onConvert(lead)}
        disabled={converting}
        style={{ marginTop: spacing.sm }}
      >
        {converting ? 'Converting...' : 'Convert to Deal →'}
      </Button>
    </Card>
  )
}

export default function NewDealScreen() {
  const router = useRouter()
  const { user, tenantId } = useAuth()

  const [mode, setMode] = useState<CreationMode>('select')

  // Manual entry state
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [notes, setNotes] = useState('')
  const [strategy, setStrategy] = useState<string>('unknown')
  const [creating, setCreating] = useState(false)

  // Leads state
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null)

  // Load leads when switching to leads mode
  useEffect(() => {
    if (mode === 'leads') {
      loadLeads()
    }
  }, [mode])

  const loadLeads = async () => {
    setLoadingLeads(true)
    try {
      const { data, error } = await getLeads({ status: 'active', limit: 50 })
      if (error) {
        console.error('Error loading leads:', error)
      } else if (data) {
        setLeads(data)
      }
    } catch (err) {
      console.error('Failed to load leads:', err)
    } finally {
      setLoadingLeads(false)
    }
  }

  // Handle manual deal creation
  const handleCreateManual = useCallback(async () => {
    if (!address.trim()) {
      Alert.alert('Required', 'Please enter at least a street address')
      return
    }

    Keyboard.dismiss()
    setCreating(true)

    try {
      const dealName = [address.trim(), city.trim(), state.trim()].filter(Boolean).join(', ')

      const { data: deal, error } = await createDeal({
        name: dealName,
        stage: 'lead' as DealStage,
        source: 'manual',
        address_line1: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        notes: notes.trim() || undefined,
        strategy: strategy !== 'unknown' ? strategy : undefined,
      })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      if (deal) {
        router.replace(`/property/${deal.id}`)
      }
    } catch (err) {
      console.error('Create deal error:', err)
      Alert.alert('Error', 'Failed to create deal')
    } finally {
      setCreating(false)
    }
  }, [address, city, state, zip, notes, strategy, router])

  // Handle lead conversion
  const handleConvertLead = useCallback(
    async (lead: LeadItem) => {
      setConvertingLeadId(lead.id)

      try {
        const dealName =
          lead.address || `Lead ${lead.lat.toFixed(4)}, ${lead.lng.toFixed(4)}`

        const { data: deal, error } = await createDeal({
          name: dealName,
          stage: 'lead' as DealStage,
          source: 'driving',
          address_line1: lead.address || undefined,
          lat: lead.lat,
          lng: lead.lng,
          notes: lead.notes || undefined,
          tags: lead.tags,
          lead_id: lead.id, // Link to original lead
        })

        if (error) {
          Alert.alert('Error', error.message)
          return
        }

        if (deal) {
          router.replace(`/property/${deal.id}`)
        }
      } catch (err) {
        console.error('Convert lead error:', err)
        Alert.alert('Error', 'Failed to convert lead')
      } finally {
        setConvertingLeadId(null)
      }
    },
    [router]
  )

  // Mode selection screen
  if (mode === 'select') {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'New Deal',
            headerShown: true,
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={styles.selectContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Create a New Deal</Text>
            <Text style={styles.pageSubtitle}>Choose how you want to add this deal</Text>

            {/* Option 1: Search Property */}
            <TouchableOpacity
              style={styles.optionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/search')}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.brand[50] }]}>
                <Text style={styles.optionIconText}>🔍</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Search & Create</Text>
                <Text style={styles.optionDesc}>
                  Look up any U.S. property to get valuation, owner info, and create a deal
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            {/* Option 2: From Leads */}
            <TouchableOpacity
              style={styles.optionCard}
              activeOpacity={0.7}
              onPress={() => setMode('leads')}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.warning[50] }]}>
                <Text style={styles.optionIconText}>📍</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>From Driving Lead</Text>
                <Text style={styles.optionDesc}>
                  Convert a captured lead from your driving sessions
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            {/* Option 3: Manual Entry */}
            <TouchableOpacity
              style={styles.optionCard}
              activeOpacity={0.7}
              onPress={() => setMode('manual')}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.success[50] }]}>
                <Text style={styles.optionIconText}>✏️</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Manual Entry</Text>
                <Text style={styles.optionDesc}>
                  Quickly add a deal with just an address - no ATTOM lookup required
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            {/* Quick tip */}
            <View style={styles.tipContainer}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>
                Tip: Use "Search & Create" for full property intel, or "Manual Entry" when
                you just need to quickly log a deal.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }

  // Manual entry mode
  if (mode === 'manual') {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Quick Add Deal',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => setMode('select')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formTitle}>Quick Add Deal</Text>
            <Text style={styles.formSubtitle}>
              Enter the property address to create a deal. You can enrich with ATTOM data
              later.
            </Text>

            {/* Address */}
            <Text style={styles.inputLabel}>
              Street Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="123 Main Street"
              placeholderTextColor={colors.slate[400]}
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {/* City/State/Zip */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Chicago"
                  placeholderTextColor={colors.slate[400]}
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.formColSmall}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="IL"
                  placeholderTextColor={colors.slate[400]}
                  value={state}
                  onChangeText={setState}
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
              <View style={styles.formColSmall}>
                <Text style={styles.inputLabel}>ZIP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="60601"
                  placeholderTextColor={colors.slate[400]}
                  value={zip}
                  onChangeText={setZip}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Strategy */}
            <Text style={styles.inputLabel}>Investment Strategy</Text>
            <View style={styles.strategyGrid}>
              {STRATEGY_OPTIONS.map((opt) => {
                const isSelected = strategy === opt.key
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.strategyOption, isSelected && styles.strategyOptionActive]}
                    onPress={() => setStrategy(opt.key)}
                  >
                    <Text style={styles.strategyIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.strategyLabel,
                        isSelected && styles.strategyLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Notes */}
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Any quick observations..."
              placeholderTextColor={colors.slate[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Create Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleCreateManual}
              disabled={creating || !address.trim()}
              style={{ marginTop: spacing.lg }}
            >
              {creating ? 'Creating Deal...' : 'Create Deal'}
            </Button>

            <Text style={styles.footnote}>
              * Deal will be created in "Lead" stage. You can update stage and run analysis
              later.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }

  // Leads selection mode
  if (mode === 'leads') {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Convert Lead',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => setMode('select')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={styles.leadsContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formTitle}>Convert a Lead</Text>
            <Text style={styles.formSubtitle}>
              Select a lead from your driving sessions to convert into a deal
            </Text>

            {loadingLeads ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brand[500]} />
                <Text style={styles.loadingText}>Loading leads...</Text>
              </View>
            ) : leads.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📍</Text>
                <Text style={styles.emptyStateTitle}>No Leads Yet</Text>
                <Text style={styles.emptyStateText}>
                  Start a driving session to capture leads, or use "Search & Create" to
                  find properties.
                </Text>
                <Link href="/driving" asChild>
                  <Button variant="primary" style={{ marginTop: spacing.md }}>
                    🚗 Start Driving
                  </Button>
                </Link>
              </View>
            ) : (
              <>
                <Text style={styles.leadsCount}>{leads.length} lead(s) available</Text>
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onConvert={handleConvertLead}
                    converting={convertingLeadId === lead.id}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  selectContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  pageSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    marginBottom: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionIconText: {
    fontSize: 24,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    lineHeight: 20,
  },
  optionArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.slate[400],
    marginLeft: spacing.sm,
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: colors.brand[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  tipIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.brand[700],
    lineHeight: 20,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.brand[600],
    fontSize: typography.fontSize.base,
  },
  formContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  formTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  required: {
    color: colors.error[500],
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
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
  strategyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  strategyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  strategyOptionActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  strategyIcon: {
    fontSize: 14,
  },
  strategyLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  strategyLabelActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  footnote: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    textAlign: 'center',
    marginTop: spacing.md,
  },
  leadsContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  leadsCount: {
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
  leadDate: {
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
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
})
