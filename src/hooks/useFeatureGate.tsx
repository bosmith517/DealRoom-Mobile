/**
 * Feature Gate Hook
 *
 * Checks if user has access to specific features based on their subscription tier.
 * Uses the pricing config as the single source of truth.
 *
 * Reads plan_key from dealroom_tenant_entitlements where app_key = 'flipmantis'
 */

import { useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PRICING_TIERS, isFeatureEnabled, getTierById, type FeatureKey, type TierId } from '../config/pricing'

interface FeatureGateResult {
  // User's current tier
  tier: TierId
  tierName: string

  // Check if a specific feature is enabled
  hasFeature: (feature: FeatureKey) => boolean

  // Specific feature checks (convenience)
  canDrive: boolean           // Driving for Dollars
  canTriage: boolean          // Swipe Triage
  canEvaluate: boolean        // On-site Evaluations
  hasFullMobileAccess: boolean

  // Deal limits
  dealLimit: number           // -1 = unlimited
  isUnlimitedDeals: boolean

  // Loading state
  isLoading: boolean
}

// Map plan_key values to mobile tier IDs
// New plan keys: free, starter, pro, team (direct mapping)
// Legacy plan keys: lite, core, enterprise (backwards compatibility)
const PLAN_TO_TIER: Record<string, TierId> = {
  // New consolidated plan names (direct mapping)
  free: 'free',
  starter: 'starter',
  pro: 'pro',
  team: 'team',
  // Legacy plan names (backwards compatibility)
  lite: 'starter',
  core: 'starter',
  enterprise: 'team',
}

export function useFeatureGate(): FeatureGateResult {
  const { entitlements, isLoading } = useAuth()

  // Get the user's tier from entitlements
  // The plan_key is now a direct column on the entitlement (not in metadata)
  const tier = useMemo((): TierId => {
    // Find the flipmantis entitlement
    const fmEntitlement = entitlements.find(
      (e) => e.app_key === 'flipmantis' && e.is_enabled
    )

    // Has FlipMantis entitlement
    if (fmEntitlement) {
      // plan_key is now a direct column, fallback to metadata for legacy data
      const planKey = fmEntitlement.plan_key ||
        (fmEntitlement.metadata?.plan_key as string) ||
        'pro'
      return PLAN_TO_TIER[planKey] || 'pro' // Default to pro if unknown plan
    }

    // No flipmantis entitlement = free tier
    return 'free'
  }, [entitlements])

  const tierConfig = getTierById(tier)

  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      return isFeatureEnabled(tier, feature)
    },
    [tier]
  )

  return {
    tier,
    tierName: tierConfig.name,
    hasFeature,
    canDrive: tierConfig.limits.drivingForDollars,
    canTriage: tierConfig.limits.swipeTriage,
    canEvaluate: tierConfig.limits.evaluations,
    hasFullMobileAccess: tierConfig.limits.mobileAccess === 'full',
    dealLimit: tierConfig.limits.deals,
    isUnlimitedDeals: tierConfig.limits.deals === -1,
    isLoading,
  }
}

/**
 * Component wrapper for feature gating
 */
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureKey
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { hasFeature, isLoading } = useFeatureGate()

  if (isLoading) return null
  if (!hasFeature(feature)) return fallback ?? null
  return <>{children}</>
}
