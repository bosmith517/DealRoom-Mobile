/**
 * Upgrade Screen
 *
 * Shown when user is authenticated but doesn't have DealRoom entitlement.
 */

import { View, Text, StyleSheet, Linking } from 'react-native'
import { CenteredContainer, Card, Button } from '../src/components'
import { colors, spacing, typography, radii } from '../src/theme'
import { useAuth } from '../src/contexts/AuthContext'

export default function UpgradeScreen() {
  const { signOut, user } = useAuth()

  const handleContactSales = () => {
    Linking.openURL('mailto:support@tradeworksflow.com?subject=DealRoom%20Pro%20Inquiry')
  }

  const handleLearnMore = () => {
    Linking.openURL('https://dealroom.tradeworksflow.com')
  }

  return (
    <CenteredContainer>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔐</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Upgrade Required</Text>
      <Text style={styles.subtitle}>
        Your account doesn't have access to DealRoom Pro
      </Text>

      {/* Features Card */}
      <Card style={styles.featuresCard} padding="lg">
        <Text style={styles.featuresTitle}>DealRoom Pro Features</Text>

        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📊</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureLabel}>Deal Pipeline</Text>
            <Text style={styles.featureDesc}>Track deals from lead to close</Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📸</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureLabel}>Field Evaluations</Text>
            <Text style={styles.featureDesc}>Guided photo capture with prompts</Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🔗</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureLabel}>Stakeholder Portals</Text>
            <Text style={styles.featureDesc}>Share deals with lenders & contractors</Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📈</Text>
          <View style={styles.featureContent}>
            <Text style={styles.featureLabel}>Underwriting Tools</Text>
            <Text style={styles.featureDesc}>ARV, comps, and profit analysis</Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button fullWidth onPress={handleContactSales}>
          Contact Sales
        </Button>
        <Button fullWidth variant="outline" onPress={handleLearnMore}>
          Learn More
        </Button>
        <Button fullWidth variant="ghost" onPress={signOut}>
          Sign Out
        </Button>
      </View>

      {/* Current Account */}
      <Text style={styles.accountInfo}>
        Signed in as {user?.email}
      </Text>
    </CenteredContainer>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warning[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  featuresCard: {
    width: '100%',
    maxWidth: 400,
    marginBottom: spacing.xl,
  },
  featuresTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  featureDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  actions: {
    width: '100%',
    maxWidth: 400,
    gap: spacing.sm,
  },
  accountInfo: {
    marginTop: spacing.xl,
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
})
