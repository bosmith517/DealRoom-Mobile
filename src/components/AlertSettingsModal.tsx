/**
 * AlertSettingsModal Component
 *
 * Modal for configuring push notification preferences for market alerts.
 * Settings include severity filters, alert types, quiet hours, and digest mode.
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, typography, radii } from '../theme'

const ALERT_SETTINGS_KEY = 'flipmantis_alert_settings'

// Alert types
const ALERT_TYPES = [
  { key: 'price_drop', label: 'Price Drops', icon: '📉' },
  { key: 'new_listing', label: 'New Listings', icon: '🏠' },
  { key: 'inventory_spike', label: 'Inventory Spikes', icon: '📊' },
  { key: 'foreclosure', label: 'Foreclosures', icon: '⚠️' },
  { key: 'market_trend', label: 'Market Trends', icon: '📈' },
  { key: 'auction', label: 'Auctions', icon: '🔨' },
]

// Quiet hours presets
const QUIET_HOURS_PRESETS = [
  { key: 'none', label: 'None' },
  { key: 'night', label: '10 PM - 7 AM' },
  { key: 'sleep', label: '11 PM - 8 AM' },
  { key: 'workday', label: '9 AM - 5 PM' },
]

export interface AlertSettings {
  pushEnabled: boolean
  severityLevel: 'all' | 'important' | 'urgent'
  enabledTypes: string[]
  quietHours: string
  digestMode: 'instant' | 'daily' | 'weekly'
}

const defaultSettings: AlertSettings = {
  pushEnabled: true,
  severityLevel: 'important',
  enabledTypes: ['price_drop', 'foreclosure', 'auction'],
  quietHours: 'night',
  digestMode: 'instant',
}

interface AlertSettingsModalProps {
  visible: boolean
  onClose: () => void
}

export function AlertSettingsModal({ visible, onClose }: AlertSettingsModalProps) {
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load settings on mount
  useEffect(() => {
    if (visible) {
      loadSettings()
    }
  }, [visible])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const stored = await AsyncStorage.getItem(ALERT_SETTINGS_KEY)
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) })
      }
    } catch (error) {
      console.error('Error loading alert settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings))
      onClose()
    } catch (error) {
      console.error('Error saving alert settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleAlertType = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      enabledTypes: prev.enabledTypes.includes(key)
        ? prev.enabledTypes.filter((t) => t !== key)
        : [...prev.enabledTypes, key],
    }))
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[styles.headerButton, saving && styles.headerButtonDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alert Settings</Text>
          <TouchableOpacity onPress={saveSettings} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.brand[500]} />
            ) : (
              <Text style={[styles.headerButton, styles.headerButtonPrimary]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Push Notifications Master Toggle */}
            <View style={styles.section}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingHint}>
                    Receive alerts on your device
                  </Text>
                </View>
                <Switch
                  value={settings.pushEnabled}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, pushEnabled: value }))
                  }
                  trackColor={{ false: colors.slate[200], true: colors.brand[400] }}
                  thumbColor={settings.pushEnabled ? colors.brand[600] : colors.slate[50]}
                />
              </View>
            </View>

            {settings.pushEnabled && (
              <>
                {/* Severity Level */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notification Level</Text>
                  <Text style={styles.sectionSubtitle}>
                    Which alerts should send push notifications?
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.severityLevel === 'urgent' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, severityLevel: 'urgent' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.error[100] }]}>
                      <Text style={styles.optionIconText}>🚨</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>Urgent Only</Text>
                      <Text style={styles.optionHint}>
                        Only the most critical alerts
                      </Text>
                    </View>
                    {settings.severityLevel === 'urgent' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.severityLevel === 'important' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, severityLevel: 'important' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.warning[100] }]}>
                      <Text style={styles.optionIconText}>⚡</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>Important & Urgent</Text>
                      <Text style={styles.optionHint}>
                        Significant opportunities and urgent alerts
                      </Text>
                    </View>
                    {settings.severityLevel === 'important' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.severityLevel === 'all' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, severityLevel: 'all' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.brand[100] }]}>
                      <Text style={styles.optionIconText}>🔔</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>All Alerts</Text>
                      <Text style={styles.optionHint}>
                        Get notified for every alert
                      </Text>
                    </View>
                    {settings.severityLevel === 'all' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Alert Types */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Alert Types</Text>
                  <Text style={styles.sectionSubtitle}>
                    Choose which types of alerts to receive
                  </Text>

                  <View style={styles.typeGrid}>
                    {ALERT_TYPES.map((type) => {
                      const isEnabled = settings.enabledTypes.includes(type.key)
                      return (
                        <TouchableOpacity
                          key={type.key}
                          style={[
                            styles.typeChip,
                            isEnabled && styles.typeChipSelected,
                          ]}
                          onPress={() => toggleAlertType(type.key)}
                        >
                          <Text style={styles.typeIcon}>{type.icon}</Text>
                          <Text
                            style={[
                              styles.typeLabel,
                              isEnabled && styles.typeLabelSelected,
                            ]}
                          >
                            {type.label}
                          </Text>
                          {isEnabled && (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={colors.brand[500]}
                              style={styles.typeCheck}
                            />
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>

                {/* Quiet Hours */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quiet Hours</Text>
                  <Text style={styles.sectionSubtitle}>
                    Silence notifications during these times
                  </Text>

                  <View style={styles.quietHoursGrid}>
                    {QUIET_HOURS_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.key}
                        style={[
                          styles.quietChip,
                          settings.quietHours === preset.key && styles.quietChipSelected,
                        ]}
                        onPress={() =>
                          setSettings((prev) => ({ ...prev, quietHours: preset.key }))
                        }
                      >
                        <Text
                          style={[
                            styles.quietChipText,
                            settings.quietHours === preset.key && styles.quietChipTextSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Digest Mode */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Delivery Mode</Text>
                  <Text style={styles.sectionSubtitle}>
                    How would you like to receive alerts?
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.digestMode === 'instant' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, digestMode: 'instant' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.success[100] }]}>
                      <Text style={styles.optionIconText}>⚡</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>Instant</Text>
                      <Text style={styles.optionHint}>
                        Get notified immediately
                      </Text>
                    </View>
                    {settings.digestMode === 'instant' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.digestMode === 'daily' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, digestMode: 'daily' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.brand[100] }]}>
                      <Text style={styles.optionIconText}>📬</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>Daily Digest</Text>
                      <Text style={styles.optionHint}>
                        One summary notification per day at 8 AM
                      </Text>
                    </View>
                    {settings.digestMode === 'daily' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      settings.digestMode === 'weekly' && styles.optionCardSelected,
                    ]}
                    onPress={() =>
                      setSettings((prev) => ({ ...prev, digestMode: 'weekly' }))
                    }
                  >
                    <View style={[styles.optionIcon, { backgroundColor: colors.slate[100] }]}>
                      <Text style={styles.optionIconText}>📅</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>Weekly Digest</Text>
                      <Text style={styles.optionHint}>
                        One summary per week on Monday
                      </Text>
                    </View>
                    {settings.digestMode === 'weekly' && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.brand[500]} />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Bottom spacer */}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

// Export helper to get current settings
export async function getAlertSettings(): Promise<AlertSettings> {
  try {
    const stored = await AsyncStorage.getItem(ALERT_SETTINGS_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Error loading alert settings:', error)
  }
  return defaultSettings
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.ink,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.ink,
  },
  settingHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionIconText: {
    fontSize: 20,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.ink,
  },
  optionHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    gap: spacing.xs,
  },
  typeChipSelected: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  typeIcon: {
    fontSize: 16,
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  typeLabelSelected: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium as any,
  },
  typeCheck: {
    marginLeft: spacing.xs,
  },
  quietHoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quietChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  quietChipSelected: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  quietChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  quietChipTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium as any,
  },
})

export default AlertSettingsModal
