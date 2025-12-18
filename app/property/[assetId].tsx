/**
 * Property Detail Screen
 *
 * Shows property details, comps, underwriting, and evaluation history.
 */

import { useLocalSearchParams, Stack } from 'expo-router'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'

export default function PropertyDetailScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>()

  return (
    <>
      <Stack.Screen
        options={{
          title: '123 Main St',
          headerShown: true,
        }}
      />
      <ScreenContainer>
        {/* Property Header */}
        <Card style={styles.headerCard} padding="lg">
          <Text style={styles.propertyAddress}>123 Main Street</Text>
          <Text style={styles.propertyCity}>Chicago, IL 60601</Text>
          <View style={styles.propertyMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>3</Text>
              <Text style={styles.metaLabel}>Beds</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>2</Text>
              <Text style={styles.metaLabel}>Baths</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>1,450</Text>
              <Text style={styles.metaLabel}>Sqft</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>1985</Text>
              <Text style={styles.metaLabel}>Built</Text>
            </View>
          </View>
        </Card>

        {/* Underwriting Summary */}
        <Text style={styles.sectionTitle}>Underwriting</Text>
        <Card padding="md">
          <View style={styles.underwritingRow}>
            <Text style={styles.underwritingLabel}>ARV</Text>
            <Text style={styles.underwritingValue}>$285,000</Text>
          </View>
          <View style={styles.underwritingRow}>
            <Text style={styles.underwritingLabel}>Offer Price</Text>
            <Text style={styles.underwritingValue}>$185,000</Text>
          </View>
          <View style={styles.underwritingRow}>
            <Text style={styles.underwritingLabel}>Rehab Budget</Text>
            <Text style={styles.underwritingValue}>$45,000</Text>
          </View>
          <View style={[styles.underwritingRow, styles.underwritingTotal]}>
            <Text style={styles.underwritingLabelBold}>Est. Profit</Text>
            <Text style={styles.underwritingValueProfit}>$42,000</Text>
          </View>
        </Card>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsRow}>
          <Button variant="primary" style={styles.actionButton}>
            📸 Start Evaluation
          </Button>
          <Button variant="outline" style={styles.actionButton}>
            🔗 Share Portal
          </Button>
        </View>

        {/* Evaluation History */}
        <Text style={styles.sectionTitle}>Evaluations</Text>
        <Card padding="md">
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Text style={styles.emptyStateText}>No evaluations yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Start an evaluation to capture photos
            </Text>
          </View>
        </Card>

        {/* Asset ID for debugging */}
        <Text style={styles.debugText}>Asset ID: {assetId}</Text>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  propertyAddress: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  propertyCity: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  metaLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.slate[200],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  underwritingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  underwritingTotal: {
    borderBottomWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  underwritingLabel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  underwritingLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  underwritingValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  underwritingValueProfit: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyStateIcon: {
    fontSize: 40,
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
  debugText: {
    marginTop: spacing.xl,
    fontSize: typography.fontSize.xs,
    color: colors.slate[300],
    textAlign: 'center',
  },
})
