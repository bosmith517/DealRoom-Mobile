/**
 * OutcomeRecorder Component
 *
 * Modal to record the outcome of a reach action (call/text/email).
 * Transitions the lead's reach_status based on the outcome.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'
import { supabase } from '../lib/supabase'
import { offlineService } from '../services/offline'
import { useOffline } from '../contexts/OfflineContext'

// ============================================================================
// Types
// ============================================================================

export type InteractionOutcome =
  | 'no_answer'
  | 'voicemail'
  | 'answered'
  | 'wrong_number'
  | 'interested'
  | 'not_interested'
  | 'callback_scheduled'
  | 'deal_created'

interface OutcomeOption {
  key: InteractionOutcome
  label: string
  icon: keyof typeof Ionicons.glyphMap
  description: string
  nextStatus?: 'contacted' | 'nurturing' | 'dead' | 'converted'
  color: string
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    key: 'no_answer',
    label: 'No Answer',
    icon: 'call-outline',
    description: 'No one picked up',
    nextStatus: 'contacted',
    color: colors.slate[500],
  },
  {
    key: 'voicemail',
    label: 'Left Voicemail',
    icon: 'mic-outline',
    description: 'Left a message',
    nextStatus: 'contacted',
    color: colors.slate[600],
  },
  {
    key: 'answered',
    label: 'Answered',
    icon: 'checkmark-circle-outline',
    description: 'Spoke with someone',
    nextStatus: 'contacted',
    color: colors.success[500],
  },
  {
    key: 'wrong_number',
    label: 'Wrong Number',
    icon: 'close-circle-outline',
    description: 'Not the right person',
    nextStatus: 'dead',
    color: colors.error[500],
  },
  {
    key: 'interested',
    label: 'Interested',
    icon: 'star-outline',
    description: 'Wants to hear more',
    nextStatus: 'nurturing',
    color: colors.warning[500],
  },
  {
    key: 'not_interested',
    label: 'Not Interested',
    icon: 'thumbs-down-outline',
    description: 'Declined to sell',
    nextStatus: 'dead',
    color: colors.error[500],
  },
  {
    key: 'callback_scheduled',
    label: 'Callback Set',
    icon: 'calendar-outline',
    description: 'Will call back later',
    nextStatus: 'nurturing',
    color: colors.brand[500],
  },
  {
    key: 'deal_created',
    label: 'Deal Created!',
    icon: 'trophy-outline',
    description: 'Moving to pipeline',
    nextStatus: 'converted',
    color: colors.success[600],
  },
]

interface OutcomeRecorderProps {
  visible: boolean
  leadId: string
  interactionId?: string
  interactionType: 'call' | 'text' | 'email'
  contactInfo?: string // phone or email used
  onClose: () => void
  onRecorded: (outcome: InteractionOutcome, nextStatus: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function OutcomeRecorder({
  visible,
  leadId,
  interactionId,
  interactionType,
  contactInfo,
  onClose,
  onRecorded,
}: OutcomeRecorderProps) {
  const { isOnline } = useOffline()
  const [selectedOutcome, setSelectedOutcome] = useState<InteractionOutcome | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!selectedOutcome) return

    setSaving(true)
    try {
      const outcomeOption = OUTCOME_OPTIONS.find(o => o.key === selectedOutcome)
      const nextStatus = outcomeOption?.nextStatus || 'contacted'

      if (isOnline) {
        // Online: Update directly via Supabase
        // Update the interaction record with outcome
        if (interactionId) {
          await supabase
            .from('dealroom_lead_interactions')
            .update({
              outcome: selectedOutcome,
              notes: notes || null,
              ended_at: new Date().toISOString(),
            })
            .eq('id', interactionId)
        }

        // Transition lead status if needed (not if staying at 'contacted')
        if (nextStatus !== 'contacted') {
          const { error } = await supabase.rpc('transition_lead_reach_status', {
            p_lead_id: leadId,
            p_new_status: nextStatus,
            p_source: 'mobile',
            p_metadata: {
              outcome: selectedOutcome,
              interaction_type: interactionType,
              notes: notes || undefined,
            },
          })

          if (error) {
            console.warn('Status transition failed:', error.message)
            // Non-fatal - interaction is recorded
          }
        }
      } else {
        // Offline: Queue mutations for later sync
        // Note: We can't update an existing interaction if we don't have DB access
        // The interaction was likely created offline too, so this outcome update
        // will be processed along with the original creation when back online

        // Queue status transition if needed
        if (nextStatus !== 'contacted') {
          offlineService.addPendingMutation('reach_transition', {
            leadId,
            newStatus: nextStatus,
            source: 'mobile',
            metadata: {
              outcome: selectedOutcome,
              interaction_type: interactionType,
              notes: notes || undefined,
              offline: true,
            },
          })
        }

        // Queue a note to capture the outcome details
        if (notes) {
          offlineService.addPendingMutation('note_create', {
            leadId,
            content: `[${interactionType.toUpperCase()} Outcome: ${selectedOutcome}] ${notes}`,
            isPinned: false,
          })
        }
      }

      onRecorded(selectedOutcome, nextStatus)

      // Reset state
      setSelectedOutcome(null)
      setNotes('')
    } catch (err) {
      console.error('Error recording outcome:', err)
    } finally {
      setSaving(false)
    }
  }, [selectedOutcome, notes, leadId, interactionId, interactionType, onRecorded, isOnline])

  const handleSkip = useCallback(() => {
    setSelectedOutcome(null)
    setNotes('')
    onClose()
  }, [onClose])

  const getInteractionLabel = () => {
    switch (interactionType) {
      case 'call': return 'Call'
      case 'text': return 'Text'
      case 'email': return 'Email'
      default: return 'Contact'
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.slate[600]} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Record Outcome</Text>
            <Text style={styles.subtitle}>
              {getInteractionLabel()} {contactInfo ? `to ${contactInfo}` : ''}
            </Text>
          </View>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Outcome Options */}
          <Text style={styles.sectionTitle}>What happened?</Text>
          <View style={styles.optionsGrid}>
            {OUTCOME_OPTIONS.map((option) => {
              const isSelected = selectedOutcome === option.key
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionCard,
                    isSelected && { borderColor: option.color, backgroundColor: `${option.color}10` },
                  ]}
                  onPress={() => setSelectedOutcome(option.key)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                    <Ionicons name={option.icon} size={24} color={option.color} />
                  </View>
                  <Text style={[styles.optionLabel, isSelected && { color: option.color }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: option.color }]}>
                      <Ionicons name="checkmark" size={12} color={colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Notes */}
          {selectedOutcome && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any notes about this conversation..."
                placeholderTextColor={colors.slate[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!selectedOutcome || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!selectedOutcome || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save Outcome</Text>
                <Ionicons name="checkmark" size={18} color={colors.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.slate[200],
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: 2,
  },
  checkmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    marginTop: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    minHeight: 80,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    gap: spacing.sm,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.slate[100],
  },
  skipButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.brand[500],
    gap: spacing.xs,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
})

export default OutcomeRecorder
