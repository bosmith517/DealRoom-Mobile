/**
 * Lead Detail Screen
 *
 * View and edit a single lead from driving capture.
 * Options: Convert to Deal, Edit, Archive
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, Button, SkipTraceButton, SkipTraceResults, ReachWorkflow, ActivityTimeline, AIScoreCard, SellerMotivationCard } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { getLead, updateLead, createDeal, skipTraceService, n8nService, type SkipTraceResult } from '../../src/services'
import type { Lead, DealStage } from '../../src/types'

// Available tags
const AVAILABLE_TAGS = [
  { key: 'vacant', label: 'Vacant', icon: '🏚️' },
  { key: 'boarded', label: 'Boarded', icon: '🚫' },
  { key: 'overgrown', label: 'Overgrown', icon: '🌿' },
  { key: 'mail_pileup', label: 'Mail Piling', icon: '📬' },
  { key: 'for_rent', label: 'For Rent', icon: '🏠' },
  { key: 'fsbo', label: 'FSBO', icon: '💰' },
  { key: 'code_violation', label: 'Code Violation', icon: '⚠️' },
  { key: 'good_bones', label: 'Good Bones', icon: '🦴' },
  { key: 'to_analyze', label: 'To Analyze', icon: '📊' },
]

// Priority options
const PRIORITY_OPTIONS = [
  { key: 'low', label: 'Low', color: colors.slate[400] },
  { key: 'normal', label: 'Normal', color: colors.slate[500] },
  { key: 'high', label: 'High', color: colors.warning[500] },
  { key: 'hot', label: 'Hot! 🔥', color: colors.error[500] },
]

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skipTraceResult, setSkipTraceResult] = useState<SkipTraceResult | null>(null)
  const [loadingSkipTrace, setLoadingSkipTrace] = useState(false)

  // Editable fields
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [priority, setPriority] = useState<string>('normal')
  const [hasChanges, setHasChanges] = useState(false)

  const fetchLead = useCallback(async () => {
    if (!id) {
      setError('No lead ID provided')
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await getLead(id)
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      if (!data) {
        setError('Lead not found')
        return
      }

      setLead(data)
      setAddress(data.address || '')
      setNotes(data.notes || '')
      setTags(data.tags || [])
      setPriority(data.priority || 'normal')

      // Load skip trace results if available
      if (data.skip_trace_id || data.skip_traced_at) {
        setLoadingSkipTrace(true)
        try {
          const result = await skipTraceService.getSkipTraceResults(id)
          if (result) {
            setSkipTraceResult(result)
          }
        } catch (skipTraceErr) {
          console.log('No skip trace results:', skipTraceErr)
        } finally {
          setLoadingSkipTrace(false)
        }
      }
    } catch (err) {
      console.error('Error fetching lead:', err)
      setError('Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  // Track changes
  useEffect(() => {
    if (!lead) return
    const changed =
      address !== (lead.address || '') ||
      notes !== (lead.notes || '') ||
      priority !== (lead.priority || 'normal') ||
      JSON.stringify(tags.sort()) !== JSON.stringify((lead.tags || []).sort())
    setHasChanges(changed)
  }, [address, notes, tags, priority, lead])

  // Handle skip trace completion
  const handleSkipTraceComplete = useCallback((result: SkipTraceResult) => {
    setSkipTraceResult(result)
  }, [])

  // Toggle tag
  const toggleTag = (key: string) => {
    setTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    )
  }

  // Save changes
  const handleSave = useCallback(async () => {
    if (!lead) return

    setSaving(true)
    try {
      const { error: updateError } = await updateLead(lead.id, {
        address: address || undefined,
        notes: notes || undefined,
        tags,
        priority: priority as Lead['priority'],
      })

      if (updateError) {
        Alert.alert('Error', updateError.message)
        return
      }

      setHasChanges(false)
      Alert.alert('Saved!', 'Lead updated successfully')
    } catch (err) {
      console.error('Save error:', err)
      Alert.alert('Error', 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [lead, address, notes, tags, priority])

  // Convert to deal
  const handleConvert = useCallback(async () => {
    if (!lead) return

    setConverting(true)
    try {
      const dealName = address || `Lead ${lead.lat.toFixed(4)}, ${lead.lng.toFixed(4)}`

      const { data: deal, error: createError } = await createDeal({
        name: dealName,
        stage: 'lead' as DealStage,
        source: 'driving',
        address_line1: address || undefined,
        lat: lead.lat,
        lng: lead.lng,
        notes: notes || undefined,
        tags,
        lead_id: lead.id,
      })

      if (createError) {
        Alert.alert('Error', createError.message)
        return
      }

      if (deal) {
        Alert.alert('Success!', 'Lead converted to deal', [
          { text: 'View Deal', onPress: () => router.replace(`/property/${deal.id}`) },
        ])
      }
    } catch (err) {
      console.error('Convert error:', err)
      Alert.alert('Error', 'Failed to convert lead')
    } finally {
      setConverting(false)
    }
  }, [lead, address, notes, tags, router])

  // Archive lead
  const handleArchive = useCallback(async () => {
    if (!lead) return

    Alert.alert('Archive Lead?', 'This lead will be moved to your archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateLead(lead.id, { status: 'archived' })
            router.back()
          } catch (err) {
            console.error('Archive error:', err)
            Alert.alert('Error', 'Failed to archive lead')
          }
        },
      },
    ])
  }, [lead, router])

  // Trigger seller enrichment via n8n webhook
  const handleEnrich = useCallback(async () => {
    if (!lead) return

    setEnriching(true)
    try {
      const result = await n8nService.triggerSellerEnrichment({
        leadId: lead.id,
        propertyAddress: address || undefined,
      })

      if (result.success) {
        Alert.alert(
          'Enrichment Started',
          'Seller data enrichment has been triggered. The motivation score will update shortly.',
          [{ text: 'OK' }]
        )
      } else {
        Alert.alert('Enrichment Failed', result.error || 'Unable to trigger enrichment')
      }
    } catch (err) {
      console.error('Enrichment error:', err)
      Alert.alert('Error', 'Failed to trigger seller enrichment')
    } finally {
      setEnriching(false)
    }
  }, [lead, address])

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading lead...</Text>
        </View>
      </>
    )
  }

  // Error state
  if (error || !lead) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Lead not found'}</Text>
          <Button variant="outline" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: address || 'Lead Details',
          headerShown: true,
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Card */}
          {lead.photo_url ? (
            <View style={styles.photoCard}>
              <Image
                source={{ uri: lead.photo_url }}
                style={styles.leadPhoto}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>📷 No photo captured</Text>
            </View>
          )}

          {/* Location Card */}
          <Card padding="md" style={styles.locationCard}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            <Text style={styles.coordinates}>
              {lead.lat.toFixed(6)}, {lead.lng.toFixed(6)}
            </Text>
            <Text style={styles.capturedDate}>
              Captured {new Date(lead.created_at).toLocaleString()}
            </Text>
          </Card>

          {/* Skip Trace Results */}
          {loadingSkipTrace ? (
            <View style={styles.skipTraceLoading}>
              <ActivityIndicator size="small" color={colors.brand[500]} />
              <Text style={styles.skipTraceLoadingText}>Loading owner info...</Text>
            </View>
          ) : skipTraceResult ? (
            <>
              <Text style={styles.inputLabel}>Owner Information</Text>
              <SkipTraceResults result={skipTraceResult} />
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Find Owner</Text>
              <View style={styles.skipTraceButtonContainer}>
                <SkipTraceButton
                  leadId={lead.id}
                  onComplete={handleSkipTraceComplete}
                  variant="full"
                />
              </View>
            </>
          )}

          {/* Reach Workflow - State Machine UI */}
          <Text style={styles.inputLabel}>Reach Workflow</Text>
          <ReachWorkflow
            leadId={lead.id}
            onSkipTraceComplete={handleSkipTraceComplete}
          />

          {/* AI Score & Cost */}
          <Text style={styles.inputLabel}>AI Analysis</Text>
          <AIScoreCard leadId={lead.id} />

          {/* Seller Motivation Score from n8n enrichment */}
          <Text style={styles.inputLabel}>Seller Motivation</Text>
          <SellerMotivationCard
            leadId={lead.id}
            onEnrich={handleEnrich}
            enriching={enriching}
          />

          {/* Address */}
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter address..."
            placeholderTextColor={colors.slate[400]}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="words"
          />

          {/* Priority */}
          <Text style={styles.inputLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = priority === opt.key
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.priorityOption,
                    isSelected && { backgroundColor: opt.color, borderColor: opt.color },
                  ]}
                  onPress={() => setPriority(opt.key)}
                >
                  <Text style={[styles.priorityText, isSelected && styles.priorityTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Tags */}
          <Text style={styles.inputLabel}>Tags</Text>
          <View style={styles.tagsGrid}>
            {AVAILABLE_TAGS.map((tag) => {
              const isSelected = tags.includes(tag.key)
              return (
                <TouchableOpacity
                  key={tag.key}
                  style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                  onPress={() => toggleTag(tag.key)}
                >
                  <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                    {tag.icon} {tag.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Notes */}
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Add notes about this property..."
            placeholderTextColor={colors.slate[400]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Activity Timeline */}
          <Text style={styles.inputLabel}>Activity</Text>
          <ActivityTimeline leadId={lead.id} maxItems={10} showHeader={false} />

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Button
              variant="primary"
              size="lg"
              onPress={handleConvert}
              disabled={converting}
              style={styles.convertButton}
            >
              {converting ? 'Converting...' : '→ Convert to Deal'}
            </Button>
            <Button variant="outline" size="lg" onPress={handleArchive} style={styles.archiveButton}>
              🗑️ Archive
            </Button>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  photoCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  leadPhoto: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
  },
  photoPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  photoPlaceholderText: {
    color: colors.slate[400],
    fontSize: typography.fontSize.sm,
  },
  locationCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[200],
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[700],
    marginBottom: spacing.xs,
  },
  coordinates: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontFamily: 'monospace',
  },
  capturedDate: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[500],
    marginTop: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
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
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  priorityTextSelected: {
    color: colors.white,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  tagChipSelected: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  tagChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
  },
  tagChipTextSelected: {
    color: colors.white,
  },
  actionsContainer: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  convertButton: {
    width: '100%',
  },
  archiveButton: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.paper,
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
    backgroundColor: colors.paper,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: spacing.md,
  },
  saveButtonText: {
    color: colors.brand[600],
    fontWeight: typography.fontWeight.semibold,
  },
  skipTraceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  skipTraceLoadingText: {
    marginLeft: spacing.sm,
    color: colors.slate[600],
    fontSize: typography.fontSize.sm,
  },
  skipTraceCard: {
    marginBottom: spacing.md,
  },
  skipTraceButton: {
    marginBottom: spacing.md,
  },
  skipTraceButtonContainer: {
    marginBottom: spacing.md,
  },
})
