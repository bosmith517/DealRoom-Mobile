/**
 * Portal Screen
 *
 * Public access portal via token. No authentication required.
 */

import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { supabase } from '../../src/contexts/AuthContext'

interface PortalData {
  isValid: boolean
  stakeholderName?: string
  stakeholderType?: string
  property?: {
    address: string
    city: string
    state: string
  }
  capabilities: {
    view_overview?: boolean
    view_photos?: boolean
    upload_photos?: boolean
    comment?: boolean
  }
}

export default function PortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [portalData, setPortalData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Invalid portal link')
        setIsLoading(false)
        return
      }

      try {
        // Call the validate_portal_token_v2 RPC
        const { data, error: rpcError } = await supabase.rpc(
          'validate_portal_token_v2',
          { p_token: token }
        )

        if (rpcError) throw rpcError

        if (data && data.is_valid) {
          setPortalData({
            isValid: true,
            stakeholderName: data.stakeholder_name,
            stakeholderType: data.stakeholder_type,
            property: data.property,
            capabilities: data.capabilities || {},
          })
        } else {
          setError('This portal link is invalid or has expired')
        }
      } catch (err) {
        console.error('Portal validation error:', err)
        setError('Unable to validate portal access')
      } finally {
        setIsLoading(false)
      }
    }

    validateToken()
  }, [token])

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Validating access...</Text>
        </View>
      </ScreenContainer>
    )
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome,</Text>
        <Text style={styles.stakeholderName}>
          {portalData?.stakeholderName || 'Guest'}
        </Text>
        {portalData?.stakeholderType && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {portalData.stakeholderType.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Property Info */}
      {portalData?.property && (
        <Card style={styles.propertyCard} padding="md">
          <Text style={styles.propertyLabel}>Property</Text>
          <Text style={styles.propertyAddress}>
            {portalData.property.address}
          </Text>
          <Text style={styles.propertyCity}>
            {portalData.property.city}, {portalData.property.state}
          </Text>
        </Card>
      )}

      {/* Available Actions */}
      <Text style={styles.sectionTitle}>Available Actions</Text>
      <View style={styles.actionsGrid}>
        {portalData?.capabilities.view_overview && (
          <Card style={styles.actionCard} padding="md">
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>View Overview</Text>
          </Card>
        )}
        {portalData?.capabilities.view_photos && (
          <Card style={styles.actionCard} padding="md">
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionLabel}>View Photos</Text>
          </Card>
        )}
        {portalData?.capabilities.upload_photos && (
          <Card style={styles.actionCard} padding="md">
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionLabel}>Upload Photos</Text>
          </Card>
        )}
        {portalData?.capabilities.comment && (
          <Card style={styles.actionCard} padding="md">
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionLabel}>Comments</Text>
          </Card>
        )}
      </View>

      {/* Pending Actions */}
      <Text style={styles.sectionTitle}>Pending Requests</Text>
      <Card padding="lg">
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>✅</Text>
          <Text style={styles.emptyStateText}>No pending actions</Text>
          <Text style={styles.emptyStateSubtext}>
            You're all caught up!
          </Text>
        </View>
      </Card>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  welcomeText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  stakeholderName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[700],
    textTransform: 'capitalize',
  },
  propertyCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand[500],
  },
  propertyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  propertyAddress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  propertyCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: '48%',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
})
