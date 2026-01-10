/**
 * No Access Screen
 *
 * Shown when user is authenticated but doesn't have FlipMantis platform access.
 */

import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/contexts/AuthContext'
import { colors, spacing, typography, radii } from '../src/theme'

// FlipMantis logo
const LOGO = require('../assets/emblem-transparent.png')

// URLs for external links
const SUPPORT_URL = 'https://flipmantis.com/support'

export default function NoAccessScreen() {
  const { user, signOut, refreshSession } = useAuth()
  const [isRetrying, setIsRetrying] = useState(false)

  // Retry checking access
  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await refreshSession()
      // If still on this screen after refresh, access still not granted
      Alert.alert('Access Check', 'Your account still does not have FlipMantis access. Please contact support if you believe this is an error.')
    } catch (error) {
      console.error('Error retrying:', error)
      Alert.alert('Error', 'Could not check access status. Please try again.')
    } finally {
      setIsRetrying(false)
    }
  }, [refreshSession])

  // Open external link
  const openLink = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Error', 'Could not open this link')
      }
    } catch (error) {
      console.error('Error opening link:', error)
      Alert.alert('Error', 'Could not open this link')
    }
  }, [])

  // Contact support via email
  const handleContactSupport = useCallback(() => {
    const subject = encodeURIComponent('FlipMantis Access Request')
    const body = encodeURIComponent(`Hi,\n\nI would like to request access to FlipMantis for the following account:\n\nEmail: ${user?.email}\n\nThank you!`)
    const mailtoUrl = `mailto:support@flipmantis.com?subject=${subject}&body=${body}`

    Linking.openURL(mailtoUrl).catch(() => {
      openLink(SUPPORT_URL)
    })
  }, [user?.email, openLink])

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>No FlipMantis Access</Text>
        <Text style={styles.message}>
          Your account ({user?.email}) does not have access to the FlipMantis mobile app.
        </Text>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          {/* Contact Support - Primary CTA */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleContactSupport}>
            <Ionicons name="mail-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Contact Support</Text>
          </TouchableOpacity>

          {/* Retry checking access */}
          <TouchableOpacity
            style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
            onPress={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={colors.slate[500]} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={colors.slate[500]} />
                <Text style={styles.retryButtonText}>Check Again</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.lg,
    opacity: 0.5,
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
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  actionsContainer: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  signOutButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.slate[100],
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
})
