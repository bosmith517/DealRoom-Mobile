/**
 * Comparables Screen
 *
 * Displays auto-matched comparable sales from ATTOM V2 API.
 * Shows ARV analysis with confidence scoring.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { attomService, type ComparablesResponse, type ComparableSale } from '../../src/services'

// Format currency
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  return '$' + value.toLocaleString()
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Confidence Badge
function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: 'Low Confidence', color: colors.error[500], bg: colors.error[50] },
    medium: { label: 'Medium Confidence', color: colors.warning[600], bg: colors.warning[50] },
    high: { label: 'High Confidence', color: colors.success[600], bg: colors.success[50] },
  }
  const c = config[confidence]
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.confidenceBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  )
}

// Comparable Sale Card
function CompCard({ comp, index }: { comp: ComparableSale; index: number }) {
  return (
    <Card style={styles.compCard} padding="md">
      <View style={styles.compHeader}>
        <View style={styles.compRank}>
          <Text style={styles.compRankText}>#{index + 1}</Text>
        </View>
        <View style={styles.compDistance}>
          <Text style={styles.compDistanceText}>{comp.distance.toFixed(2)} mi</Text>
        </View>
      </View>

      <Text style={styles.compAddress}>{comp.address}</Text>
      <Text style={styles.compCity}>
        {[comp.city, comp.state, comp.zip].filter(Boolean).join(', ')}
      </Text>

      {/* Sale Info */}
      <View style={styles.compSaleRow}>
        <View style={styles.compSaleItem}>
          <Text style={styles.compSaleLabel}>Sale Price</Text>
          <Text style={styles.compSaleValue}>{formatCurrency(comp.salePrice)}</Text>
        </View>
        <View style={styles.compSaleItem}>
          <Text style={styles.compSaleLabel}>$/sqft</Text>
          <Text style={styles.compSaleValue}>{formatCurrency(comp.pricePerSqft)}</Text>
        </View>
        <View style={styles.compSaleItem}>
          <Text style={styles.compSaleLabel}>Sale Date</Text>
          <Text style={styles.compSaleValue}>{formatDate(comp.saleDate)}</Text>
        </View>
      </View>

      {/* Property Details */}
      <View style={styles.compDetails}>
        {comp.bedrooms > 0 && (
          <View style={styles.compDetailChip}>
            <Text style={styles.compDetailText}>{comp.bedrooms} bed</Text>
          </View>
        )}
        {comp.bathrooms > 0 && (
          <View style={styles.compDetailChip}>
            <Text style={styles.compDetailText}>{comp.bathrooms} bath</Text>
          </View>
        )}
        {comp.sqft > 0 && (
          <View style={styles.compDetailChip}>
            <Text style={styles.compDetailText}>{comp.sqft.toLocaleString()} sqft</Text>
          </View>
        )}
        {comp.yearBuilt > 0 && (
          <View style={styles.compDetailChip}>
            <Text style={styles.compDetailText}>Built {comp.yearBuilt}</Text>
          </View>
        )}
      </View>

      {/* Days Ago */}
      <View style={styles.compFooter}>
        <Text style={styles.compDaysAgo}>{comp.daysAgo} days ago</Text>
        {comp.buyerName && (
          <Text style={styles.compBuyer} numberOfLines={1}>
            Buyer: {comp.buyerName}
          </Text>
        )}
      </View>
    </Card>
  )
}

export default function CompsScreen() {
  const { attomId, address } = useLocalSearchParams<{ attomId: string; address?: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compsData, setCompsData] = useState<ComparablesResponse | null>(null)

  const fetchComps = useCallback(async () => {
    if (!attomId) {
      setError('No property ID provided')
      setLoading(false)
      return
    }

    try {
      setError(null)
      const result = await attomService.getComparablesWithARV(attomId)

      if (!result.success) {
        setError(result.error?.message || 'Failed to fetch comparables')
        return
      }

      setCompsData(result.data || null)
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch comparables')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [attomId])

  useEffect(() => {
    fetchComps()
  }, [fetchComps])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchComps()
  }, [fetchComps])

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Comparables' }} />
        <ScreenContainer scrollable={false}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Fetching comparables...</Text>
            <Text style={styles.loadingSubtext}>Analyzing nearby sales</Text>
          </View>
        </ScreenContainer>
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Comparables' }} />
        <ScreenContainer>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="outline" onPress={() => router.back()}>
              Go Back
            </Button>
          </View>
        </ScreenContainer>
      </>
    )
  }

  const { subject, comparables, arvAnalysis } = compsData || {}

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Comparables',
          headerShown: true,
        }}
      />
      <ScreenContainer scrollable={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
        >
          {/* Subject Property */}
          {subject && (
            <Card style={styles.subjectCard} padding="md">
              <Text style={styles.subjectLabel}>SUBJECT PROPERTY</Text>
              <Text style={styles.subjectAddress}>{subject.address}</Text>
              <Text style={styles.subjectCity}>
                {[subject.city, subject.state, subject.zip].filter(Boolean).join(', ')}
              </Text>
              <View style={styles.subjectDetails}>
                <Text style={styles.subjectDetail}>
                  {subject.bedrooms} bed • {subject.bathrooms} bath • {subject.sqft?.toLocaleString()} sqft
                </Text>
                <Text style={styles.subjectDetail}>Built {subject.yearBuilt}</Text>
              </View>
              {subject.lastSalePrice && (
                <View style={styles.subjectLastSale}>
                  <Text style={styles.lastSaleLabel}>Last Sale:</Text>
                  <Text style={styles.lastSaleValue}>{formatCurrency(subject.lastSalePrice)}</Text>
                  {subject.lastSaleDate && (
                    <Text style={styles.lastSaleDate}>({formatDate(subject.lastSaleDate)})</Text>
                  )}
                </View>
              )}
            </Card>
          )}

          {/* ARV Analysis */}
          {arvAnalysis && (
            <Card style={styles.arvCard} padding="lg">
              <View style={styles.arvHeader}>
                <Text style={styles.arvTitle}>ARV Analysis</Text>
                <ConfidenceBadge confidence={arvAnalysis.confidence} />
              </View>

              <View style={styles.arvMainValue}>
                <Text style={styles.arvLabel}>Estimated ARV</Text>
                <Text style={styles.arvValue}>{formatCurrency(arvAnalysis.arv)}</Text>
                <Text style={styles.arvRange}>
                  Range: {formatCurrency(arvAnalysis.arvLow)} - {formatCurrency(arvAnalysis.arvHigh)}
                </Text>
              </View>

              <View style={styles.arvMetrics}>
                <View style={styles.arvMetric}>
                  <Text style={styles.arvMetricLabel}>Median Price</Text>
                  <Text style={styles.arvMetricValue}>{formatCurrency(arvAnalysis.medianPrice)}</Text>
                </View>
                <View style={styles.arvMetricDivider} />
                <View style={styles.arvMetric}>
                  <Text style={styles.arvMetricLabel}>Avg $/sqft</Text>
                  <Text style={styles.arvMetricValue}>{formatCurrency(arvAnalysis.avgPricePerSqft)}</Text>
                </View>
                <View style={styles.arvMetricDivider} />
                <View style={styles.arvMetric}>
                  <Text style={styles.arvMetricLabel}>Comps Used</Text>
                  <Text style={styles.arvMetricValue}>{comparables?.length || 0}</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Comparables List */}
          <View style={styles.compsSection}>
            <Text style={styles.sectionTitle}>
              Comparable Sales ({comparables?.length || 0})
            </Text>

            {comparables && comparables.length > 0 ? (
              comparables.map((comp, index) => (
                <CompCard key={comp.attomId || index} comp={comp} index={index} />
              ))
            ) : (
              <Card padding="lg">
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>🏠</Text>
                  <Text style={styles.emptyStateText}>No comparable sales found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    There may not be enough recent sales in this area
                  </Text>
                </View>
              </Card>
            )}
          </View>

          {/* Footer spacing */}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  loadingSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: 'center',
  },
  // Subject Property
  subjectCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand[500],
  },
  subjectLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  subjectAddress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  subjectCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
  },
  subjectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  subjectDetail: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  subjectLastSale: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    gap: spacing.xs,
  },
  lastSaleLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  lastSaleValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  lastSaleDate: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
  // ARV Analysis
  arvCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
  },
  arvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  arvTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  confidenceBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  arvMainValue: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand[100],
  },
  arvLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginBottom: spacing.xs,
  },
  arvValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[700],
  },
  arvRange: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
  arvMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  arvMetric: {
    alignItems: 'center',
    flex: 1,
  },
  arvMetricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  arvMetricValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  arvMetricDivider: {
    width: 1,
    backgroundColor: colors.brand[100],
  },
  // Comps Section
  compsSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  // Comp Card
  compCard: {
    marginBottom: spacing.sm,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  compRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  compRankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[600],
  },
  compDistance: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand[50],
    borderRadius: radii.full,
  },
  compDistanceText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  compAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  compCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.sm,
  },
  compSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  compSaleItem: {
    alignItems: 'center',
  },
  compSaleLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  compSaleValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  compDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  compDetailChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.slate[100],
    borderRadius: radii.full,
  },
  compDetailText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  compFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compDaysAgo: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  compBuyer: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
  // Empty State
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
    textAlign: 'center',
  },
})
