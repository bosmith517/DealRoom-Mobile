/**
 * SkipTraceService
 *
 * Handles skip trace lookups for owner contact information.
 * Uses BatchData API via Edge Function with caching and usage tracking.
 */

import { supabase } from '../lib/supabase'

// ============================================================================
// Types
// ============================================================================

export interface PhoneResult {
  phone: string
  type: 'mobile' | 'landline' | 'voip' | 'unknown'
  isValid: boolean
  isPrimary: boolean
  carrier?: string
  lineType?: string
}

export interface EmailResult {
  email: string
  type: 'personal' | 'work' | 'unknown'
  isValid: boolean
  isPrimary: boolean
}

export interface AddressResult {
  street: string
  city: string
  state: string
  zip: string
  type?: 'current' | 'mailing' | 'previous'
  lastSeenDate?: string
}

export interface RelativeResult {
  fullName: string
  firstName?: string
  lastName?: string
  relationship?: string
  phones?: string[]
}

export interface LitigatorDetails {
  isLitigator: boolean
  score: number
  caseCount?: number
  recentCases?: Array<{
    caseType: string
    date: string
    court?: string
  }>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface SkipTraceResult {
  id: string
  leadId?: string
  propertyOwnerId?: string

  // Contact info
  phoneNumbers: PhoneResult[]
  emailAddresses: EmailResult[]

  // Owner identity
  ownerFullName?: string
  ownerFirstName?: string
  ownerLastName?: string
  ownerAge?: number
  ownerGender?: string

  // Addresses
  currentAddress?: AddressResult
  mailingAddress?: AddressResult
  previousAddresses: AddressResult[]

  // Related people
  relatives: RelativeResult[]
  associates: RelativeResult[]

  // Litigator check
  isLitigator: boolean
  litigatorScore?: number
  litigatorDetails?: LitigatorDetails

  // Bankruptcy
  hasBankruptcy: boolean
  bankruptcyDetails?: any

  // Quality
  overallMatchScore?: number
  dataQualityScore?: number

  // Meta
  fetchedAt: string
  expiresAt: string
  isValid: boolean
  status: 'success' | 'not_found' | 'error'
  errorMessage?: string
}

export interface SkipTraceSettings {
  autoTriggerEnabled: boolean
  autoTriggerScoreThreshold: number
  autoTriggerOnHot: boolean
  autoTriggerOnAnalyze: boolean
  batchProcessingEnabled: boolean
  batchProcessingHour: number
  litigatorCheckEnabled: boolean
  dailyLimit: number
  monthlyLimit: number
  cacheTtlDays: number
  notifyOnLitigator: boolean
}

export interface SkipTraceUsage {
  canLookup: boolean
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

export interface SkipTraceLookupOptions {
  forceRefresh?: boolean
  includeLitigator?: boolean
  includeBankruptcy?: boolean
  confirmed?: boolean  // Required for billable lookups
}

// Quote result - returned by getQuote() before user confirms
export interface SkipTraceQuote {
  canProceed: boolean
  requiresConfirmation: boolean
  estimatedCost: number
  cacheStatus: 'tenant_cached' | 'global_cached' | 'not_cached'
  reason: string
  leadId?: string
  address?: string
  ownerName?: string
  preview?: {
    hasPhones: boolean
    hasEmails: boolean
    phoneCount: number
    emailCount: number
    isLitigator: boolean
  }
  error?: string
}

// ============================================================================
// Service Class
// ============================================================================

class SkipTraceService {
  private edgeFunctionUrl: string | null = null

  /**
   * Get the Edge Function URL
   */
  private async getEdgeFunctionUrl(): Promise<string> {
    if (this.edgeFunctionUrl) {
      return this.edgeFunctionUrl
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get the Supabase URL from the client
    const supabaseUrl = (supabase as any).supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/skip-trace-lookup`
    return this.edgeFunctionUrl
  }

  /**
   * Get auth headers for Edge Function calls
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Get a quote for skip trace lookup (check cache, estimate cost)
   * Call this BEFORE runSkipTrace to show user confirmation
   */
  async getQuote(leadId: string): Promise<SkipTraceQuote> {
    try {
      const url = await this.getEdgeFunctionUrl()
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'quote',
          leadId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          canProceed: false,
          requiresConfirmation: false,
          estimatedCost: 0,
          cacheStatus: 'not_cached',
          reason: data.error || `HTTP ${response.status}`,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return data as SkipTraceQuote
    } catch (error) {
      console.error('Skip trace quote failed:', error)
      return {
        canProceed: false,
        requiresConfirmation: false,
        estimatedCost: 0,
        cacheStatus: 'not_cached',
        reason: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Request skip trace using atomic RPC (prevents double-charging)
   * This is the preferred method for the Reach Workflow.
   * Validates reach_status == intel_ready, atomically transitions to skiptrace_pending, queues job.
   */
  async requestSkipTraceAtomic(
    leadId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const { data: jobId, error } = await supabase.rpc('request_skip_trace', {
        p_lead_id: leadId,
        p_source: 'mobile',
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, jobId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Poll for skip trace job completion
   * Returns the result when the job completes, or null if still pending
   */
  async pollSkipTraceJob(
    leadId: string,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<{ completed: boolean; result?: SkipTraceResult; error?: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      // Check lead's reach_status
      const { data: lead, error: leadError } = await supabase
        .from('dealroom_leads')
        .select('reach_status, skiptrace_last_error')
        .eq('id', leadId)
        .single()

      if (leadError) {
        return { completed: false, error: leadError.message }
      }

      // If completed successfully, fetch the result
      if (lead.reach_status === 'outreach_ready' || lead.reach_status === 'skiptrace_ready') {
        const result = await this.getSkipTraceResults(leadId)
        return {
          completed: true,
          result: result || undefined,
        }
      }

      // If failed, return error
      if (lead.reach_status === 'skiptrace_failed') {
        return {
          completed: true,
          error: lead.skiptrace_last_error || 'Skip trace failed',
        }
      }

      // Still pending, wait and retry
      if (lead.reach_status === 'skiptrace_pending') {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        continue
      }

      // Unexpected status
      return {
        completed: false,
        error: `Unexpected reach_status: ${lead.reach_status}`,
      }
    }

    return {
      completed: false,
      error: 'Skip trace job timed out',
    }
  }

  /**
   * Get the lead's current reach status and enrichment state
   */
  async getLeadReachStatus(leadId: string): Promise<{
    reachStatus: string
    isIntelReady: boolean
    isSkiptraceReady: boolean
    isOutreachReady: boolean
    intelError?: string
    skiptraceError?: string
  } | null> {
    try {
      const { data, error } = await supabase
        .from('dealroom_leads')
        .select('reach_status, intel_last_error, skiptrace_last_error')
        .eq('id', leadId)
        .single()

      if (error || !data) {
        return null
      }

      const status = data.reach_status || 'new'

      return {
        reachStatus: status,
        isIntelReady: ['intel_ready', 'skiptrace_pending', 'skiptrace_ready', 'skiptrace_failed', 'outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(status),
        isSkiptraceReady: ['skiptrace_ready', 'outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(status),
        isOutreachReady: ['outreach_ready', 'contacted', 'nurturing', 'dead', 'converted'].includes(status),
        intelError: data.intel_last_error,
        skiptraceError: data.skiptrace_last_error,
      }
    } catch (error) {
      console.error('Error getting lead reach status:', error)
      return null
    }
  }

  /**
   * Run skip trace lookup for a single lead
   * If confirmation is required, pass confirmed: true after user confirms
   */
  async runSkipTrace(
    leadId: string,
    options: SkipTraceLookupOptions = {}
  ): Promise<{ success: boolean; result?: SkipTraceResult; error?: string; quote?: SkipTraceQuote }> {
    try {
      const url = await this.getEdgeFunctionUrl()
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'single',
          leadId,
          forceRefresh: options.forceRefresh ?? false,
          confirmed: options.confirmed ?? false,
        }),
      })

      const data = await response.json()

      // Handle confirmation required response
      if (response.status === 402 && data.code === 'CONFIRMATION_REQUIRED') {
        return {
          success: false,
          error: 'Confirmation required',
          quote: data.quote as SkipTraceQuote,
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        result: this.normalizeResult(data),
      }
    } catch (error) {
      console.error('Skip trace lookup failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Convenience method: Get quote, then run if user confirms
   * Returns quote for UI to show confirmation dialog
   */
  async runSkipTraceWithConfirmation(
    leadId: string,
    options: SkipTraceLookupOptions = {}
  ): Promise<{
    needsConfirmation: boolean
    quote?: SkipTraceQuote
    result?: SkipTraceResult
    error?: string
  }> {
    // First, get quote
    const quote = await this.getQuote(leadId)

    if (!quote.canProceed) {
      return {
        needsConfirmation: false,
        error: quote.error || quote.reason,
      }
    }

    // If no confirmation needed (cached), run immediately
    if (!quote.requiresConfirmation) {
      const result = await this.runSkipTrace(leadId, { ...options, confirmed: true })
      return {
        needsConfirmation: false,
        result: result.result,
        error: result.error,
      }
    }

    // Confirmation needed - return quote for UI to show
    return {
      needsConfirmation: true,
      quote,
    }
  }

  /**
   * Run skip trace lookup by address/name (without a lead ID)
   */
  async runSkipTraceByAddress(
    address: string,
    name: string,
    city?: string,
    state?: string,
    zip?: string,
    options: SkipTraceLookupOptions = {}
  ): Promise<{ success: boolean; result?: SkipTraceResult; error?: string }> {
    try {
      const url = await this.getEdgeFunctionUrl()
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'single',
          address,
          name,
          city,
          state,
          zip,
          forceRefresh: options.forceRefresh ?? false,
          includeLitigator: options.includeLitigator ?? true,
          includeBankruptcy: options.includeBankruptcy ?? true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        result: this.normalizeResult(data.result),
      }
    } catch (error) {
      console.error('Skip trace lookup failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get cached skip trace results for a lead
   */
  async getSkipTraceResults(leadId: string): Promise<SkipTraceResult | null> {
    try {
      const { data, error } = await supabase
        .from('dealroom_skip_trace_results')
        .select('*')
        .eq('lead_id', leadId)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error fetching skip trace results:', error)
        return null
      }

      if (!data) {
        return null
      }

      return this.normalizeResult(data)
    } catch (error) {
      console.error('Error fetching skip trace results:', error)
      return null
    }
  }

  /**
   * Queue a batch of leads for skip trace processing
   */
  async queueBatchSkipTrace(
    leadIds: string[],
    priority: number = 5
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('enqueue_skip_trace_batch', {
        p_tenant_id: await this.getTenantId(),
        p_lead_ids: leadIds,
        p_priority: priority,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, jobId: data }
    } catch (error) {
      console.error('Error queuing batch skip trace:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get leads that need skip trace lookup
   */
  async getLeadsNeedingSkipTrace(
    limit: number = 100
  ): Promise<Array<{ leadId: string; address: string; ownerName: string; priority: string; rankScore: number }>> {
    try {
      const { data, error } = await supabase.rpc('get_leads_for_skip_trace_batch', {
        p_tenant_id: await this.getTenantId(),
        p_limit: limit,
      })

      if (error) {
        console.error('Error getting leads for skip trace:', error)
        return []
      }

      return (data || []).map((row: any) => ({
        leadId: row.lead_id,
        address: row.address,
        ownerName: row.owner_name,
        priority: row.priority,
        rankScore: row.rank_score,
      }))
    } catch (error) {
      console.error('Error getting leads for skip trace:', error)
      return []
    }
  }

  /**
   * Get skip trace settings for the current tenant
   */
  async getSkipTraceSettings(): Promise<SkipTraceSettings> {
    // Pay-as-you-go defaults - no auto-triggers, high limits
    const defaults: SkipTraceSettings = {
      autoTriggerEnabled: false,
      autoTriggerScoreThreshold: 70,
      autoTriggerOnHot: false,
      autoTriggerOnAnalyze: false,
      batchProcessingEnabled: false,
      batchProcessingHour: 2,
      litigatorCheckEnabled: true,
      dailyLimit: 9999,
      monthlyLimit: 99999,
      cacheTtlDays: 30,
      notifyOnLitigator: true,
    }

    try {
      const tenantId = await this.getTenantId()
      const { data, error } = await supabase
        .from('dealroom_tenant_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_key', 'skip_trace_config')
        .maybeSingle()

      if (error || !data) {
        return defaults
      }

      return { ...defaults, ...data.setting_value }
    } catch (error) {
      console.error('Error fetching skip trace settings:', error)
      return defaults
    }
  }

  /**
   * Update skip trace settings for the current tenant
   */
  async updateSkipTraceSettings(
    settings: Partial<SkipTraceSettings>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tenantId = await this.getTenantId()
      const current = await this.getSkipTraceSettings()
      const updated = { ...current, ...settings }

      const { error } = await supabase
        .from('dealroom_tenant_settings')
        .upsert({
          tenant_id: tenantId,
          setting_key: 'skip_trace_config',
          setting_value: updated,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,setting_key',
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if we should auto-trigger skip trace for a lead
   */
  async shouldAutoTriggerSkipTrace(lead: {
    id: string
    priority?: string
    triage_status?: string
    rank_score?: number
    skip_traced_at?: string
  }): Promise<boolean> {
    // Already skip traced
    if (lead.skip_traced_at) {
      return false
    }

    const settings = await this.getSkipTraceSettings()

    // Auto-trigger disabled
    if (!settings.autoTriggerEnabled) {
      return false
    }

    // Check usage limits
    const usage = await this.getSkipTraceUsage()
    if (!usage.canLookup) {
      return false
    }

    // Check hot priority
    if (settings.autoTriggerOnHot && lead.priority === 'hot') {
      return true
    }

    // Check analyze status
    if (settings.autoTriggerOnAnalyze && lead.triage_status === 'analyze') {
      return true
    }

    // Check score threshold
    if (lead.rank_score && lead.rank_score >= settings.autoTriggerScoreThreshold) {
      return true
    }

    return false
  }

  /**
   * Get current usage stats for skip trace
   */
  async getSkipTraceUsage(): Promise<SkipTraceUsage> {
    try {
      const { data, error } = await supabase.rpc('check_skip_trace_limit', {
        p_tenant_id: await this.getTenantId(),
      })

      if (error || !data || data.length === 0) {
        // Pay-as-you-go defaults - always allow
        return {
          canLookup: true,
          dailyUsed: 0,
          dailyLimit: 9999,
          monthlyUsed: 0,
          monthlyLimit: 99999,
        }
      }

      const row = data[0]
      return {
        canLookup: row.can_lookup,
        dailyUsed: row.daily_used,
        dailyLimit: row.daily_limit,
        monthlyUsed: row.monthly_used,
        monthlyLimit: row.monthly_limit,
      }
    } catch (error) {
      console.error('Error checking skip trace usage:', error)
      return {
        canLookup: true,
        dailyUsed: 0,
        dailyLimit: 50,
        monthlyUsed: 0,
        monthlyLimit: 500,
      }
    }
  }

  /**
   * Get the current tenant ID
   */
  private async getTenantId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (error || !data) {
      throw new Error('No tenant found for user')
    }

    return data.tenant_id
  }

  /**
   * Normalize database row to SkipTraceResult
   */
  private normalizeResult(row: any): SkipTraceResult {
    return {
      id: row.id,
      leadId: row.lead_id,
      propertyOwnerId: row.property_owner_id,

      phoneNumbers: (row.phone_numbers || []).map((p: any) => ({
        phone: p.phone || p.number,
        type: p.type || 'unknown',
        isValid: p.is_valid ?? p.isValid ?? true,
        isPrimary: p.is_primary ?? p.isPrimary ?? false,
        carrier: p.carrier,
        lineType: p.line_type || p.lineType,
      })),

      emailAddresses: (row.email_addresses || []).map((e: any) => ({
        email: e.email || e.address,
        type: e.type || 'unknown',
        isValid: e.is_valid ?? e.isValid ?? true,
        isPrimary: e.is_primary ?? e.isPrimary ?? false,
      })),

      ownerFullName: row.owner_full_name,
      ownerFirstName: row.owner_first_name,
      ownerLastName: row.owner_last_name,
      ownerAge: row.owner_age,
      ownerGender: row.owner_gender,

      currentAddress: row.current_address ? {
        street: row.current_address.street,
        city: row.current_address.city,
        state: row.current_address.state,
        zip: row.current_address.zip,
        type: 'current',
      } : undefined,

      mailingAddress: row.mailing_address ? {
        street: row.mailing_address.street,
        city: row.mailing_address.city,
        state: row.mailing_address.state,
        zip: row.mailing_address.zip,
        type: 'mailing',
      } : undefined,

      previousAddresses: (row.previous_addresses || []).map((a: any) => ({
        street: a.street,
        city: a.city,
        state: a.state,
        zip: a.zip,
        type: 'previous',
        lastSeenDate: a.last_seen_date,
      })),

      relatives: (row.relatives || []).map((r: any) => ({
        fullName: r.full_name || r.fullName,
        firstName: r.first_name || r.firstName,
        lastName: r.last_name || r.lastName,
        relationship: r.relationship,
        phones: r.phones,
      })),

      associates: (row.associates || []).map((a: any) => ({
        fullName: a.full_name || a.fullName,
        firstName: a.first_name || a.firstName,
        lastName: a.last_name || a.lastName,
        relationship: a.relationship,
        phones: a.phones,
      })),

      isLitigator: row.is_litigator ?? false,
      litigatorScore: row.litigator_score,
      litigatorDetails: row.litigator_details ? {
        isLitigator: row.litigator_details.is_litigator ?? row.is_litigator,
        score: row.litigator_details.score ?? row.litigator_score ?? 0,
        caseCount: row.litigator_details.case_count,
        recentCases: row.litigator_details.recent_cases,
        riskLevel: this.getLitigatorRiskLevel(row.litigator_score),
      } : undefined,

      hasBankruptcy: row.has_bankruptcy ?? false,
      bankruptcyDetails: row.bankruptcy_details,

      overallMatchScore: row.overall_match_score,
      dataQualityScore: row.data_quality_score,

      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      isValid: row.is_valid ?? true,
      status: row.status || 'success',
      errorMessage: row.error_message,
    }
  }

  /**
   * Get litigator risk level from score
   */
  private getLitigatorRiskLevel(score?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!score) return 'low'
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }
}

// Export singleton
export const skipTraceService = new SkipTraceService()

// Export class for testing
export { SkipTraceService }
