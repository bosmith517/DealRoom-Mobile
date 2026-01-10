/**
 * Pricing Configuration - Single Source of Truth
 *
 * Shared with web app: /src/config/pricing.ts
 * All pricing data for the application. Update here and it reflects everywhere.
 */

// Pricing tiers
export const PRICING_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Try before you buy',
    limits: {
      deals: 5,
      users: 1,
      mobileAccess: 'full' as const, // D4D is free, so mobile needs full access
      drivingForDollars: true,        // D4D is FREE (drives paid feature usage)
      swipeTriage: false,
      evaluations: false,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    description: 'For individual investors',
    limits: {
      deals: -1,
      users: 1,
      mobileAccess: 'full' as const,
      drivingForDollars: true,
      swipeTriage: true,
      evaluations: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99,
    description: 'For active investors',
    limits: {
      deals: -1,
      users: 3,
      mobileAccess: 'full' as const,
      drivingForDollars: true,
      swipeTriage: true,
      evaluations: true,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 199,
    description: 'For teams and companies',
    limits: {
      deals: -1,
      users: 10,
      mobileAccess: 'full' as const,
      drivingForDollars: true,
      swipeTriage: true,
      evaluations: true,
    },
  },
} as const

// Feature keys for gating
export type FeatureKey =
  | 'drivingForDollars'
  | 'swipeTriage'
  | 'evaluations'
  | 'mobileAccess'

export type TierId = keyof typeof PRICING_TIERS
export type PricingTier = typeof PRICING_TIERS[TierId]
export type TierLimits = PricingTier['limits']

// Helper to get tier by ID
export const getTierById = (id: string): PricingTier => {
  return PRICING_TIERS[id as TierId] || PRICING_TIERS.free
}

// Helper to check if a feature is enabled for a tier
export const isFeatureEnabled = (tierId: string, feature: FeatureKey): boolean => {
  const tier = getTierById(tierId)
  const value = tier.limits[feature]

  if (typeof value === 'boolean') return value
  if (feature === 'mobileAccess') return value === 'full'
  return false
}

// Helper to get deal limit (-1 = unlimited)
export const getDealLimit = (tierId: string): number => {
  return getTierById(tierId).limits.deals
}
