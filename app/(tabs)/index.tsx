/**
 * Dashboard Screen
 *
 * Main dashboard with KPIs and recent deals.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, shadows, radii } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'

// Stat Card Component
function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
}: {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
}) {
  const changeColor =
    changeType === 'positive'
      ? colors.success[500]
      : changeType === 'negative'
      ? colors.error[500]
      : colors.slate[500]

  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {change && <Text style={[styles.statChange, { color: changeColor }]}>{change}</Text>}
    </View>
  )
}

// Recent Deal Card
function RecentDealCard({
  address,
  stage,
  arv,
  profit,
}: {
  address: string
  stage: string
  arv: string
  profit: string
}) {
  return (
    <Card style={styles.dealCard} padding="md">
      <Text style={styles.dealAddress} numberOfLines={1}>
        {address}
      </Text>
      <View style={styles.dealMeta}>
        <View style={styles.stageBadge}>
          <Text style={styles.stageBadgeText}>{stage}</Text>
        </View>
        <Text style={styles.dealArv}>ARV: {arv}</Text>
      </View>
      <Text style={styles.dealProfit}>Est. Profit: {profit}</Text>
    </Card>
  )
}

export default function DashboardScreen() {
  const { user } = useAuth()

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>
            {user?.email?.split('@')[0] || 'Investor'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Link href="/property/new" asChild>
            <Button size="sm" variant="primary">
              + New Deal
            </Button>
          </Link>
        </View>
      </View>

      {/* KPIs */}
      <Text style={styles.sectionTitle}>Pipeline Overview</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        <StatCard
          label="Active Deals"
          value="12"
          change="+3 this month"
          changeType="positive"
        />
        <StatCard
          label="Pipeline Value"
          value="$2.4M"
          change="+$450K"
          changeType="positive"
        />
        <StatCard
          label="Closed YTD"
          value="8"
          change="$320K profit"
          changeType="positive"
        />
        <StatCard
          label="Avg. Days to Close"
          value="42"
          change="-5 days"
          changeType="positive"
        />
      </ScrollView>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <Link href="/search" asChild>
          <Button variant="outline" style={styles.quickAction}>
            🔍 Search Properties
          </Button>
        </Link>
        <Link href="/evaluation/new" asChild>
          <Button variant="outline" style={styles.quickAction}>
            📸 Start Evaluation
          </Button>
        </Link>
      </View>

      {/* Recent Deals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Deals</Text>
        <Link href="/pipeline" asChild>
          <Text style={styles.seeAll}>See All →</Text>
        </Link>
      </View>

      <RecentDealCard
        address="123 Main St, Chicago, IL"
        stage="Under Contract"
        arv="$285,000"
        profit="$42,000"
      />
      <RecentDealCard
        address="456 Oak Ave, Naperville, IL"
        stage="Due Diligence"
        arv="$425,000"
        profit="$65,000"
      />
      <RecentDealCard
        address="789 Pine Rd, Aurora, IL"
        stage="Negotiating"
        arv="$195,000"
        profit="$28,000"
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  userName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    minWidth: 140,
    ...shadows.soft,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  statChange: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
  },
  dealCard: {
    marginBottom: spacing.sm,
  },
  dealAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  dealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stageBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.full,
  },
  stageBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[700],
    fontWeight: typography.fontWeight.medium,
  },
  dealArv: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  dealProfit: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
})
