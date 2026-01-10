/**
 * EditSearchModal Component
 *
 * Modal for editing saved search details including name,
 * description, filters, and auto-run settings.
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'
import { type SavedSearch } from '../services'

// Available distress signals
const DISTRESS_SIGNALS = [
  { key: 'vacant', label: 'Vacant' },
  { key: 'boarded', label: 'Boarded' },
  { key: 'overgrown', label: 'Overgrown' },
  { key: 'mail_pileup', label: 'Mail Piling' },
  { key: 'code_violation', label: 'Code Violation' },
  { key: 'tax_lien', label: 'Tax Lien' },
  { key: 'pre_foreclosure', label: 'Pre-Foreclosure' },
  { key: 'probate', label: 'Probate' },
]

// Pipeline stages
const STAGES = [
  { key: '', label: 'Any Stage' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'due_diligence', label: 'Due Diligence' },
  { key: 'closed', label: 'Closed' },
]

// Auto-run schedules
const SCHEDULES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

interface EditSearchModalProps {
  visible: boolean
  search: SavedSearch | null
  onSave: (updates: Partial<SavedSearch>) => Promise<boolean>
  onClose: () => void
}

export function EditSearchModal({
  visible,
  search,
  onSave,
  onClose,
}: EditSearchModalProps) {
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')
  const [distressSignals, setDistressSignals] = useState<string[]>([])
  const [zipCodes, setZipCodes] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [equityMin, setEquityMin] = useState('')
  const [autoRunEnabled, setAutoRunEnabled] = useState(false)
  const [autoRunSchedule, setAutoRunSchedule] = useState('daily')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when search changes
  useEffect(() => {
    if (search) {
      setName(search.name || '')
      setDescription(search.description || '')
      setQuery(search.filters.query || '')
      setStage(search.filters.stage || '')
      setDistressSignals(search.filters.distress_signals || [])
      setZipCodes(search.filters.zip_codes?.join(', ') || '')
      setPriceMin(search.filters.price_min?.toString() || '')
      setPriceMax(search.filters.price_max?.toString() || '')
      setEquityMin(search.filters.equity_min?.toString() || '')
      setAutoRunEnabled(search.auto_run_enabled || false)
      setAutoRunSchedule(search.auto_run_schedule || 'daily')
    }
  }, [search])

  const toggleDistressSignal = (key: string) => {
    setDistressSignals((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setError(null)
    setSaving(true)

    try {
      // Build filters object
      const filters: SavedSearch['filters'] = {}
      if (query.trim()) filters.query = query.trim()
      if (stage) filters.stage = stage
      if (distressSignals.length > 0) filters.distress_signals = distressSignals
      if (zipCodes.trim()) {
        filters.zip_codes = zipCodes
          .split(',')
          .map((z) => z.trim())
          .filter(Boolean)
      }
      if (priceMin) filters.price_min = parseInt(priceMin, 10)
      if (priceMax) filters.price_max = parseInt(priceMax, 10)
      if (equityMin) filters.equity_min = parseInt(equityMin, 10)

      const updates: Partial<SavedSearch> = {
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
        auto_run_enabled: autoRunEnabled,
        auto_run_schedule: autoRunEnabled ? autoRunSchedule : undefined,
      }

      const success = await onSave(updates)
      if (success) {
        onClose()
      } else {
        setError('Failed to save changes')
      }
    } catch (err) {
      console.error('Error saving search:', err)
      setError('An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[styles.headerButton, saving && styles.headerButtonDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Search</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.brand[500]} />
            ) : (
              <Text style={[styles.headerButton, styles.headerButtonPrimary]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <Text style={styles.sectionTitle}>Basic Info</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="My Search"
              placeholderTextColor={colors.slate[400]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor={colors.slate[400]}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Filters */}
          <Text style={styles.sectionTitle}>Filters</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Search Query</Text>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search text..."
              placeholderTextColor={colors.slate[400]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Stage</Text>
            <View style={styles.chipRow}>
              {STAGES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.chip,
                    stage === s.key && styles.chipSelected,
                  ]}
                  onPress={() => setStage(s.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      stage === s.key && styles.chipTextSelected,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Distress Signals</Text>
            <View style={styles.chipRow}>
              {DISTRESS_SIGNALS.map((signal) => (
                <TouchableOpacity
                  key={signal.key}
                  style={[
                    styles.chip,
                    distressSignals.includes(signal.key) && styles.chipSelected,
                  ]}
                  onPress={() => toggleDistressSignal(signal.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      distressSignals.includes(signal.key) && styles.chipTextSelected,
                    ]}
                  >
                    {signal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>ZIP Codes</Text>
            <TextInput
              style={styles.input}
              value={zipCodes}
              onChangeText={setZipCodes}
              placeholder="60601, 60602, 60603"
              placeholderTextColor={colors.slate[400]}
              keyboardType="numeric"
            />
            <Text style={styles.hint}>Separate multiple ZIPs with commas</Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Min Price</Text>
              <TextInput
                style={styles.input}
                value={priceMin}
                onChangeText={setPriceMin}
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Max Price</Text>
              <TextInput
                style={styles.input}
                value={priceMax}
                onChangeText={setPriceMax}
                placeholder="$1,000,000"
                placeholderTextColor={colors.slate[400]}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Min Equity %</Text>
            <TextInput
              style={styles.input}
              value={equityMin}
              onChangeText={setEquityMin}
              placeholder="20"
              placeholderTextColor={colors.slate[400]}
              keyboardType="numeric"
            />
          </View>

          {/* Auto-Run Settings */}
          <Text style={styles.sectionTitle}>Automation</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Auto-Run</Text>
              <Text style={styles.switchHint}>
                Automatically run this search on a schedule
              </Text>
            </View>
            <Switch
              value={autoRunEnabled}
              onValueChange={setAutoRunEnabled}
              trackColor={{ false: colors.slate[200], true: colors.brand[400] }}
              thumbColor={autoRunEnabled ? colors.brand[600] : colors.slate[50]}
            />
          </View>

          {autoRunEnabled && (
            <View style={styles.field}>
              <Text style={styles.label}>Schedule</Text>
              <View style={styles.chipRow}>
                {SCHEDULES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.chip,
                      autoRunSchedule === s.key && styles.chipSelected,
                    ]}
                    onPress={() => setAutoRunSchedule(s.key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        autoRunSchedule === s.key && styles.chipTextSelected,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Bottom spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.ink,
  },
  headerButton: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  headerButtonPrimary: {
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold as any,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium as any,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.ink,
  },
  switchHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
})

export default EditSearchModal
