/**
 * No Access Screen
 *
 * Shown when user is authenticated but doesn't have DealRoom platform access.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useAuth } from '../src/contexts/AuthContext'
import { colors, spacing, typography } from '../src/theme'

export default function NoAccessScreen() {
  const { user, signOut } = useAuth()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>No DealRoom Access</Text>
        <Text style={styles.message}>
          Your account ({user?.email}) does not have access to the DealRoom mobile app.
        </Text>
        <Text style={styles.hint}>
          Contact your administrator to request DealRoom access.
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
  },
  signOutButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.slate[100],
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
})
