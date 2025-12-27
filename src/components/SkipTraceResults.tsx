/**
 * SkipTraceResults Component
 *
 * Displays skip trace results including phones, emails, addresses,
 * relatives, and litigator warnings.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ViewStyle,
  StyleProp,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radii, spacing, typography } from '../theme'
import type { SkipTraceResult, PhoneResult, EmailResult, RelativeResult } from '../services'

interface SkipTraceResultsProps {
  result: SkipTraceResult
  showRelatives?: boolean
  showAddresses?: boolean
  compact?: boolean
  style?: StyleProp<ViewStyle>
}

export function SkipTraceResults({
  result,
  showRelatives = true,
  showAddresses = true,
  compact = false,
  style,
}: SkipTraceResultsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleCallPhone = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\D/g, '')}`)
  }

  const handleSendEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`)
  }

  const handleSendSMS = (phone: string) => {
    Linking.openURL(`sms:${phone.replace(/\D/g, '')}`)
  }

  // Litigator warning banner
  const renderLitigatorWarning = () => {
    if (!result.isLitigator) return null

    const riskLevel = result.litigatorDetails?.riskLevel || 'high'
    const bgColor = riskLevel === 'critical' ? colors.error[600] : colors.error[500]

    return (
      <View style={[styles.litigatorBanner, { backgroundColor: bgColor }]}>
        <Ionicons name="warning" size={24} color={colors.white} />
        <View style={styles.litigatorContent}>
          <Text style={styles.litigatorTitle}>Litigator Warning</Text>
          <Text style={styles.litigatorText}>
            This owner has been flagged as a litigator
            {result.litigatorScore ? ` (score: ${result.litigatorScore})` : ''}.
            Proceed with caution.
          </Text>
        </View>
      </View>
    )
  }

  // Owner info header
  const renderOwnerHeader = () => {
    if (!result.ownerFullName && !result.ownerFirstName) return null

    const name = result.ownerFullName ||
      `${result.ownerFirstName || ''} ${result.ownerLastName || ''}`.trim()

    return (
      <View style={styles.ownerHeader}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={28} color={colors.brand[500]} />
        </View>
        <View style={styles.ownerInfo}>
          <Text style={styles.ownerName}>{name}</Text>
          {result.ownerAge && (
            <Text style={styles.ownerMeta}>Age: {result.ownerAge}</Text>
          )}
        </View>
        {result.overallMatchScore && (
          <View style={styles.matchBadge}>
            <Text style={styles.matchScore}>{result.overallMatchScore}%</Text>
            <Text style={styles.matchLabel}>match</Text>
          </View>
        )}
      </View>
    )
  }

  // Phone numbers section
  const renderPhones = () => {
    if (!result.phoneNumbers || result.phoneNumbers.length === 0) return null

    const sortedPhones = [...result.phoneNumbers].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1
      if (!a.isPrimary && b.isPrimary) return 1
      if (a.type === 'mobile' && b.type !== 'mobile') return -1
      if (a.type !== 'mobile' && b.type === 'mobile') return 1
      return 0
    })

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="call-outline" size={18} color={colors.slate[600]} />
          <Text style={styles.sectionTitle}>Phone Numbers</Text>
          <Text style={styles.sectionCount}>{result.phoneNumbers.length}</Text>
        </View>
        <View style={styles.sectionContent}>
          {sortedPhones.map((phone, index) => (
            <PhoneRow
              key={`${phone.phone}-${index}`}
              phone={phone}
              onCall={() => handleCallPhone(phone.phone)}
              onSMS={() => handleSendSMS(phone.phone)}
            />
          ))}
        </View>
      </View>
    )
  }

  // Email addresses section
  const renderEmails = () => {
    if (!result.emailAddresses || result.emailAddresses.length === 0) return null

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="mail-outline" size={18} color={colors.slate[600]} />
          <Text style={styles.sectionTitle}>Email Addresses</Text>
          <Text style={styles.sectionCount}>{result.emailAddresses.length}</Text>
        </View>
        <View style={styles.sectionContent}>
          {result.emailAddresses.map((email, index) => (
            <EmailRow
              key={`${email.email}-${index}`}
              email={email}
              onPress={() => handleSendEmail(email.email)}
            />
          ))}
        </View>
      </View>
    )
  }

  // Addresses section
  const renderAddresses = () => {
    if (!showAddresses) return null

    const hasAddresses = result.currentAddress ||
      result.mailingAddress ||
      (result.previousAddresses && result.previousAddresses.length > 0)

    if (!hasAddresses) return null

    const isExpanded = expandedSection === 'addresses'

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('addresses')}
        >
          <Ionicons name="location-outline" size={18} color={colors.slate[600]} />
          <Text style={styles.sectionTitle}>Addresses</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.slate[400]}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sectionContent}>
            {result.currentAddress && (
              <AddressRow
                address={result.currentAddress}
                label="Current"
              />
            )}
            {result.mailingAddress && (
              <AddressRow
                address={result.mailingAddress}
                label="Mailing"
              />
            )}
            {result.previousAddresses?.map((addr, index) => (
              <AddressRow
                key={index}
                address={addr}
                label={`Previous ${index + 1}`}
              />
            ))}
          </View>
        )}
      </View>
    )
  }

  // Relatives section
  const renderRelatives = () => {
    if (!showRelatives) return null
    if (!result.relatives || result.relatives.length === 0) return null

    const isExpanded = expandedSection === 'relatives'

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('relatives')}
        >
          <Ionicons name="people-outline" size={18} color={colors.slate[600]} />
          <Text style={styles.sectionTitle}>Relatives</Text>
          <Text style={styles.sectionCount}>{result.relatives.length}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.slate[400]}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sectionContent}>
            {result.relatives.map((relative, index) => (
              <RelativeRow
                key={index}
                relative={relative}
                onCallPhone={handleCallPhone}
              />
            ))}
          </View>
        )}
      </View>
    )
  }

  // Cache indicator
  const renderCacheInfo = () => {
    if (!result.fetchedAt) return null

    const fetchedDate = new Date(result.fetchedAt)
    const isStale = Date.now() - fetchedDate.getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days

    return (
      <View style={styles.cacheInfo}>
        <Ionicons
          name={isStale ? 'time-outline' : 'checkmark-circle'}
          size={14}
          color={isStale ? colors.warning[500] : colors.success[500]}
        />
        <Text style={[styles.cacheText, isStale && styles.cacheTextStale]}>
          {isStale ? 'Data may be outdated' : 'Recently verified'} - {fetchedDate.toLocaleDateString()}
        </Text>
      </View>
    )
  }

  if (compact) {
    // Compact view - just show primary contact info
    const primaryPhone = result.phoneNumbers?.find(p => p.isPrimary) || result.phoneNumbers?.[0]
    const primaryEmail = result.emailAddresses?.find(e => e.isPrimary) || result.emailAddresses?.[0]

    return (
      <View style={[styles.compactContainer, style]}>
        {result.isLitigator && (
          <View style={styles.compactLitigator}>
            <Ionicons name="warning" size={14} color={colors.error[500]} />
            <Text style={styles.compactLitigatorText}>Litigator</Text>
          </View>
        )}
        {primaryPhone && (
          <TouchableOpacity
            style={styles.compactItem}
            onPress={() => handleCallPhone(primaryPhone.phone)}
          >
            <Ionicons name="call" size={16} color={colors.brand[500]} />
            <Text style={styles.compactText}>{formatPhone(primaryPhone.phone)}</Text>
          </TouchableOpacity>
        )}
        {primaryEmail && (
          <TouchableOpacity
            style={styles.compactItem}
            onPress={() => handleSendEmail(primaryEmail.email)}
          >
            <Ionicons name="mail" size={16} color={colors.brand[500]} />
            <Text style={styles.compactText} numberOfLines={1}>{primaryEmail.email}</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      {renderLitigatorWarning()}
      {renderOwnerHeader()}
      {renderPhones()}
      {renderEmails()}
      {renderAddresses()}
      {renderRelatives()}
      {renderCacheInfo()}
    </ScrollView>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface PhoneRowProps {
  phone: PhoneResult
  onCall: () => void
  onSMS: () => void
}

function PhoneRow({ phone, onCall, onSMS }: PhoneRowProps) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactValue}>{formatPhone(phone.phone)}</Text>
        <View style={styles.contactMeta}>
          <Text style={styles.contactType}>{phone.type}</Text>
          {phone.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryText}>Primary</Text>
            </View>
          )}
          {!phone.isValid && (
            <View style={styles.invalidBadge}>
              <Text style={styles.invalidText}>Invalid</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onSMS}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.brand[500]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onCall}>
          <Ionicons name="call-outline" size={18} color={colors.success[500]} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface EmailRowProps {
  email: EmailResult
  onPress: () => void
}

function EmailRow({ email, onPress }: EmailRowProps) {
  return (
    <TouchableOpacity style={styles.contactRow} onPress={onPress}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactValue}>{email.email}</Text>
        <View style={styles.contactMeta}>
          <Text style={styles.contactType}>{email.type}</Text>
          {email.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryText}>Primary</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.slate[400]} />
    </TouchableOpacity>
  )
}

interface AddressRowProps {
  address: { street: string; city: string; state: string; zip: string }
  label: string
}

function AddressRow({ address, label }: AddressRowProps) {
  return (
    <View style={styles.addressRow}>
      <Text style={styles.addressLabel}>{label}</Text>
      <Text style={styles.addressValue}>
        {address.street}
      </Text>
      <Text style={styles.addressCity}>
        {address.city}, {address.state} {address.zip}
      </Text>
    </View>
  )
}

interface RelativeRowProps {
  relative: RelativeResult
  onCallPhone: (phone: string) => void
}

function RelativeRow({ relative, onCallPhone }: RelativeRowProps) {
  return (
    <View style={styles.relativeRow}>
      <View style={styles.relativeInfo}>
        <Text style={styles.relativeName}>{relative.fullName}</Text>
        {relative.relationship && (
          <Text style={styles.relativeRelation}>{relative.relationship}</Text>
        )}
      </View>
      {relative.phones && relative.phones.length > 0 && (
        <TouchableOpacity
          style={styles.relativeCall}
          onPress={() => onCallPhone(relative.phones![0])}
        >
          <Ionicons name="call-outline" size={16} color={colors.brand[500]} />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Litigator banner
  litigatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  litigatorContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  litigatorTitle: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  litigatorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },

  // Owner header
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  ownerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  ownerMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  matchBadge: {
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.success[100],
    borderRadius: radii.md,
  },
  matchScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  matchLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
  },

  // Section
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginRight: spacing.xs,
  },
  sectionContent: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    overflow: 'hidden',
  },

  // Contact row
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  contactInfo: {
    flex: 1,
  },
  contactValue: {
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
    fontWeight: typography.fontWeight.medium,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.xs,
  },
  contactType: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textTransform: 'capitalize',
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Badges
  primaryBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  primaryText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  invalidBadge: {
    backgroundColor: colors.error[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  invalidText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Address row
  addressRow: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  addressLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addressValue: {
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
  },
  addressCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginTop: 2,
  },

  // Relative row
  relativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  relativeInfo: {
    flex: 1,
  },
  relativeName: {
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
  },
  relativeRelation: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  relativeCall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cache info
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cacheText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  cacheTextStale: {
    color: colors.warning[600],
  },

  // Compact view
  compactContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  compactLitigator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  compactLitigatorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    fontWeight: typography.fontWeight.semibold,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  compactText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[700],
  },
})
