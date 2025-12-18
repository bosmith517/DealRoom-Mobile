/**
 * Profile Screen
 *
 * User profile, settings, and sign out.
 */

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'

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

export default function ProfileScreen() {
  const { user, tenantId, signOut, hasEntitlement } = useAuth()

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
            {user?.email?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>
          {user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.userEmail}>{user?.email || 'Not signed in'}</Text>

        {/* Entitlement Badge */}
        <View style={styles.entitlementBadge}>
          <Text style={styles.entitlementIcon}>✓</Text>
          <Text style={styles.entitlementText}>DealRoom Pro</Text>
        </View>
      </Card>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <Card padding="none">
        <MenuItem
          icon="👤"
          label="Edit Profile"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="🔔"
          label="Notifications"
          value="On"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="🔒"
          label="Security"
          onPress={() => {}}
        />
      </Card>

      {/* App Section */}
      <Text style={styles.sectionTitle}>App</Text>
      <Card padding="none">
        <MenuItem
          icon="🎨"
          label="Appearance"
          value="Light"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📱"
          label="Offline Mode"
          value="Enabled"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="💾"
          label="Storage"
          value="245 MB"
          onPress={() => {}}
        />
      </Card>

      {/* Support Section */}
      <Text style={styles.sectionTitle}>Support</Text>
      <Card padding="none">
        <MenuItem
          icon="❓"
          label="Help Center"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📧"
          label="Contact Support"
          onPress={() => {}}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="📝"
          label="Terms of Service"
          onPress={() => {}}
        />
      </Card>

      {/* Sign Out */}
      <View style={styles.signOutContainer}>
        <Button
          variant="outline"
          fullWidth
          onPress={handleSignOut}
        >
          Sign Out
        </Button>
      </View>

      {/* Version */}
      <Text style={styles.version}>DealRoom Mobile v1.0.0</Text>
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
})
