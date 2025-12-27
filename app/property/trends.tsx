/**
 * Market Trends Screen
 *
 * Displays 5-year market trends from ATTOM V4 API.
 * Shows price trends, sales volume, and YoY metrics.
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
  Dimensions,
} from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { attomService } from '../../src/services'
import type { SalesTrendsResponse, TrendDataPoint } from '../../src/types'

const screenWidth = Dimensions.get('window').width

// Format currency
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K'
  return '$' + value.toLocaleString()
}

// Format percent
function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  const sign = value >= 0 ? '+' : ''
  return sign + value.toFixed(1) + '%'
}

// Interval selector
type Interval = 'yearly' | 'quarterly' | 'monthly'

// Simple bar chart component (no external deps)
function SimpleBarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <View style={styles.barChart}>
      {data.map((item, index) => (
        <View key={index} style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              {
                height: Math.max(4, (item.value / maxValue) * 120),
                backgroundColor: colors.brand[500],
              },
            ]}
          />
          <Text style={styles.barLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

// Trend line mini component
function TrendLine({ data, height = 60 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = ((max - value) / range) * height
    return { x, y }
  })

  return (
    <View style={[styles.trendLine, { height }]}>
      {points.map((point, i) => (
        <View
          key={i}
          style={[
            styles.trendDot,
            {
              left: `${point.x}%`,
              top: point.y,
              backgroundColor: i === points.length - 1 ? colors.brand[500] : colors.brand[300],
            },
          ]}
        />
      ))}
    </View>
  )
}

// Metric Card
function MetricCard({
  label,
  value,
  change,
  icon,
}: {
  label: string
  value: string
  change?: number
  icon: string
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {change !== undefined && (
        <Text
          style={[
            styles.metricChange,
            { color: change >= 0 ? colors.success[600] : colors.error[600] },
          ]}
        >
          {formatPercent(change)} YoY
        </Text>
      )}
    </View>
  )
}

export default function MarketTrendsScreen() {
  const { zip, geoIdV4, name } = useLocalSearchParams<{
    zip?: string
    geoIdV4?: string
    name?: string
  }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trendsData, setTrendsData] = useState<SalesTrendsResponse | null>(null)
  const [interval, setInterval] = useState<Interval>('yearly')

  const fetchTrends = useCallback(async () => {
    try {
      setError(null)

      let result

      if (geoIdV4) {
        // Use geoIdV4 directly
        result = await attomService.get5YearTrends(geoIdV4, interval)
      } else if (zip) {
        // Look up geoIdV4 from ZIP
        result = await attomService.getSalesTrendsByZip(zip, interval)
      } else {
        setError('No location provided')
        setLoading(false)
        return
      }

      if (!result.success) {
        setError(result.error?.message || 'Failed to fetch market trends')
        return
      }

      setTrendsData(result.data || null)
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch market trends')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [zip, geoIdV4, interval])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchTrends()
  }, [fetchTrends])

  // Calculate YoY change
  const calculateYoYChange = (trends: TrendDataPoint[]): number | undefined => {
    if (!trends || trends.length < 2) return undefined
    const current = trends[trends.length - 1].medSalePrice
    const previous = trends[trends.length - 2].medSalePrice
    if (!previous || previous === 0) return undefined
    return ((current - previous) / previous) * 100
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Market Trends' }} />
        <ScreenContainer scrollable={false}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Fetching market data...</Text>
            <Text style={styles.loadingSubtext}>Analyzing 5-year trends</Text>
          </View>
        </ScreenContainer>
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Market Trends' }} />
        <ScreenContainer>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>📊</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="outline" onPress={() => router.back()}>
              Go Back
            </Button>
          </View>
        </ScreenContainer>
      </>
    )
  }

  const { trends, summary, geographyName } = trendsData || {}
  const yoyChange = calculateYoYChange(trends || [])

  // Prepare chart data
  const priceData = (trends || []).map((t) => ({
    label: t.year.toString().slice(-2),
    value: t.medSalePrice || 0,
  }))
  const maxPrice = Math.max(...priceData.map((d) => d.value), 1)

  const volumeData = (trends || []).map((t) => ({
    label: t.year.toString().slice(-2),
    value: t.homeSaleCount || 0,
  }))
  const maxVolume = Math.max(...volumeData.map((d) => d.value), 1)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Market Trends',
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
          {/* Location Header */}
          <Card style={styles.locationCard} padding="md">
            <Text style={styles.locationLabel}>MARKET AREA</Text>
            <Text style={styles.locationName}>{geographyName || name || zip || 'Unknown'}</Text>
            {zip && <Text style={styles.locationZip}>ZIP: {zip}</Text>}
          </Card>

          {/* Interval Selector */}
          <View style={styles.intervalSelector}>
            {(['yearly', 'quarterly', 'monthly'] as Interval[]).map((int) => (
              <TouchableOpacity
                key={int}
                style={[styles.intervalButton, interval === int && styles.intervalButtonActive]}
                onPress={() => {
                  setInterval(int)
                  setLoading(true)
                }}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    interval === int && styles.intervalButtonTextActive,
                  ]}
                >
                  {int.charAt(0).toUpperCase() + int.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Key Metrics */}
          {summary && (
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="💰"
                label="Median Price"
                value={formatCurrency(summary.medianPrice12Mo)}
                change={summary.priceChange12Mo}
              />
              <MetricCard
                icon="📊"
                label="Avg Price"
                value={formatCurrency(summary.avgPrice12Mo)}
              />
              <MetricCard icon="🏠" label="Total Sales" value={(summary.totalSales12Mo || 0).toString()} />
              <MetricCard
                icon="📅"
                label="Avg DOM"
                value={summary.avgDaysOnMarket ? `${summary.avgDaysOnMarket} days` : '-'}
              />
            </View>
          )}

          {/* Price Trend Chart */}
          <Card style={styles.chartCard} padding="lg">
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Median Sale Price</Text>
              {yoyChange !== undefined && (
                <Text
                  style={[
                    styles.chartChange,
                    { color: yoyChange >= 0 ? colors.success[600] : colors.error[600] },
                  ]}
                >
                  {formatPercent(yoyChange)}
                </Text>
              )}
            </View>

            {priceData.length > 0 ? (
              <>
                <View style={styles.chartContainer}>
                  <SimpleBarChart data={priceData} maxValue={maxPrice} />
                </View>
                <TrendLine data={priceData.map((d) => d.value)} />
              </>
            ) : (
              <Text style={styles.noDataText}>No price data available</Text>
            )}
          </Card>

          {/* Sales Volume Chart */}
          <Card style={styles.chartCard} padding="lg">
            <Text style={styles.chartTitle}>Sales Volume</Text>

            {volumeData.length > 0 ? (
              <View style={styles.chartContainer}>
                <SimpleBarChart data={volumeData} maxValue={maxVolume} />
              </View>
            ) : (
              <Text style={styles.noDataText}>No volume data available</Text>
            )}
          </Card>

          {/* Trend Data Table */}
          <Card style={styles.tableCard} padding="md">
            <Text style={styles.tableTitle}>Historical Data</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Year</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Median</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Average</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Sales</Text>
            </View>
            {(trends || []).map((trend, index) => (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
              >
                <Text style={[styles.tableCell, { flex: 1 }]}>{trend.year}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>
                  {formatCurrency(trend.medSalePrice)}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>
                  {formatCurrency(trend.avgSalePrice)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{trend.homeSaleCount}</Text>
              </View>
            ))}
          </Card>

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
  // Location Header
  locationCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand[500],
  },
  locationLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  locationName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  locationZip: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
  // Interval Selector
  intervalSelector: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  intervalButtonActive: {
    backgroundColor: colors.white,
  },
  intervalButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  intervalButtonTextActive: {
    color: colors.brand[600],
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  metricValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  metricChange: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
  // Charts
  chartCard: {
    marginBottom: spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  chartChange: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  chartContainer: {
    marginBottom: spacing.sm,
  },
  noDataText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  // Bar Chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
    paddingTop: spacing.md,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 20,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  barLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  // Trend Line
  trendLine: {
    position: 'relative',
    marginTop: spacing.sm,
  },
  trendDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  // Table
  tableCard: {
    marginBottom: spacing.md,
  },
  tableTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.slate[200],
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  tableHeaderCell: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[600],
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  tableRowEven: {
    backgroundColor: colors.slate[50],
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  tableCell: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
})
