/**
 * ReachWorkflow Component
 *
 * First-class state machine UI for lead enrichment and outreach.
 * Shows: Action row (Enrich | Skip Trace | Reach) + Readiness checklist + Contact actions
 *
 * State flow:
 * new → intel_pending → intel_ready → skiptrace_pending → outreach_ready → contacted
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'
import { supabase } from '../lib/supabase'
import { skipTraceService, type SkipTraceResult } from '../services'
import { offlineService } from '../services/offline'
import { useOffline } from '../contexts/OfflineContext'
import { OutcomeRecorder, type InteractionOutcome } from './OutcomeRecorder'

// ============================================================================
// Types
// ============================================================================

type ReachStatus =
  | 'new'
  | 'intel_pending'
  | 'intel_ready'
  | 'intel_failed'
  | 'skiptrace_pending'
  | 'skiptrace_ready'
  | 'skiptrace_failed'
  | 'outreach_ready'
  | 'contacted'
  | 'nurturing'
  | 'dead'
  | 'converted'

interface LeadReachData {
  id: string
  reach_status: ReachStatus
  intel_last_error?: string
  skiptrace_last_error?: string
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  avm_value?: number
  equity_estimate?: number
  is_absentee?: boolean
}

interface ReachWorkflowProps {
  leadId: string
  onStatusChange?: (newStatus: ReachStatus) => void
  onSkipTraceComplete?: (result: SkipTraceResult) => void
}

// ============================================================================
// Component
// ============================================================================

export function ReachWorkflow({
  leadId,
  onStatusChange,
  onSkipTraceComplete,
}: ReachWorkflowProps) {
  const { isOnline } = useOffline()
  const [lead, setLead] = useState<LeadReachData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [skipTracing, setSkipTracing] = useState(false)
  const [skipTraceResult, setSkipTraceResult] = useState<SkipTraceResult | null>(null)

  // Outcome recorder state
  const [showOutcomeRecorder, setShowOutcomeRecorder] = useState(false)
  const [currentInteractionId, setCurrentInteractionId] = useState<string | null>(null)
  const [currentInteractionType, setCurrentInteractionType] = useState<'call' | 'text' | 'email'>('call')
  const [currentContactInfo, setCurrentContactInfo] = useState<string | undefined>(undefined)

  // Fetch lead reach status
  const fetchLeadStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dealroom_leads')
        .select(`
          id,
          reach_status,
          intel_last_error,
          skiptrace_last_error,
          owner_name,
          owner_phone,
          owner_email,
          avm_value,
          equity_estimate,
          is_absentee
        `)
        .eq('id', leadId)
        .single()

      if (error) {
        console.error('Error fetching lead:', error)
        return
      }

      setLead({
        ...data,
        reach_status: data.reach_status || 'new',
      })

      // If skip traced, fetch results
      if (['skiptrace_ready', 'outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(data.reach_status || '')) {
        const result = await skipTraceService.getSkipTraceResults(leadId)
        if (result) {
          setSkipTraceResult(result)
        }
      }
    } catch (err) {
      console.error('Error fetching lead status:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLeadStatus()
  }, [fetchLeadStatus])

  // Handle Enrich (ATTOM) button
  const handleEnrich = useCallback(async () => {
    if (!lead || enriching) return

    // Can only enrich from 'new' or 'intel_failed'
    if (!['new', 'intel_failed'].includes(lead.reach_status)) {
      Alert.alert('Already Enriched', 'This lead has already been enriched with property data.')
      return
    }

    setEnriching(true)
    try {
      const { data: jobId, error } = await supabase.rpc('request_intel_enrichment', {
        p_lead_id: leadId,
        p_source: 'mobile',
      })

      if (error) {
        Alert.alert('Enrichment Failed', error.message)
        return
      }

      // Update local state
      setLead(prev => prev ? { ...prev, reach_status: 'intel_pending' } : null)
      onStatusChange?.('intel_pending')

      Alert.alert('Enrichment Started', 'Property data is being fetched. This may take a moment.')

      // Poll for completion
      pollEnrichmentStatus()
    } catch (err) {
      Alert.alert('Error', 'Failed to start enrichment')
    } finally {
      setEnriching(false)
    }
  }, [lead, leadId, enriching, onStatusChange])

  // Poll for enrichment completion
  const pollEnrichmentStatus = useCallback(async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))

      const { data } = await supabase
        .from('dealroom_leads')
        .select('reach_status, intel_last_error, owner_name, avm_value')
        .eq('id', leadId)
        .single()

      if (data?.reach_status === 'intel_ready') {
        setLead(prev => prev ? { ...prev, ...data, reach_status: 'intel_ready' } : null)
        onStatusChange?.('intel_ready')
        return
      }

      if (data?.reach_status === 'intel_failed') {
        setLead(prev => prev ? { ...prev, ...data, reach_status: 'intel_failed' } : null)
        Alert.alert('Enrichment Failed', data.intel_last_error || 'Unknown error')
        return
      }
    }
  }, [leadId, onStatusChange])

  // Handle Skip Trace button
  const handleSkipTrace = useCallback(async () => {
    if (!lead || skipTracing) return

    // Can only skip trace from 'intel_ready'
    if (lead.reach_status !== 'intel_ready') {
      if (['new', 'intel_pending'].includes(lead.reach_status)) {
        Alert.alert('Enrichment Required', 'Please wait for property enrichment to complete before running skip trace.')
      } else if (lead.reach_status === 'intel_failed') {
        Alert.alert('Enrichment Failed', 'Please retry property enrichment before running skip trace.')
      } else {
        Alert.alert('Already Skip Traced', 'This lead has already been skip traced.')
      }
      return
    }

    setSkipTracing(true)
    try {
      // Use atomic RPC to prevent double-charging
      const { success, jobId, error } = await skipTraceService.requestSkipTraceAtomic(leadId)

      if (!success) {
        Alert.alert('Skip Trace Failed', error || 'Unknown error')
        return
      }

      // Update local state
      setLead(prev => prev ? { ...prev, reach_status: 'skiptrace_pending' } : null)
      onStatusChange?.('skiptrace_pending')

      // Poll for completion
      const pollResult = await skipTraceService.pollSkipTraceJob(leadId)

      if (pollResult.completed && pollResult.result) {
        setSkipTraceResult(pollResult.result)
        onSkipTraceComplete?.(pollResult.result)

        const newStatus = pollResult.result.phoneNumbers.length > 0 || pollResult.result.emailAddresses.length > 0
          ? 'outreach_ready'
          : 'skiptrace_ready'

        setLead(prev => prev ? {
          ...prev,
          reach_status: newStatus,
          owner_phone: pollResult.result!.phoneNumbers[0]?.phone,
          owner_email: pollResult.result!.emailAddresses[0]?.email,
        } : null)
        onStatusChange?.(newStatus)

        if (pollResult.result.isLitigator) {
          Alert.alert(
            'Litigator Warning',
            `This owner is flagged as a potential litigator (score: ${pollResult.result.litigatorScore || 'N/A'}). Proceed with caution.`,
            [{ text: 'Understood', style: 'destructive' }]
          )
        }
      } else if (pollResult.error) {
        setLead(prev => prev ? { ...prev, reach_status: 'skiptrace_failed' } : null)
        Alert.alert('Skip Trace Failed', pollResult.error)
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to run skip trace')
    } finally {
      setSkipTracing(false)
    }
  }, [lead, leadId, skipTracing, onStatusChange, onSkipTraceComplete])

  // Handle reach action (call, text, email)
  const handleReachAction = useCallback(async (type: 'call' | 'text' | 'email') => {
    if (!lead) return

    const phone = lead.owner_phone || skipTraceResult?.phoneNumbers[0]?.phone
    const email = lead.owner_email || skipTraceResult?.emailAddresses[0]?.email

    if (type === 'call' || type === 'text') {
      if (!phone) {
        Alert.alert('No Phone Number', 'No phone number available for this owner.')
        return
      }
    } else if (type === 'email') {
      if (!email) {
        Alert.alert('No Email', 'No email address available for this owner.')
        return
      }
    }

    try {
      let interactionId: string | null = null

      if (isOnline) {
        // Online: Record interaction via RPC
        const { data, error } = await supabase.rpc('record_reach_interaction', {
          p_lead_id: leadId,
          p_interaction_type: type,
          p_direction: 'outbound',
          p_contact_phone: type !== 'email' ? phone : null,
          p_contact_email: type === 'email' ? email : null,
        })

        if (error) {
          console.warn('Failed to record interaction:', error)
        } else {
          interactionId = data
        }
      } else {
        // Offline: Queue interaction for later sync
        interactionId = offlineService.addPendingMutation('reach_interaction', {
          leadId,
          interactionType: type,
          direction: 'outbound',
          contactPhone: type !== 'email' ? phone : null,
          contactEmail: type === 'email' ? email : null,
        })

        // Also queue status transition if first contact
        if (lead.reach_status === 'outreach_ready') {
          offlineService.addPendingMutation('reach_transition', {
            leadId,
            newStatus: 'contacted',
            source: 'mobile',
            metadata: { first_contact_type: type, offline: true },
          })
        }
      }

      // Store interaction info for outcome recorder
      setCurrentInteractionId(interactionId)
      setCurrentInteractionType(type)
      setCurrentContactInfo(type === 'email' ? email : phone)

      // If first contact, update local state
      if (lead.reach_status === 'outreach_ready') {
        setLead(prev => prev ? { ...prev, reach_status: 'contacted' } : null)
        onStatusChange?.('contacted')
      }

      // Open native action
      let url: string
      switch (type) {
        case 'call':
          url = `tel:${phone}`
          break
        case 'text':
          url = `sms:${phone}`
          break
        case 'email':
          url = `mailto:${email}`
          break
      }

      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
        // Show outcome recorder after action
        // Small delay to ensure native app opens first
        setTimeout(() => {
          setShowOutcomeRecorder(true)
        }, 1000)
      } else {
        Alert.alert('Cannot Open', `Unable to open ${type} app.`)
      }
    } catch (err) {
      console.error('Reach action error:', err)
    }
  }, [lead, leadId, skipTraceResult, onStatusChange, isOnline])

  // Handle outcome recorded from OutcomeRecorder
  const handleOutcomeRecorded = useCallback((outcome: InteractionOutcome, nextStatus: string) => {
    setShowOutcomeRecorder(false)
    setCurrentInteractionId(null)

    // Update local state with new status
    if (nextStatus && nextStatus !== lead?.reach_status) {
      setLead(prev => prev ? { ...prev, reach_status: nextStatus as ReachStatus } : null)
      onStatusChange?.(nextStatus as ReachStatus)
    }
  }, [lead?.reach_status, onStatusChange])

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.brand[500]} />
        <Text style={styles.loadingText}>Loading reach status...</Text>
      </View>
    )
  }

  if (!lead) {
    return null
  }

  const status = lead.reach_status

  // Determine button states
  const isEnrichEnabled = ['new', 'intel_failed'].includes(status)
  const isEnrichPending = status === 'intel_pending'
  const isEnrichDone = ['intel_ready', 'skiptrace_pending', 'skiptrace_ready', 'skiptrace_failed', 'outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(status)

  const isSkipTraceEnabled = status === 'intel_ready'
  const isSkipTracePending = status === 'skiptrace_pending'
  const isSkipTraceDone = ['skiptrace_ready', 'outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(status)

  const isReachEnabled = ['outreach_ready', 'contacted', 'nurturing'].includes(status)

  const phone = lead.owner_phone || skipTraceResult?.phoneNumbers[0]?.phone
  const email = lead.owner_email || skipTraceResult?.emailAddresses[0]?.email

  return (
    <View style={styles.container}>
      {/* Action Row */}
      <View style={styles.actionRow}>
        {/* Enrich Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isEnrichDone && styles.actionButtonDone,
            (!isEnrichEnabled && !isEnrichPending && !isEnrichDone) && styles.actionButtonDisabled,
          ]}
          onPress={handleEnrich}
          disabled={!isEnrichEnabled || enriching || isEnrichPending}
        >
          {isEnrichPending || enriching ? (
            <ActivityIndicator size="small" color={colors.brand[500]} />
          ) : isEnrichDone ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
          ) : (
            <Ionicons name="home-outline" size={24} color={isEnrichEnabled ? colors.brand[500] : colors.slate[400]} />
          )}
          <Text style={[styles.actionButtonText, isEnrichDone && styles.actionButtonTextDone]}>
            {isEnrichPending ? 'Enriching...' : isEnrichDone ? 'Enriched' : 'Enrich'}
          </Text>
        </TouchableOpacity>

        {/* Skip Trace Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isSkipTraceDone && styles.actionButtonDone,
            (!isSkipTraceEnabled && !isSkipTracePending && !isSkipTraceDone) && styles.actionButtonDisabled,
          ]}
          onPress={handleSkipTrace}
          disabled={!isSkipTraceEnabled || skipTracing || isSkipTracePending}
        >
          {isSkipTracePending || skipTracing ? (
            <ActivityIndicator size="small" color={colors.brand[500]} />
          ) : isSkipTraceDone ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
          ) : (
            <Ionicons name="person-circle-outline" size={24} color={isSkipTraceEnabled ? colors.brand[500] : colors.slate[400]} />
          )}
          <Text style={[styles.actionButtonText, isSkipTraceDone && styles.actionButtonTextDone]}>
            {isSkipTracePending ? 'Tracing...' : isSkipTraceDone ? 'Traced' : 'Skip Trace'}
          </Text>
        </TouchableOpacity>

        {/* Reach Button - Opens contact options */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            status === 'contacted' && styles.actionButtonDone,
            !isReachEnabled && styles.actionButtonDisabled,
          ]}
          disabled={!isReachEnabled}
          onPress={() => {
            if (!isReachEnabled) return
            // Show action sheet for reach options
            Alert.alert(
              'Contact Owner',
              lead.owner_name || 'Property Owner',
              [
                phone ? { text: `Call ${phone}`, onPress: () => handleReachAction('call') } : null,
                phone ? { text: `Text ${phone}`, onPress: () => handleReachAction('text') } : null,
                email ? { text: `Email ${email}`, onPress: () => handleReachAction('email') } : null,
                { text: 'Cancel', style: 'cancel' },
              ].filter(Boolean) as any
            )
          }}
        >
          <Ionicons
            name={status === 'contacted' ? 'chatbubbles' : 'call-outline'}
            size={24}
            color={isReachEnabled ? colors.brand[500] : colors.slate[400]}
          />
          <Text style={[styles.actionButtonText, status === 'contacted' && styles.actionButtonTextDone]}>
            {status === 'contacted' ? 'Contacted' : 'Reach'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Readiness Checklist */}
      <View style={styles.checklistContainer}>
        <Text style={styles.checklistTitle}>Readiness</Text>

        {/* Property Intel */}
        <View style={styles.checklistItem}>
          {isEnrichDone ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
          ) : isEnrichPending ? (
            <ActivityIndicator size="small" color={colors.warning[500]} />
          ) : status === 'intel_failed' ? (
            <Ionicons name="alert-circle" size={20} color={colors.error[500]} />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color={colors.slate[400]} />
          )}
          <View style={styles.checklistItemContent}>
            <Text style={styles.checklistItemLabel}>Property Intel</Text>
            <Text style={styles.checklistItemValue}>
              {isEnrichDone
                ? lead.avm_value ? `AVM: $${lead.avm_value.toLocaleString()}` : 'Enriched'
                : isEnrichPending ? 'Fetching...'
                : status === 'intel_failed' ? lead.intel_last_error || 'Failed'
                : 'Not started'}
            </Text>
          </View>
        </View>

        {/* Owner Identified */}
        <View style={styles.checklistItem}>
          {lead.owner_name ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
          ) : isEnrichDone ? (
            <Ionicons name="alert-circle" size={20} color={colors.warning[500]} />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color={colors.slate[400]} />
          )}
          <View style={styles.checklistItemContent}>
            <Text style={styles.checklistItemLabel}>Owner Identified</Text>
            <Text style={styles.checklistItemValue}>
              {lead.owner_name
                ? `${lead.owner_name}${lead.is_absentee ? ' (Absentee)' : ''}`
                : isEnrichDone ? 'Unknown'
                : 'Waiting for enrichment'}
            </Text>
          </View>
        </View>

        {/* Skip Trace */}
        <View style={styles.checklistItem}>
          {isSkipTraceDone ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
          ) : isSkipTracePending ? (
            <ActivityIndicator size="small" color={colors.warning[500]} />
          ) : status === 'skiptrace_failed' ? (
            <Ionicons name="alert-circle" size={20} color={colors.error[500]} />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color={colors.slate[400]} />
          )}
          <View style={styles.checklistItemContent}>
            <Text style={styles.checklistItemLabel}>Skip Trace</Text>
            <Text style={styles.checklistItemValue}>
              {isSkipTraceDone
                ? `${skipTraceResult?.phoneNumbers.length || 0} phones, ${skipTraceResult?.emailAddresses.length || 0} emails`
                : isSkipTracePending ? 'Running...'
                : status === 'skiptrace_failed' ? lead.skiptrace_last_error || 'Failed'
                : isEnrichDone ? 'Ready to run'
                : 'Waiting for enrichment'}
            </Text>
          </View>
        </View>

        {/* Reach Ready */}
        <View style={styles.checklistItem}>
          {isReachEnabled || ['contacted', 'nurturing', 'converted'].includes(status) ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color={colors.slate[400]} />
          )}
          <View style={styles.checklistItemContent}>
            <Text style={styles.checklistItemLabel}>Reach Ready</Text>
            <Text style={styles.checklistItemValue}>
              {isReachEnabled || ['contacted', 'nurturing', 'converted'].includes(status)
                ? phone || email ? 'Contact info available' : 'No contact info'
                : 'Waiting for skip trace'}
            </Text>
          </View>
        </View>
      </View>

      {/* Owner Contact Card (if available) */}
      {isReachEnabled && (phone || email) && (
        <View style={styles.contactCard}>
          <View style={styles.contactCardHeader}>
            <Text style={styles.contactCardTitle}>Owner Contact</Text>
            <View style={styles.contactCardBadge}>
              <Text style={styles.contactCardBadgeText}>OWNER</Text>
            </View>
          </View>

          {lead.owner_name && (
            <Text style={styles.contactName}>{lead.owner_name}</Text>
          )}

          {phone && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleReachAction('call')}>
              <Ionicons name="call" size={18} color={colors.brand[500]} />
              <Text style={styles.contactValue}>{phone}</Text>
              <View style={styles.contactActions}>
                <TouchableOpacity onPress={() => handleReachAction('call')} style={styles.contactActionBtn}>
                  <Ionicons name="call" size={16} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReachAction('text')} style={styles.contactActionBtn}>
                  <Ionicons name="chatbubble" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}

          {email && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleReachAction('email')}>
              <Ionicons name="mail" size={18} color={colors.brand[500]} />
              <Text style={styles.contactValue}>{email}</Text>
              <TouchableOpacity onPress={() => handleReachAction('email')} style={styles.contactActionBtn}>
                <Ionicons name="mail" size={16} color={colors.white} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          <Text style={styles.contactDisclaimer}>
            This is the property OWNER, not current occupant. Property may be tenant-occupied or vacant.
          </Text>
        </View>
      )}

      {/* Outcome Recorder Modal */}
      <OutcomeRecorder
        visible={showOutcomeRecorder}
        leadId={leadId}
        interactionId={currentInteractionId || undefined}
        interactionType={currentInteractionType}
        contactInfo={currentContactInfo}
        onClose={() => setShowOutcomeRecorder(false)}
        onRecorded={handleOutcomeRecorded}
      />
    </View>
  )
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    color: colors.slate[600],
    fontSize: typography.fontSize.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    gap: spacing.xs,
  },
  actionButtonDone: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  actionButtonTextDone: {
    color: colors.success[700],
  },
  checklistContainer: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  checklistTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  checklistItemContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  checklistItemLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  checklistItemValue: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand[200],
    gap: spacing.sm,
  },
  contactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  contactCardBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  contactCardBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[700],
  },
  contactName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  contactValue: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contactActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDisclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    fontStyle: 'italic',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
})

export default ReachWorkflow
