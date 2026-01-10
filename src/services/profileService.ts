/**
 * Profile Service
 *
 * Service for managing user profile data that persists to Supabase.
 * Uses tenant_users as the single source of truth for display data.
 * Uses investor_profiles for investor-specific onboarding/preferences.
 */

import { supabase } from '../lib/supabase'

export interface InvestorProfile {
  id: string
  user_id: string
  tenant_id: string
  display_name?: string
  experience_level?: string
  total_deals_completed?: number
  primary_strategy?: string
  strategies_interested?: string[]
  capital_available?: string
  primary_goal?: string
  time_availability?: string
  risk_tolerance?: string
  home_market?: string
  home_zips?: string[]
  onboarding_completed?: boolean
  onboarding_step?: number
  created_at: string
  updated_at: string
}

export interface UserDisplayProfile {
  user_id: string
  tenant_id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  custom_display_name: string | null
  display_name: string | null  // computed: custom_display_name || full_name
}

export const profileService = {
  /**
   * Get the current user's display profile from tenant_users (source of truth)
   * @deprecated Use getProfileById() instead to avoid stale cached user issues
   */
  async getProfile(): Promise<{
    data: UserDisplayProfile | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      return this.getProfileById(user.id)
    } catch (err) {
      console.error('[profileService] Error fetching profile:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get a user's display profile by user ID from tenant_users (source of truth)
   * This method is preferred over getProfile() because it accepts the user ID directly
   * from AuthContext, avoiding potential stale cached user data in the Supabase client.
   */
  async getProfileById(userId: string): Promise<{
    data: UserDisplayProfile | null
    error: Error | null
  }> {
    try {
      if (!userId) throw new Error('User ID is required')

      const { data, error } = await supabase
        .from('tenant_users')
        .select('user_id, tenant_id, full_name, first_name, last_name, email, avatar_url, custom_display_name')
        .eq('user_id', userId)
        .single()

      if (error) throw error

      // Compute display_name for backwards compatibility
      const profile: UserDisplayProfile = {
        ...data,
        display_name: data.custom_display_name || data.full_name || null
      }

      return { data: profile, error: null }
    } catch (err) {
      console.error('[profileService] Error fetching profile by ID:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get or create the current user's investor profile (for onboarding/preferences)
   */
  async getInvestorProfile(): Promise<{
    data: InvestorProfile | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_investor_profile')

      if (error) throw error

      return { data: data as InvestorProfile, error: null }
    } catch (err) {
      console.error('[profileService] Error fetching investor profile:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Update the current user's investor profile
   */
  async updateInvestorProfile(updates: Partial<InvestorProfile>): Promise<{
    data: InvestorProfile | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase.rpc('update_investor_profile', {
        p_updates: updates,
      })

      if (error) throw error

      return { data: data as InvestorProfile, error: null }
    } catch (err) {
      console.error('[profileService] Error updating investor profile:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Update display name in tenant_users (source of truth)
   */
  async updateDisplayName(displayName: string): Promise<{
    data: UserDisplayProfile | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tenant_users')
        .update({
          custom_display_name: displayName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('user_id, tenant_id, full_name, first_name, last_name, email, avatar_url, custom_display_name')
        .single()

      if (error) throw error

      const profile: UserDisplayProfile = {
        ...data,
        display_name: data.custom_display_name || data.full_name || null
      }

      return { data: profile, error: null }
    } catch (err) {
      console.error('[profileService] Error updating display name:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get the display name from the user's profile
   */
  async getDisplayName(): Promise<string | null> {
    const { data } = await this.getProfile()
    return data?.display_name || null
  },

  /**
   * Get monthly usage stats for the current user
   */
  async getMonthlyStats(): Promise<{
    data: {
      leadsCapured: number
      dealsInProgress: number
      dealsClosedThisMonth: number
      projectedProfit: number
      tasksCompleted: number
    } | null
    error: Error | null
  }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      // Get current month boundaries
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      // Fetch leads captured this month
      const { count: leadsCount } = await supabase
        .from('dealroom_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)

      // Fetch deals in progress
      const { count: dealsInProgress } = await supabase
        .from('dealroom_deals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Fetch deals closed this month
      const { count: dealsClosed } = await supabase
        .from('dealroom_deals')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'closed')
        .gte('updated_at', startOfMonth)
        .lte('updated_at', endOfMonth)

      // Fetch projected profit from active deals
      const { data: profitData } = await supabase
        .from('dealroom_deals')
        .select('expected_profit')
        .eq('status', 'active')

      const projectedProfit = profitData?.reduce(
        (sum, d) => sum + (d.expected_profit || 0),
        0
      ) || 0

      // Fetch tasks completed this month
      const { count: tasksCompleted } = await supabase
        .from('dealroom_followups')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth)
        .lte('completed_at', endOfMonth)

      return {
        data: {
          leadsCapured: leadsCount || 0,
          dealsInProgress: dealsInProgress || 0,
          dealsClosedThisMonth: dealsClosed || 0,
          projectedProfit,
          tasksCompleted: tasksCompleted || 0,
        },
        error: null,
      }
    } catch (err) {
      console.error('[profileService] Error fetching monthly stats:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get recently viewed/updated deals
   */
  async getRecentDeals(limit: number = 3): Promise<{
    data: Array<{
      id: string
      name: string
      address: string
      stage: string
      lastViewed: string
    }>
    error: Error | null
  }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: [], error: new Error('Not authenticated') }
      }

      // Get recent deals by updated_at
      const { data, error } = await supabase
        .from('dealroom_deals')
        .select(`
          id,
          deal_name,
          stage,
          updated_at,
          property:dealroom_properties(address_line1)
        `)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[profileService] Error fetching recent deals:', error)
        return { data: [], error }
      }

      return {
        data: (data || []).map((d) => ({
          id: d.id,
          name: d.deal_name || 'Unnamed Deal',
          address: d.property?.address_line1 || 'No address',
          stage: d.stage,
          lastViewed: d.updated_at,
        })),
        error: null,
      }
    } catch (err) {
      console.error('[profileService] Error:', err)
      return { data: [], error: err as Error }
    }
  },

  /**
   * Get integration status (connected services)
   */
  async getIntegrationStatus(): Promise<{
    data: Array<{ name: string; connected: boolean; lastSync?: string }>
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_api_credentials')
        .select('provider, is_active, last_used_at')

      if (error) {
        console.error('[profileService] Error fetching integrations:', error)
        return { data: [], error }
      }

      const integrations = [
        {
          name: 'Skip Trace',
          connected: data?.some((c) => c.provider === 'batchdata' && c.is_active) || false,
          lastSync: data?.find((c) => c.provider === 'batchdata')?.last_used_at,
        },
        {
          name: 'Property Data',
          connected: data?.some((c) => c.provider === 'attom' && c.is_active) || false,
          lastSync: data?.find((c) => c.provider === 'attom')?.last_used_at,
        },
      ]

      return { data: integrations, error: null }
    } catch (err) {
      console.error('[profileService] Error:', err)
      return { data: [], error: err as Error }
    }
  },
}
