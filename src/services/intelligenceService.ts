/**
 * Intelligence Service
 *
 * Reads from n8n workflow output tables:
 * - dealroom_market_alerts - Market notifications
 * - dealroom_seller_motivation_scores - Seller motivation (1-100)
 * - dealroom_investor_patterns - Learned patterns/biases
 * - dealroom_market_pulse_data - Market data by ZIP
 *
 * These tables are populated by n8n workflows running on the server.
 */

import { supabase } from '../lib/supabase'
import type {
  MarketAlert,
  MarketAlertType,
  AlertSeverity,
  SellerMotivationScore,
  InvestorPattern,
  PatternInsight,
  MarketPulseData,
  PatternType,
  PassedDeal,
  CreatePassedDealInput,
  DealOutcome,
  CreateOutcomeInput,
  UpdateOutcomeInput,
} from '../types/intelligence'

// ============================================================================
// Market Alerts
// ============================================================================

/**
 * Get market alerts for the current tenant
 */
export async function getMarketAlerts(options?: {
  unreadOnly?: boolean
  limit?: number
  severity?: AlertSeverity[]
  alertTypes?: MarketAlertType[]
}): Promise<{ data: MarketAlert[]; error: Error | null }> {
  try {
    let query = supabase
      .from('dealroom_market_alerts')
      .select('*')
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })

    if (options?.unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (options?.severity && options.severity.length > 0) {
      query = query.in('severity', options.severity)
    }

    if (options?.alertTypes && options.alertTypes.length > 0) {
      query = query.in('alert_type', options.alertTypes)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    } else {
      query = query.limit(50)
    }

    const { data, error } = await query

    if (error) throw error

    return { data: data as MarketAlert[], error: null }
  } catch (err) {
    console.error('Error fetching market alerts:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Get count of unread alerts
 */
export async function getUnreadAlertCount(): Promise<{ data: number; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('dealroom_market_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('is_dismissed', false)

    if (error) throw error

    return { data: count || 0, error: null }
  } catch (err) {
    console.error('Error counting unread alerts:', err)
    return { data: 0, error: err as Error }
  }
}

/**
 * Get urgent/significant alerts only (for banner display)
 */
export async function getUrgentAlerts(limit = 3): Promise<{ data: MarketAlert[]; error: Error | null }> {
  return getMarketAlerts({
    unreadOnly: true,
    severity: ['urgent', 'significant'],
    limit,
  })
}

/**
 * Mark an alert as read
 */
export async function markAlertRead(alertId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('dealroom_market_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    if (error) throw error

    return { success: true, error: null }
  } catch (err) {
    console.error('Error marking alert read:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Dismiss an alert (hide from view)
 */
export async function dismissAlert(alertId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('dealroom_market_alerts')
      .update({
        is_dismissed: true,
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    if (error) throw error

    return { success: true, error: null }
  } catch (err) {
    console.error('Error dismissing alert:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsRead(): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('dealroom_market_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('is_read', false)
      .eq('is_dismissed', false)

    if (error) throw error

    return { success: true, error: null }
  } catch (err) {
    console.error('Error marking all alerts read:', err)
    return { success: false, error: err as Error }
  }
}

// ============================================================================
// Seller Motivation Scores
// ============================================================================

/**
 * Get motivation score for a lead or deal
 */
export async function getMotivationScore(params: {
  leadId?: string
  dealId?: string
  attomId?: string
}): Promise<{ data: SellerMotivationScore | null; error: Error | null }> {
  try {
    let query = supabase
      .from('dealroom_seller_motivation_scores')
      .select('*')

    if (params.leadId) {
      query = query.eq('lead_id', params.leadId)
    } else if (params.dealId) {
      query = query.eq('deal_id', params.dealId)
    } else if (params.attomId) {
      query = query.eq('attom_id', params.attomId)
    } else {
      return { data: null, error: new Error('Must provide leadId, dealId, or attomId') }
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error

    return { data: data as SellerMotivationScore | null, error: null }
  } catch (err) {
    console.error('Error fetching motivation score:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get motivation scores for multiple leads (for list display)
 */
export async function getMotivationScoresForLeads(leadIds: string[]): Promise<{
  data: Map<string, SellerMotivationScore>
  error: Error | null
}> {
  try {
    if (leadIds.length === 0) {
      return { data: new Map(), error: null }
    }

    const { data, error } = await supabase
      .from('dealroom_seller_motivation_scores')
      .select('*')
      .in('lead_id', leadIds)

    if (error) throw error

    const scoreMap = new Map<string, SellerMotivationScore>()
    for (const score of data || []) {
      if (score.lead_id) {
        scoreMap.set(score.lead_id, score as SellerMotivationScore)
      }
    }

    return { data: scoreMap, error: null }
  } catch (err) {
    console.error('Error fetching motivation scores:', err)
    return { data: new Map(), error: err as Error }
  }
}

// ============================================================================
// Investor Patterns
// ============================================================================

/**
 * Get all patterns for the current investor
 */
export async function getInvestorPatterns(): Promise<{ data: InvestorPattern[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_investor_patterns')
      .select('*')
      .order('confidence', { ascending: false })

    if (error) throw error

    return { data: data as InvestorPattern[], error: null }
  } catch (err) {
    console.error('Error fetching investor patterns:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Get pattern insights with formatted descriptions
 */
export async function getPatternInsights(): Promise<{ data: PatternInsight[]; error: Error | null }> {
  try {
    const { data: patterns, error } = await getInvestorPatterns()
    if (error) throw error

    const insights: PatternInsight[] = []

    for (const pattern of patterns) {
      // Only include patterns with sufficient confidence
      if (!pattern.confidence || pattern.confidence < 60) continue

      const data = pattern.pattern_data as Record<string, unknown>

      let title = ''
      let description = ''

      switch (pattern.pattern_type) {
        case 'arv_bias': {
          const arvBias = (data.bias_percent as number) || 0
          title = arvBias > 0 ? 'Overestimating ARV' : 'Underestimating ARV'
          description = `Your ARV estimates average ${Math.abs(arvBias).toFixed(1)}% ${arvBias > 0 ? 'higher' : 'lower'} than actual.`
          break
        }

        case 'rehab_bias': {
          const rehabBias = (data.bias_percent as number) || 0
          title = rehabBias > 0 ? 'Underestimating Rehab' : 'Overestimating Rehab'
          description = `Your rehab budgets are ${Math.abs(rehabBias).toFixed(1)}% ${rehabBias > 0 ? 'lower' : 'higher'} than actual.`
          break
        }

        case 'hold_time_bias': {
          const holdBias = (data.bias_days as number) || 0
          title = holdBias > 0 ? 'Projects Taking Longer' : 'Finishing Early'
          description = `Projects take ${Math.abs(holdBias)} days ${holdBias > 0 ? 'longer' : 'less'} than expected.`
          break
        }

        case 'property_type_success': {
          const bestType = (data.best_property_type as string) || 'SFR'
          title = `Best: ${bestType.toUpperCase()}`
          description = `Your ${bestType} deals have the highest profit margins.`
          break
        }

        default:
          continue
      }

      insights.push({
        pattern_type: pattern.pattern_type,
        title,
        description,
        suggestion: pattern.suggestion || '',
        confidence: pattern.confidence,
        sample_size: pattern.sample_size || 0,
      })
    }

    return { data: insights, error: null }
  } catch (err) {
    console.error('Error getting pattern insights:', err)
    return { data: [], error: err as Error }
  }
}

// ============================================================================
// Market Pulse Data
// ============================================================================

/**
 * Get market pulse data for a ZIP code
 */
export async function getMarketPulseData(zipCode: string): Promise<{
  data: MarketPulseData[]
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('dealroom_market_pulse_data')
      .select('*')
      .eq('zip_code', zipCode)
      .order('period_date', { ascending: false })
      .limit(12) // Last 12 months

    if (error) throw error

    return { data: data as MarketPulseData[], error: null }
  } catch (err) {
    console.error('Error fetching market pulse data:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Get latest market data for all tracked ZIPs
 */
export async function getAllMarketPulseData(): Promise<{
  data: MarketPulseData[]
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('dealroom_market_pulse_data')
      .select('*')
      .order('period_date', { ascending: false })

    if (error) throw error

    // Deduplicate to get latest for each ZIP
    const latestByZip = new Map<string, MarketPulseData>()
    for (const item of data || []) {
      if (!latestByZip.has(item.zip_code)) {
        latestByZip.set(item.zip_code, item as MarketPulseData)
      }
    }

    return { data: Array.from(latestByZip.values()), error: null }
  } catch (err) {
    console.error('Error fetching all market pulse data:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Get ZIP codes being tracked (from deals and leads)
 */
export async function getTrackedZipCodes(): Promise<{
  data: { zip_code: string; city?: string; state?: string; deal_count: number }[]
  error: Error | null
}> {
  try {
    // Get ZIPs from deals
    const { data: dealZips, error: dError } = await supabase
      .from('dealroom_deals')
      .select('zip_code, city, state')
      .not('zip_code', 'is', null)

    if (dError) console.warn('Error fetching deal zips:', dError)

    // Get ZIPs from leads
    const { data: leadZips, error: lError } = await supabase
      .from('dealroom_leads')
      .select('zip, city, state')
      .not('zip', 'is', null)

    if (lError) console.warn('Error fetching lead zips:', lError)

    // Combine and count
    const zipMap = new Map<string, { city?: string; state?: string; count: number }>()

    for (const d of dealZips || []) {
      if (d.zip_code) {
        const existing = zipMap.get(d.zip_code)
        if (existing) {
          existing.count++
        } else {
          zipMap.set(d.zip_code, { city: d.city, state: d.state, count: 1 })
        }
      }
    }

    for (const l of leadZips || []) {
      if (l.zip) {
        const existing = zipMap.get(l.zip)
        if (existing) {
          existing.count++
        } else {
          zipMap.set(l.zip, { city: l.city, state: l.state, count: 1 })
        }
      }
    }

    const result = Array.from(zipMap.entries())
      .map(([zip_code, data]) => ({
        zip_code,
        city: data.city,
        state: data.state,
        deal_count: data.count,
      }))
      .sort((a, b) => b.deal_count - a.deal_count)

    return { data: result, error: null }
  } catch (err) {
    console.error('Error fetching tracked ZIP codes:', err)
    return { data: [], error: err as Error }
  }
}

// ============================================================================
// Helper: Get severity color
// ============================================================================

export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'urgent':
      return '#EF4444' // red-500
    case 'significant':
      return '#F97316' // orange-500
    case 'notable':
      return '#3B82F6' // blue-500
    case 'info':
    default:
      return '#6B7280' // gray-500
  }
}

export function getSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'urgent':
      return 'Urgent'
    case 'significant':
      return 'Important'
    case 'notable':
      return 'Notable'
    case 'info':
    default:
      return 'Info'
  }
}

export function getAlertTypeIcon(alertType: MarketAlertType): string {
  switch (alertType) {
    case 'price_drop':
      return '📉'
    case 'inventory_spike':
      return '📦'
    case 'investor_surge':
      return '💰'
    case 'permit_activity':
      return '🔨'
    case 'dom_change':
      return '⏱️'
    case 'new_listings_surge':
      return '🏠'
    case 'market_shift':
      return '📊'
    case 'opportunity':
      return '⭐'
    default:
      return '📣'
  }
}

export function getMotivationColor(level?: string): string {
  switch (level) {
    case 'very_high':
      return '#22C55E' // green-500
    case 'high':
      return '#84CC16' // lime-500
    case 'medium':
      return '#F59E0B' // amber-500
    case 'low':
    default:
      return '#6B7280' // gray-500
  }
}

// ============================================================================
// Passed Deals
// ============================================================================

/**
 * Create a passed deal record
 */
export async function createPassedDeal(input: CreatePassedDealInput): Promise<PassedDeal | null> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userData.user?.id)
      .single()

    const { data, error } = await supabase
      .from('dealroom_passed_deals')
      .insert({
        tenant_id: tenantUser?.tenant_id,
        user_id: userData.user?.id,
        ...input,
      })
      .select()
      .single()

    if (error) throw error
    return data as PassedDeal
  } catch (err) {
    console.error('Error creating passed deal:', err)
    return null
  }
}

/**
 * Get passed deals
 */
export async function getPassedDeals(options?: {
  isWatching?: boolean
  limit?: number
}): Promise<{ data: PassedDeal[]; error: Error | null }> {
  try {
    let query = supabase
      .from('dealroom_passed_deals')
      .select('*')
      .order('passed_at', { ascending: false })

    if (options?.isWatching !== undefined) {
      query = query.eq('is_watching', options.isWatching)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error
    return { data: data as PassedDeal[], error: null }
  } catch (err) {
    console.error('Error fetching passed deals:', err)
    return { data: [], error: err as Error }
  }
}

// ============================================================================
// Deal Outcomes
// ============================================================================

/**
 * Get deal outcome for a deal
 */
export async function getDealOutcome(dealId: string): Promise<{ data: DealOutcome | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_deal_outcomes')
      .select('*')
      .eq('deal_id', dealId)
      .maybeSingle()

    if (error) throw error
    return { data: data as DealOutcome | null, error: null }
  } catch (err) {
    console.error('Error fetching deal outcome:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Create a deal outcome
 */
export async function createOutcome(input: CreateOutcomeInput): Promise<{ data: DealOutcome | null; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', userData.user?.id)
      .single()

    const { data, error } = await supabase
      .from('dealroom_deal_outcomes')
      .insert({
        tenant_id: tenantUser?.tenant_id,
        logged_by_user_id: userData.user?.id,
        ...input,
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as DealOutcome, error: null }
  } catch (err) {
    console.error('Error creating outcome:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Update a deal outcome
 */
export async function updateOutcome(input: UpdateOutcomeInput): Promise<{ data: DealOutcome | null; error: Error | null }> {
  try {
    const { id, ...updates } = input

    const { data, error } = await supabase
      .from('dealroom_deal_outcomes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data: data as DealOutcome, error: null }
  } catch (err) {
    console.error('Error updating outcome:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Export as service object
// ============================================================================

export const intelligenceService = {
  // Market Alerts
  getMarketAlerts,
  getUnreadAlertCount,
  getUrgentAlerts,
  markAlertRead,
  dismissAlert,
  markAllAlertsRead,

  // Seller Motivation
  getMotivationScore,
  getMotivationScoresForLeads,

  // Investor Patterns
  getInvestorPatterns,
  getPatternInsights,

  // Market Pulse
  getMarketPulseData,
  getAllMarketPulseData,
  getTrackedZipCodes,

  // Passed Deals
  createPassedDeal,
  getPassedDeals,

  // Deal Outcomes
  getDealOutcome,
  createOutcome,
  updateOutcome,

  // Helpers
  getSeverityColor,
  getSeverityLabel,
  getAlertTypeIcon,
  getMotivationColor,
}
