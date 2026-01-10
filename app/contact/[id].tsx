/**
 * Contact Detail Screen
 *
 * Full-screen view of a contact with:
 * - Header with avatar, name, type badge
 * - Action bar: Call, SMS, Email
 * - Phone numbers with Call/SMS buttons
 * - Email addresses
 * - Linked deals section
 * - Notes section
 * - Activity timeline
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
  Linking,
  TextInput,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, Button } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import {
  contactService,
  type Contact,
  type ContactPhone,
  type ContactEmail,
  type ContactDeal,
  type ContactTimelineEvent,
} from '../../src/services'

// Contact type labels
const CONTACT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  individual: { label: 'Individual', color: colors.slate[500] },
  lead_owner: { label: 'Property Owner', color: colors.brand[500] },
  agent: { label: 'Agent', color: colors.info[500] },
  contractor: { label: 'Contractor', color: colors.warning[500] },
  lender: { label: 'Lender', color: colors.success[500] },
  attorney: { label: 'Attorney', color: colors.error[500] },
  wholesaler: { label: 'Wholesaler', color: colors.brand[600] },
  title_company: { label: 'Title Company', color: colors.info[600] },
  other: { label: 'Other', color: colors.slate[400] },
}

// Engagement level colors
const ENGAGEMENT_COLORS: Record<string, string> = {
  hot: colors.error[500],
  warm: colors.warning[500],
  cold: colors.info[500],
  unknown: colors.slate[400],
}

// Phone type icons
const PHONE_TYPE_ICONS: Record<string, string> = {
  mobile: '📱',
  home: '🏠',
  work: '💼',
  fax: '📠',
  other: '📞',
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [contact, setContact] = useState<Contact | null>(null)
  const [phones, setPhones] = useState<ContactPhone[]>([])
  const [emails, setEmails] = useState<ContactEmail[]>([])
  const [deals, setDeals] = useState<ContactDeal[]>([])
  const [timeline, setTimeline] = useState<ContactTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)

  const fetchContact = useCallback(async () => {
    if (!id) {
      setError('No contact ID provided')
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await contactService.getContact(id)

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (!data) {
        setError('Contact not found')
        return
      }

      setContact(data)
      setNotes(data.notes || '')
      setPhones(data.phones || [])
      setEmails(data.emails || [])

      // Fetch deals and timeline
      const [dealsResult, timelineResult] = await Promise.all([
        contactService.getContactDeals(id),
        contactService.getContactTimeline(id, { limit: 20 }),
      ])

      if (dealsResult.data) setDeals(dealsResult.data)
      if (timelineResult.data) setTimeline(timelineResult.data)
    } catch (err) {
      console.error('[Contact] Error:', err)
      setError('Failed to load contact')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContact()
  }, [fetchContact])

  // Save notes
  const handleSaveNotes = async () => {
    if (!contact) return

    setSavingNotes(true)
    try {
      const { error: saveError } = await contactService.updateNotes(contact.id, notes)
      if (saveError) {
        Alert.alert('Error', 'Failed to save notes')
      } else {
        setEditingNotes(false)
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSavingNotes(false)
    }
  }

  // Handle phone call
  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '')
    Linking.openURL(`tel:${cleaned}`)
  }

  // Handle SMS
  const handleSMS = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '')
    Linking.openURL(`sms:${cleaned}`)
  }

  // Handle email
  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`)
  }

  // Log call outcome
  const handleLogCall = (phone: string) => {
    Alert.alert(
      'Log Call Outcome',
      `How did the call to ${phone} go?`,
      [
        { text: 'Connected', onPress: () => logCallOutcome(phone, 'connected') },
        { text: 'Voicemail', onPress: () => logCallOutcome(phone, 'voicemail') },
        { text: 'No Answer', onPress: () => logCallOutcome(phone, 'no_answer') },
        { text: 'Wrong Number', onPress: () => logCallOutcome(phone, 'wrong_number') },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const logCallOutcome = async (phone: string, outcome: string) => {
    if (!contact) return

    const { error: logError } = await contactService.logCall(contact.id, phone, outcome)
    if (logError) {
      Alert.alert('Error', 'Failed to log call')
    } else {
      // Refresh timeline
      const { data } = await contactService.getContactTimeline(contact.id, { limit: 20 })
      if (data) setTimeline(data)
    }
  }

  // Format date for timeline
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading contact...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !contact) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Contact not found'}</Text>
          <Button onPress={() => router.back()}>Go Back</Button>
        </View>
      </SafeAreaView>
    )
  }

  const typeConfig = CONTACT_TYPE_LABELS[contact.contact_type] || CONTACT_TYPE_LABELS.other
  const displayName = contact.display_name || contact.full_name || 'Unknown Contact'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              'Contact Options',
              undefined,
              [
                { text: 'Edit', onPress: () => {} },
                {
                  text: 'Mark Do Not Contact',
                  style: 'destructive',
                  onPress: () => {
                    Alert.prompt(
                      'Reason',
                      'Why should this contact not be contacted?',
                      async (reason) => {
                        if (reason) {
                          await contactService.markDoNotContact(contact.id, reason)
                          fetchContact()
                        }
                      }
                    )
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            )
          }}
        >
          <Text style={styles.menuIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Contact Card */}
        <View style={styles.contactCard}>
          <View style={[styles.avatar, { backgroundColor: typeConfig.color + '20' }]}>
            <Text style={[styles.avatarText, { color: typeConfig.color }]}>{initials}</Text>
          </View>
          <Text style={styles.contactName}>{displayName}</Text>
          {contact.primary_phone && (
            <Text style={styles.contactPhone}>{contact.primary_phone}</Text>
          )}

          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
            {contact.engagement_level && contact.engagement_level !== 'unknown' && (
              <View
                style={[
                  styles.engagementBadge,
                  { backgroundColor: ENGAGEMENT_COLORS[contact.engagement_level] + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.engagementText,
                    { color: ENGAGEMENT_COLORS[contact.engagement_level] },
                  ]}
                >
                  {contact.engagement_level.toUpperCase()}
                </Text>
              </View>
            )}
            {contact.is_dnc && (
              <View style={styles.dncBadge}>
                <Text style={styles.dncText}>DNC</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        {!contact.is_dnc && contact.primary_phone && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => handleCall(contact.primary_phone!)}
            >
              <Text style={styles.quickActionIcon}>📞</Text>
              <Text style={styles.quickActionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => handleSMS(contact.primary_phone!)}
            >
              <Text style={styles.quickActionIcon}>💬</Text>
              <Text style={styles.quickActionLabel}>Text</Text>
            </TouchableOpacity>
            {contact.primary_email && (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => handleEmail(contact.primary_email!)}
              >
                <Text style={styles.quickActionIcon}>✉️</Text>
                <Text style={styles.quickActionLabel}>Email</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => handleLogCall(contact.primary_phone!)}
            >
              <Text style={styles.quickActionIcon}>📝</Text>
              <Text style={styles.quickActionLabel}>Log Call</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phone Numbers */}
        {phones.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Phone Numbers</Text>
            {phones.map((phone) => (
              <View key={phone.id} style={styles.phoneRow}>
                <View style={styles.phoneInfo}>
                  <Text style={styles.phoneIcon}>
                    {PHONE_TYPE_ICONS[phone.phone_type] || '📞'}
                  </Text>
                  <View>
                    <Text style={styles.phoneNumber}>{phone.phone_number}</Text>
                    <Text style={styles.phoneType}>
                      {phone.phone_type}
                      {phone.is_primary && ' • Primary'}
                      {phone.can_sms && ' • SMS'}
                    </Text>
                  </View>
                </View>
                {!contact.is_dnc && (
                  <View style={styles.phoneActions}>
                    <TouchableOpacity
                      style={styles.phoneAction}
                      onPress={() => handleCall(phone.phone_number)}
                    >
                      <Text>📞</Text>
                    </TouchableOpacity>
                    {phone.can_sms && (
                      <TouchableOpacity
                        style={styles.phoneAction}
                        onPress={() => handleSMS(phone.phone_number)}
                      >
                        <Text>💬</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Email Addresses */}
        {emails.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Email Addresses</Text>
            {emails.map((email) => (
              <TouchableOpacity
                key={email.id}
                style={styles.emailRow}
                onPress={() => handleEmail(email.email)}
              >
                <View style={styles.emailInfo}>
                  <Text style={styles.emailIcon}>✉️</Text>
                  <View>
                    <Text style={styles.emailAddress}>{email.email}</Text>
                    <Text style={styles.emailType}>
                      {email.email_type}
                      {email.is_primary && ' • Primary'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.emailArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Linked Deals */}
        {deals.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Deals</Text>
            {deals.map((deal) => (
              <TouchableOpacity
                key={deal.id}
                style={styles.dealRow}
                onPress={() => router.push(`/property/${deal.deal_id}`)}
              >
                <View style={styles.dealInfo}>
                  <Text style={styles.dealAddress}>
                    {deal.deal?.property?.address_line1 || deal.deal?.name || 'Unknown Deal'}
                  </Text>
                  <Text style={styles.dealMeta}>
                    {deal.role} • {deal.deal?.stage || 'No stage'}
                  </Text>
                </View>
                <Text style={styles.dealArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Notes */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {!editingNotes ? (
              <TouchableOpacity onPress={() => setEditingNotes(true)}>
                <Text style={styles.editButton}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.notesActions}>
                <TouchableOpacity onPress={() => setEditingNotes(false)}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveNotes} disabled={savingNotes}>
                  <Text style={styles.saveButton}>{savingNotes ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {editingNotes ? (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Add notes about this contact..."
              placeholderTextColor={colors.slate[400]}
            />
          ) : (
            <Text style={notes ? styles.notesText : styles.notesPlaceholder}>
              {notes || 'No notes yet. Tap Edit to add notes.'}
            </Text>
          )}
        </Card>

        {/* Activity Timeline */}
        {timeline.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {timeline.map((event) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineSummary}>{event.summary}</Text>
                  <Text style={styles.timelineDate}>{formatDate(event.created_at)}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    backgroundColor: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.brand[500],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 24,
    color: colors.slate[500],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.slate[500],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[500],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  contactCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  contactName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  contactPhone: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  engagementBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  engagementText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  dncBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.error[100],
  },
  dncText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  quickAction: {
    alignItems: 'center',
    minWidth: 60,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  editButton: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.medium,
  },
  notesActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  saveButton: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  phoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phoneIcon: {
    fontSize: 20,
  },
  phoneNumber: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
  },
  phoneType: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  phoneActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phoneAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  emailIcon: {
    fontSize: 20,
  },
  emailAddress: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  emailType: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  emailArrow: {
    fontSize: 20,
    color: colors.slate[300],
  },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  dealInfo: {
    flex: 1,
  },
  dealAddress: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
  },
  dealMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  dealArrow: {
    fontSize: 20,
    color: colors.slate[300],
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    minHeight: 100,
    textAlignVertical: 'top',
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
  timelineItem: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand[500],
    marginTop: 6,
    marginRight: spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
  timelineSummary: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  timelineDate: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },
})
