/**
 * Profile Screen
 *
 * User profile, settings, and sign out.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'
import { useSettings } from '../../src/contexts/SettingsContext'
import { useFeatureGate } from '../../src/hooks/useFeatureGate'
import { profileService } from '../../src/services'

// Support URLs
const HELP_CENTER_URL = 'https://flipmantis.com/help'
const TERMS_URL = 'https://flipmantis.com/terms'
const SUPPORT_EMAIL = 'support@flipmantis.com'

// Menu Item Component
function MenuItem({
  icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  icon: string
  label: string
  value?: string
  onPress?: () => void
  destructive?: boolean
}) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={styles.menuContent}>
        <Text
          style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}
        >
          {label}
        </Text>
        {value && <Text style={styles.menuValue}>{value}</Text>}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  )
}

// Strategy options for deal preferences
const STRATEGY_OPTIONS = [
  { key: 'flip', label: 'Flip', description: 'Buy, renovate, and sell quickly' },
  { key: 'brrrr', label: 'BRRRR', description: 'Buy, Rehab, Rent, Refinance, Repeat' },
  { key: 'wholesale', label: 'Wholesale', description: 'Assign contracts to other investors' },
  { key: 'hold', label: 'Buy & Hold', description: 'Long-term rental properties' },
] as const

// Web billing portal URL
const WEB_BILLING_URL = 'https://app.flipmantis.com/settings/billing'

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
  return `$${amount.toFixed(0)}`
}

// Referral URL
const REFERRAL_URL = 'https://flipmantis.com/invite'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { settings, updateSettings } = useSettings()
  const { tier, tierName, isLoading: tierLoading } = useFeatureGate()

  // Data states
  const [monthlyStats, setMonthlyStats] = useState<{
    leadsCapured: number
    dealsInProgress: number
    dealsClosedThisMonth: number
    projectedProfit: number
    tasksCompleted: number
  } | null>(null)
  const [recentDeals, setRecentDeals] = useState<Array<{
    id: string
    name: string
    address: string
    stage: string
    lastViewed: string
  }>>([])
  const [integrations, setIntegrations] = useState<Array<{
    name: string
    connected: boolean
    lastSync?: string
  }>>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // Fetch profile data
  const fetchProfileData = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [statsResult, dealsResult, integrationsResult] = await Promise.all([
        profileService.getMonthlyStats(),
        profileService.getRecentDeals(3),
        profileService.getIntegrationStatus(),
      ])

      if (statsResult.data) setMonthlyStats(statsResult.data)
      if (dealsResult.data) setRecentDeals(dealsResult.data)
      if (integrationsResult.data) setIntegrations(integrationsResult.data)
    } catch (err) {
      console.error('[Profile] Error fetching data:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfileData()
  }, [fetchProfileData])

  // Modal states
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showAppearanceModal, setShowAppearanceModal] = useState(false)

  // Temp form state for edit profile
  const [tempDisplayName, setTempDisplayName] = useState(settings.displayName)

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  // Share referral link
  const handleShareReferral = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await Share.share({
        message: `Join me on FlipMantis - the ultimate real estate investing app! Sign up here: ${REFERRAL_URL}`,
        url: REFERRAL_URL,
      })
    } catch (err) {
      console.error('[Profile] Share error:', err)
    }
  }

  // Toggle strategy in preferences
  const toggleStrategy = (strategy: 'flip' | 'brrrr' | 'wholesale' | 'hold') => {
    const current = settings.preferredStrategies
    const updated = current.includes(strategy)
      ? current.filter((s) => s !== strategy)
      : [...current, strategy]
    updateSettings({ preferredStrategies: updated })
  }

  // Get display values
  const strategiesDisplay =
    settings.preferredStrategies.length > 0
      ? settings.preferredStrategies.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
      : 'None'

  const notificationsDisplay = settings.notificationsEnabled ? 'On' : 'Off'
  const appearanceDisplay = settings.darkMode ? 'Dark' : 'Light'
  const displayName = settings.displayName || user?.email?.split('@')[0] || 'User'

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* User Info Card */}
      <Card style={styles.userCard} padding="lg">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userEmail}>{user?.email || 'Not signed in'}</Text>

        {/* Entitlement Badge - Dynamic based on tier */}
        <TouchableOpacity
          style={[
            styles.entitlementBadge,
            tier === 'free' && styles.entitlementBadgeFree,
          ]}
          onPress={() => Linking.openURL(WEB_BILLING_URL)}
        >
          <Text style={[
            styles.entitlementIcon,
            tier === 'free' && styles.entitlementTextFree,
          ]}>
            {tier === 'free' ? '○' : '✓'}
          </Text>
          <Text style={[
            styles.entitlementText,
            tier === 'free' && styles.entitlementTextFree,
          ]}>
            {tierLoading ? 'Loading...' : `FlipMantis ${tierName}`}
          </Text>
          <Text style={[
            styles.entitlementArrow,
            tier === 'free' && styles.entitlementTextFree,
          ]}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* Usage Stats Section */}
      <Text style={styles.sectionTitle}>This Month</Text>
      <Card style={styles.statsCard}>
        {statsLoading ? (
          <ActivityIndicator size="small" color={colors.brand[500]} />
        ) : monthlyStats ? (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{monthlyStats.leadsCapured}</Text>
              <Text style={styles.statLabel}>Leads</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{monthlyStats.dealsInProgress}</Text>
              <Text style={styles.statLabel}>Active Deals</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueProfit]}>
                {formatCurrency(monthlyStats.projectedProfit)}
              </Text>
              <Text style={styles.statLabel}>Projected</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.statsEmpty}>No data available</Text>
        )}
        {monthlyStats && (
          <View style={styles.statsFooter}>
            <Text style={styles.statsFooterText}>
              {monthlyStats.tasksCompleted} tasks completed • {monthlyStats.dealsClosedThisMonth} deals closed
            </Text>
          </View>
        )}
      </Card>

      {/* Streak Badge */}
      <View style={styles.streakCard}>
        <Text style={styles.streakIcon}>🔥</Text>
        <View style={styles.streakContent}>
          <Text style={styles.streakTitle}>7-Day Login Streak!</Text>
          <Text style={styles.streakSubtitle}>Keep it going to unlock rewards</Text>
        </View>
      </View>

      {/* Recent Deals */}
      {recentDeals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Deals</Text>
          <Card padding="none">
            {recentDeals.map((deal, index) => (
              <TouchableOpacity
                key={deal.id}
                style={styles.recentDealRow}
                onPress={() => router.push(`/deal/${deal.id}`)}
              >
                <View style={styles.recentDealIcon}>
                  <Text style={styles.recentDealIconText}>🏠</Text>
                </View>
                <View style={styles.recentDealContent}>
                  <Text style={styles.recentDealAddress} numberOfLines={1}>
                    {deal.address}
                  </Text>
                  <Text style={styles.recentDealStage}>{deal.stage}</Text>
                </View>
                <Text style={styles.recentDealArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}

      {/* Refer a Friend */}
      <TouchableOpacity style={styles.referralCard} onPress={handleShareReferral}>
        <View style={styles.referralContent}>
          <Text style={styles.referralIcon}>🎁</Text>
          <View style={styles.referralText}>
            <Text style={styles.referralTitle}>Refer a Friend</Text>
            <Text style={styles.referralSubtitle}>Share FlipMantis and earn rewards</Text>
          </View>
        </View>
        <Text style={styles.referralArrow}>›</Text>
      </TouchableOpacity>

      {/* Investment Section */}
      <Text style={styles.sectionTitle}>Investment</Text>
      <Card padding="none">
        <MenuItem
          icon="🎯"
          label="Buy Box"
          value="AI Criteria"
          onPress={() => router.push('/buybox')}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="🔍"
          label="Saved Searches"
          onPress={() => router.push('/saved-searches')}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📊"
          label="Deal Preferences"
          value={strategiesDisplay}
          onPress={() => setShowPreferencesModal(true)}
        />
      </Card>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <Card padding="none">
        <MenuItem
          icon="👤"
          label="Edit Profile"
          onPress={() => {
            setTempDisplayName(settings.displayName)
            setShowProfileModal(true)
          }}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="🔔"
          label="Notifications"
          value={notificationsDisplay}
          onPress={() => setShowNotificationsModal(true)}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="🔒"
          label="Security"
          onPress={() => setShowSecurityModal(true)}
        />
      </Card>

      {/* App Section */}
      <Text style={styles.sectionTitle}>App</Text>
      <Card padding="none">
        <MenuItem
          icon="🎨"
          label="Appearance"
          value={appearanceDisplay}
          onPress={() => setShowAppearanceModal(true)}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📱"
          label="Offline Mode"
          value={settings.offlineModeEnabled ? 'Enabled' : 'Disabled'}
          onPress={() =>
            updateSettings({ offlineModeEnabled: !settings.offlineModeEnabled })
          }
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="💾"
          label="Storage"
          value="245 MB"
          onPress={() =>
            Alert.alert(
              'Storage',
              'FlipMantis is using approximately 245 MB of storage for cached data, photos, and offline leads.'
            )
          }
        />
      </Card>

      {/* Integrations Section */}
      <Text style={styles.sectionTitle}>Integrations</Text>
      <Card padding="none">
        {integrations.map((integration, index) => (
          <View key={integration.name}>
            {index > 0 && <View style={styles.menuDivider} />}
            <View style={styles.integrationRow}>
              <View style={[
                styles.integrationStatus,
                integration.connected && styles.integrationStatusConnected,
              ]} />
              <View style={styles.integrationContent}>
                <Text style={styles.integrationName}>{integration.name}</Text>
                <Text style={styles.integrationState}>
                  {integration.connected ? 'Connected' : 'Not configured'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* Support Section */}
      <Text style={styles.sectionTitle}>Support</Text>
      <Card padding="none">
        <MenuItem
          icon="❓"
          label="Help Center"
          onPress={() => Linking.openURL(HELP_CENTER_URL)}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📧"
          label="Contact Support"
          onPress={() =>
            Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=FlipMantis%20Mobile%20Support`)
          }
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📝"
          label="Terms of Service"
          onPress={() => Linking.openURL(TERMS_URL)}
        />
      </Card>

      {/* Sign Out */}
      <View style={styles.signOutContainer}>
        <Button variant="outline" fullWidth onPress={handleSignOut}>
          Sign Out
        </Button>
      </View>

      {/* Version */}
      <Text style={styles.version}>FlipMantis Mobile v1.0.0</Text>

      {/* ========== MODALS ========== */}

      {/* Deal Preferences Modal */}
      <Modal
        visible={showPreferencesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Deal Preferences</Text>
            <TouchableOpacity onPress={() => setShowPreferencesModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>Preferred Strategies</Text>
            <Text style={styles.modalHint}>
              Select the investment strategies you're interested in
            </Text>
            {STRATEGY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.optionRow}
                onPress={() => toggleStrategy(option.key)}
              >
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>
                <View
                  style={[
                    styles.optionCheck,
                    settings.preferredStrategies.includes(option.key) &&
                      styles.optionCheckActive,
                  ]}
                >
                  {settings.preferredStrategies.includes(option.key) && (
                    <Text style={styles.optionCheckIcon}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => {
                updateSettings({ displayName: tempDisplayName })
                setShowProfileModal(false)
              }}
            >
              <Text style={styles.modalClose}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={tempDisplayName}
              onChangeText={setTempDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.slate[400]}
            />
            <Text style={styles.modalHint}>
              This is how you'll appear in the app
            </Text>

            <Text style={styles.modalLabel}>Email</Text>
            <View style={styles.modalInputDisabled}>
              <Text style={styles.modalInputDisabledText}>{user?.email}</Text>
            </View>
            <Text style={styles.modalHint}>
              Email cannot be changed from the app
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Enable Notifications</Text>
                <Text style={styles.toggleDesc}>Receive all app notifications</Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) =>
                  updateSettings({ notificationsEnabled: value })
                }
                trackColor={{ false: colors.slate[200], true: colors.brand[500] }}
              />
            </View>

            {settings.notificationsEnabled && (
              <>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Push Notifications</Text>
                    <Text style={styles.toggleDesc}>New leads, deal updates</Text>
                  </View>
                  <Switch
                    value={settings.pushNotifications}
                    onValueChange={(value) =>
                      updateSettings({ pushNotifications: value })
                    }
                    trackColor={{ false: colors.slate[200], true: colors.brand[500] }}
                  />
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Email Notifications</Text>
                    <Text style={styles.toggleDesc}>Weekly summaries, reports</Text>
                  </View>
                  <Switch
                    value={settings.emailNotifications}
                    onValueChange={(value) =>
                      updateSettings({ emailNotifications: value })
                    }
                    trackColor={{ false: colors.slate[200], true: colors.brand[500] }}
                  />
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>SMS Notifications</Text>
                    <Text style={styles.toggleDesc}>Urgent deal alerts only</Text>
                  </View>
                  <Switch
                    value={settings.smsNotifications}
                    onValueChange={(value) =>
                      updateSettings({ smsNotifications: value })
                    }
                    trackColor={{ false: colors.slate[200], true: colors.brand[500] }}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Security Modal */}
      <Modal
        visible={showSecurityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Security</Text>
            <TouchableOpacity onPress={() => setShowSecurityModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <TouchableOpacity
              style={styles.securityRow}
              onPress={() => {
                Alert.alert(
                  'Change Password',
                  'A password reset link will be sent to your email.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Send Link',
                      onPress: () => {
                        // In production, call supabase.auth.resetPasswordForEmail
                        Alert.alert('Sent', 'Check your email for the reset link.')
                      },
                    },
                  ]
                )
              }}
            >
              <Text style={styles.securityIcon}>🔑</Text>
              <View style={styles.securityInfo}>
                <Text style={styles.securityLabel}>Change Password</Text>
                <Text style={styles.securityDesc}>
                  Reset your password via email
                </Text>
              </View>
              <Text style={styles.securityArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.securityRow}
              onPress={() =>
                Alert.alert(
                  'Two-Factor Authentication',
                  '2FA adds an extra layer of security to your account. This feature will be available in a future update.'
                )
              }
            >
              <Text style={styles.securityIcon}>🔐</Text>
              <View style={styles.securityInfo}>
                <Text style={styles.securityLabel}>Two-Factor Auth</Text>
                <Text style={styles.securityDesc}>Add extra security (coming soon)</Text>
              </View>
              <Text style={styles.securityArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.securityRow}
              onPress={() =>
                Alert.alert(
                  'Active Sessions',
                  'You are currently signed in on this device. Sign out to end this session.'
                )
              }
            >
              <Text style={styles.securityIcon}>📱</Text>
              <View style={styles.securityInfo}>
                <Text style={styles.securityLabel}>Active Sessions</Text>
                <Text style={styles.securityDesc}>Manage signed-in devices</Text>
              </View>
              <Text style={styles.securityArrow}>›</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Appearance Modal */}
      <Modal
        visible={showAppearanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAppearanceModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Appearance</Text>
            <TouchableOpacity onPress={() => setShowAppearanceModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>Theme</Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  !settings.darkMode && styles.themeOptionActive,
                ]}
                onPress={() => updateSettings({ darkMode: false })}
              >
                <Text style={styles.themeIcon}>☀️</Text>
                <Text
                  style={[
                    styles.themeLabel,
                    !settings.darkMode && styles.themeLabelActive,
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  settings.darkMode && styles.themeOptionActive,
                ]}
                onPress={() => updateSettings({ darkMode: true })}
              >
                <Text style={styles.themeIcon}>🌙</Text>
                <Text
                  style={[
                    styles.themeLabel,
                    settings.darkMode && styles.themeLabelActive,
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              {settings.darkMode
                ? 'Dark mode is enabled. Theme will apply on next app restart.'
                : 'Light mode is currently active.'}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  userCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  userName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  entitlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  entitlementIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
  },
  entitlementText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[700],
  },
  entitlementBadgeFree: {
    backgroundColor: colors.slate[100],
  },
  entitlementTextFree: {
    color: colors.slate[600],
  },
  entitlementArrow: {
    fontSize: typography.fontSize.lg,
    color: colors.brand[400],
    marginLeft: spacing.xs,
  },
  // Stats card styles
  statsCard: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  statValueProfit: {
    color: colors.success[600],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.slate[200],
  },
  statsFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  statsFooterText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    textAlign: 'center',
  },
  statsEmpty: {
    textAlign: 'center',
    color: colors.slate[400],
    padding: spacing.md,
  },
  // Streak card styles
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  streakIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  streakContent: {
    flex: 1,
  },
  streakTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  streakSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginTop: 2,
  },
  // Recent deals styles
  recentDealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  recentDealIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  recentDealIconText: {
    fontSize: 16,
  },
  recentDealContent: {
    flex: 1,
  },
  recentDealAddress: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  recentDealStage: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
    textTransform: 'capitalize',
  },
  recentDealArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.slate[300],
  },
  // Referral card styles
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brand[500],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  referralContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  referralIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  referralText: {
    flex: 1,
  },
  referralTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  referralSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[100],
    marginTop: 2,
  },
  referralArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.brand[200],
  },
  // Integration styles
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  integrationStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.slate[300],
    marginRight: spacing.md,
  },
  integrationStatusConnected: {
    backgroundColor: colors.success[500],
  },
  integrationContent: {
    flex: 1,
  },
  integrationName: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  integrationState: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuIcon: {
    fontSize: typography.fontSize.lg,
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  menuLabelDestructive: {
    color: colors.error[500],
  },
  menuValue: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  menuArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.slate[300],
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginLeft: spacing.md + spacing.lg + spacing.md,
  },
  signOutContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginBottom: spacing.lg,
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
  modalClose: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[500],
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  modalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
    marginBottom: spacing.md,
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
  modalInputDisabled: {
    borderWidth: 1,
    borderColor: colors.slate[100],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[50],
  },
  modalInputDisabledText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[400],
  },
  // Option row styles (for Deal Preferences)
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  optionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  optionCheckIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  // Toggle row styles (for Notifications)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  toggleDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  // Security row styles
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  securityIcon: {
    fontSize: typography.fontSize.xl,
    marginRight: spacing.md,
  },
  securityInfo: {
    flex: 1,
  },
  securityLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  securityDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  securityArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.slate[300],
  },
  // Theme styles (for Appearance)
  themeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  themeOptionActive: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  themeIcon: {
    fontSize: typography.fontSize['2xl'],
    marginBottom: spacing.sm,
  },
  themeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  themeLabelActive: {
    color: colors.brand[600],
  },
})
