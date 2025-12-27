/**
 * Feature Gate Hook
 *
 * Checks if user has access to specific features based on their subscription tier.
 * Uses the pricing config as the single source of truth.
 *
 * Reads plan_key from dealroom_tenant_entitlements.metadata.plan_key
 * where app_key = 'dealroom'
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

// Map web app plan keys to mobile tier IDs
const PLAN_TO_TIER: Record<string, TierId> = {
  free: 'free',
  lite: 'starter',    // lite -> starter
  core: 'starter',    // core -> starter
  pro: 'pro',
  enterprise: 'team', // enterprise -> team
}

export function useFeatureGate(): FeatureGateResult {
  const { entitlements, isLoading } = useAuth()

  // Get the user's tier from entitlements
  // The plan is stored in metadata.plan_key of the 'dealroom' entitlement
  const tier = useMemo((): TierId => {
    // Find the dealroom entitlement
    const dealroomEntitlement = entitlements.find(
      (e) => e.app_key === 'dealroom' && e.is_enabled
    )

    // Has dealroom entitlement
    if (dealroomEntitlement) {
      if (dealroomEntitlement.metadata?.plan_key) {
        const planKey = dealroomEntitlement.metadata.plan_key as string
        return PLAN_TO_TIER[planKey] || 'pro' // Default to pro if unknown plan
      }
      // Has entitlement but no plan_key = default to pro (matches web behavior)
      return 'pro'
    }

    // No dealroom entitlement = free tier
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
