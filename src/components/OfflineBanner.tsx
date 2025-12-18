/**
 * OfflineBanner
 *
 * Shows offline status and pending sync count.
 * Appears at the top of screens when offline or syncing.
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useOffline } from '../contexts/OfflineContext'
import { colors, spacing, typography } from '../theme'

export function OfflineBanner() {
  const {
    isOnline,
    isSyncing,
    pendingUploads,
    pendingMutations,
    sync,
  } = useOffline()

  const totalPending = pendingUploads + pendingMutations

  // Don't show banner if online and nothing pending
  if (isOnline && !isSyncing && totalPending === 0) {
    return null
  }

  // Determine banner state
  const isOffline = !isOnline
  const hasPending = totalPending > 0

  return (
    <View style={[styles.container, isOffline ? styles.offline : styles.syncing]}>
      <View style={styles.content}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.icon}>{isOffline ? '📡' : '☁️'}</Text>
        )}

        <Text style={styles.text}>
          {isOffline
            ? `Offline${hasPending ? ` • ${totalPending} pending` : ''}`
            : isSyncing
            ? 'Syncing...'
            : `${totalPending} pending`}
        </Text>

        {isOnline && hasPending && !isSyncing && (
          <TouchableOpacity onPress={sync} style={styles.syncButton}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  offline: {
    backgroundColor: colors.warning[500],
  },
  syncing: {
    backgroundColor: colors.brand[500],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  syncButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
})
