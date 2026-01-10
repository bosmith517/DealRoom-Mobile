/**
 * AI Service for FlipMantis Mobile
 *
 * Handles AI job processing, scoring, analysis, buy box management,
 * and investor profile management.
 */

import { supabase } from '../lib/supabase'
import type {
  AIJob,
  AIJobType,
  AIScoreResult,
  AnalysisSnapshot,
  BuyBox,
  BuyBoxInput,
  BuyBoxTemplate,
  BuyBoxScore,
  OutreachDraft,
  InvestorProfile,
  InvestorProfileUpdate,
  GeneratedBuyBoxesResult,
  InvestorContext,
} from '../types/ai'

// ============================================================================
// TENANT HELPER
// ============================================================================

async function getCurrentTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: tenantUser, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()

  if (error || !tenantUser?.tenant_id) {
    throw new Error('No tenant assigned')
  }

  return tenantUser.tenant_id
}

// ============================================================================
// AI JOB MANAGEMENT
// ============================================================================

class AIService {
  /**
   * Enqueue an AI job for processing
   */
  async enqueueAIJob(
    jobType: AIJobType,
    subjectType: string,
    subjectId: string,
    input: Record<string, unknown> = {},
    priority: number = 5
  ): Promise<string | null> {
    try {
      console.log('Enqueueing AI job:', { jobType, subjectType, subjectId })

      const { data, error } = await supabase.rpc('enqueue_ai_job', {
        p_job_type: jobType,
        p_subject_type: subjectType,
        p_subject_id: subjectId,
        p_input: input,
        p_priority: priority,
      })

      if (error) {
        console.error('enqueue_ai_job RPC error:', error)
        throw error
      }

      console.log('AI job enqueued successfully:', data)
      return data as string
    } catch (err) {
      console.error('Error enqueuing AI job:', err)
      return null
    }
  }

  /**
   * Get AI job status by ID
   */
  async getAIJobStatus(jobId: string): Promise<AIJob | null> {
    try {
      const { data, error } = await supabase
        .from('dealroom_ai_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (error) throw error
      return data as AIJob
    } catch (err) {
      console.error('Error getting AI job:', err)
      return null
    }
  }

  /**
   * Poll for AI job completion
   */
  async pollAIJobCompletion(
    jobId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<AIJob | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const job = await this.getAIJobStatus(jobId)

      if (!job) return null

      if (job.status === 'completed' || job.status === 'failed') {
        return job
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    // Timeout - return last status
    return this.getAIJobStatus(jobId)
  }

  /**
   * Trigger AI job processing via Edge Function
   */
  async triggerAIJobProcessing(maxJobs: number = 5): Promise<void> {
    try {
      console.log('Triggering AI job processing...')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.warn('No active session, skipping AI job processing')
        return
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

      await fetch(`${supabaseUrl}/functions/v1/ai-process-jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxJobs }),
      })
    } catch (err) {
      console.error('Error triggering AI job processing:', err)
    }
  }

  // ============================================================================
  // AI ANALYSIS
  // ============================================================================

  /**
   * Run AI analysis on a deal or lead
   */
  async runAIAnalysis(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead',
    additionalInput: Record<string, unknown> = {}
  ): Promise<{ jobId: string | null; error?: string }> {
    try {
      console.log('Running AI analysis for:', { subjectId, subjectType })

      const jobId = await this.enqueueAIJob(
        'underwrite_snapshot',
        subjectType,
        subjectId,
        additionalInput,
        3 // Higher priority
      )

      if (jobId) {
        console.log('AI analysis job created:', jobId)
        this.triggerAIJobProcessing()
      } else {
        return { jobId: null, error: 'Failed to enqueue AI job' }
      }

      return { jobId }
    } catch (err) {
      console.error('Error running AI analysis:', err)
      return {
        jobId: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * Score a lead or deal with AI
   */
  async scoreWithAI(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead',
    additionalInput: Record<string, unknown> = {}
  ): Promise<{ jobId: string | null; error?: string }> {
    try {
      console.log('Scoring with AI:', { subjectId, subjectType })

      const jobId = await this.enqueueAIJob(
        'score_candidate',
        subjectType,
        subjectId,
        additionalInput,
        5
      )

      if (jobId) {
        console.log('AI scoring job created:', jobId)
        this.triggerAIJobProcessing()
      } else {
        return { jobId: null, error: 'Failed to enqueue AI job' }
      }

      return { jobId }
    } catch (err) {
      console.error('Error scoring with AI:', err)
      return {
        jobId: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * Get latest analysis snapshot for a deal or lead
   */
  async getLatestAnalysis(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead'
  ): Promise<AnalysisSnapshot | null> {
    try {
      const tenantId = await getCurrentTenantId()
      const column = subjectType === 'deal' ? 'deal_id' : 'lead_id'

      const { data, error } = await supabase
        .from('dealroom_analysis_snapshots')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq(column, subjectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as AnalysisSnapshot | null
    } catch (err) {
      console.error('Error getting latest analysis:', err)
      return null
    }
  }

  /**
   * Get latest AI score for a deal or lead
   */
  async getLatestScore(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead'
  ): Promise<AIScoreResult | null> {
    try {
      const tenantId = await getCurrentTenantId()

      // Check AI cache for score
      const { data, error } = await supabase
        .from('dealroom_ai_cache')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('cache_type', 'score')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data?.result) {
        return data.result as AIScoreResult
      }

      return null
    } catch (err) {
      console.error('Error getting latest score:', err)
      return null
    }
  }

  // ============================================================================
  // OUTREACH GENERATION
  // ============================================================================

  /**
   * Generate outreach content for a deal or lead
   */
  async generateOutreach(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead',
    ownerName?: string,
    additionalContext?: Record<string, unknown>
  ): Promise<{ jobId: string | null; error?: string }> {
    try {
      console.log('Generating outreach for:', { subjectId, subjectType, ownerName })

      const jobId = await this.enqueueAIJob(
        'outreach_draft',
        subjectType,
        subjectId,
        {
          owner_name: ownerName,
          ...additionalContext,
        },
        5
      )

      if (jobId) {
        console.log('Outreach generation job created:', jobId)
        this.triggerAIJobProcessing()
      } else {
        return { jobId: null, error: 'Failed to enqueue AI job' }
      }

      return { jobId }
    } catch (err) {
      console.error('Error generating outreach:', err)
      return {
        jobId: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * Get latest outreach draft for a deal or lead
   */
  async getLatestOutreach(
    subjectId: string,
    subjectType: 'deal' | 'lead' = 'lead'
  ): Promise<OutreachDraft | null> {
    try {
      const tenantId = await getCurrentTenantId()

      const { data, error } = await supabase
        .from('dealroom_ai_cache')
        .select('result')
        .eq('tenant_id', tenantId)
        .eq('cache_type', 'outreach')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data?.result) {
        return data.result as OutreachDraft
      }

      return null
    } catch (err) {
      console.error('Error getting latest outreach:', err)
      return null
    }
  }

  // ============================================================================
  // BUY BOX MANAGEMENT
  // ============================================================================

  /**
   * Get the user's active/default buy box
   */
  async getActiveBuyBox(): Promise<BuyBox | null> {
    try {
      const { data, error } = await supabase.rpc('get_active_buy_box')

      if (error) throw error
      return data as BuyBox
    } catch (err) {
      console.error('Error getting buy box:', err)
      return null
    }
  }

  /**
   * Get all buy boxes for the current user
   */
  async getBuyBoxes(): Promise<BuyBox[]> {
    try {
      const { data, error } = await supabase
        .from('dealroom_buy_box')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as BuyBox[]
    } catch (err) {
      console.error('Error getting buy boxes:', err)
      return []
    }
  }

  /**
   * Create a new buy box
   */
  async createBuyBox(input: BuyBoxInput): Promise<BuyBox | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const tenantId = await getCurrentTenantId()

      const { data, error } = await supabase
        .from('dealroom_buy_box')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          name: input.name || 'Default',
          is_default: input.is_default ?? false,
          is_active: true,
          target_zips: input.target_zips || [],
          target_cities: input.target_cities || [],
          target_states: input.target_states || [],
          exclude_zips: input.exclude_zips || [],
          property_types: input.property_types || ['sfr'],
          min_beds: input.min_beds,
          max_beds: input.max_beds,
          min_baths: input.min_baths,
          max_baths: input.max_baths,
          min_sqft: input.min_sqft,
          max_sqft: input.max_sqft,
          min_year_built: input.min_year_built,
          max_year_built: input.max_year_built,
          max_purchase_price: input.max_purchase_price,
          min_arv: input.min_arv,
          max_arv: input.max_arv,
          min_equity_percent: input.min_equity_percent,
          max_repair_budget: input.max_repair_budget,
          min_profit: input.min_profit,
          min_roi_percent: input.min_roi_percent,
          strategies: input.strategies || ['flip'],
          preferred_strategy: input.preferred_strategy || 'flip',
          preferred_tags: input.preferred_tags || ['vacant', 'absentee_owner'],
          avoid_tags: input.avoid_tags || [],
          risk_tolerance: input.risk_tolerance || 'moderate',
          weight_location: input.weight_location ?? 30,
          weight_property_fit: input.weight_property_fit ?? 25,
          weight_financial: input.weight_financial ?? 30,
          weight_distress: input.weight_distress ?? 15,
        })
        .select()
        .single()

      if (error) throw error
      return data as BuyBox
    } catch (err) {
      console.error('Error creating buy box:', err)
      return null
    }
  }

  /**
   * Update an existing buy box
   */
  async updateBuyBox(id: string, updates: Partial<BuyBoxInput>): Promise<BuyBox | null> {
    try {
      const { data, error } = await supabase
        .from('dealroom_buy_box')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as BuyBox
    } catch (err) {
      console.error('Error updating buy box:', err)
      return null
    }
  }

  /**
   * Delete a buy box
   */
  async deleteBuyBox(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('dealroom_buy_box')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error deleting buy box:', err)
      return false
    }
  }

  /**
   * Set a buy box as default
   */
  async setDefaultBuyBox(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // First, unset all defaults for this user
      await supabase
        .from('dealroom_buy_box')
        .update({ is_default: false })
        .eq('user_id', user.id)

      // Then set the new default
      const { error } = await supabase
        .from('dealroom_buy_box')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error setting default buy box:', err)
      return false
    }
  }

  // ============================================================================
  // MULTI-BUY BOX STRATEGY COMPARISON
  // ============================================================================

  /**
   * Score a deal against all of the user's active buy boxes
   * Returns ranked comparison showing best strategy fit
   */
  async scoreAgainstAllBuyBoxes(dealId: string): Promise<BuyBoxScore[]> {
    try {
      console.log('Scoring deal against all buy boxes:', dealId)

      const { data, error } = await supabase.rpc('score_against_all_buy_boxes', {
        p_deal_id: dealId,
      })

      if (error) throw error

      console.log('Multi-box scoring complete:', data?.length || 0, 'boxes scored')
      return (data || []) as BuyBoxScore[]
    } catch (err) {
      console.error('Error scoring against all buy boxes:', err)
      return []
    }
  }

  /**
   * Get buy box templates for creating new buy boxes
   */
  async getBuyBoxTemplates(category?: string): Promise<BuyBoxTemplate[]> {
    try {
      const { data, error } = await supabase.rpc('get_buy_box_templates', {
        p_category: category || null,
      })

      if (error) throw error
      return (data || []) as BuyBoxTemplate[]
    } catch (err) {
      console.error('Error getting buy box templates:', err)
      return []
    }
  }

  /**
   * Create a buy box from a template
   */
  async createBuyBoxFromTemplate(
    templateId: string,
    customName?: string,
    targetZips?: string[]
  ): Promise<string | null> {
    try {
      console.log('Creating buy box from template:', templateId)

      const { data, error } = await supabase.rpc('create_buy_box_from_template', {
        p_template_id: templateId,
        p_name: customName || null,
        p_target_zips: targetZips || null,
      })

      if (error) throw error

      console.log('Buy box created:', data)
      return data as string
    } catch (err) {
      console.error('Error creating buy box from template:', err)
      return null
    }
  }

  // ============================================================================
  // INVESTOR PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Get or create the current user's investor profile
   * Auto-creates profile on first access
   */
  async getOrCreateInvestorProfile(): Promise<InvestorProfile | null> {
    try {
      console.log('Getting or creating investor profile...')

      const { data, error } = await supabase.rpc('get_or_create_investor_profile')

      if (error) throw error

      console.log('Investor profile retrieved:', data?.id)
      return data as InvestorProfile
    } catch (err) {
      console.error('Error getting investor profile:', err)
      return null
    }
  }

  /**
   * Update the investor profile with new data
   */
  async updateInvestorProfile(updates: Partial<InvestorProfileUpdate>): Promise<InvestorProfile | null> {
    try {
      console.log('Updating investor profile...', Object.keys(updates))

      const { data, error } = await supabase.rpc('update_investor_profile', {
        p_updates: updates,
      })

      if (error) throw error

      console.log('Investor profile updated')
      return data as InvestorProfile
    } catch (err) {
      console.error('Error updating investor profile:', err)
      return null
    }
  }

  /**
   * Mark a specific onboarding step as complete
   */
  async completeOnboardingStep(step: string): Promise<InvestorProfile | null> {
    try {
      const profile = await this.getOrCreateInvestorProfile()
      if (!profile) return null

      const completedSteps = [...(profile.onboarding_steps_completed || []), step]

      // Mark fully onboarded if all steps complete
      const allSteps = ['experience', 'financial', 'goals', 'time', 'risk', 'team', 'market']
      const isFullyOnboarded = allSteps.every(s => completedSteps.includes(s))

      return this.updateInvestorProfile({
        onboarding_steps_completed: completedSteps,
        onboarding_completed: isFullyOnboarded,
        onboarding_completed_at: isFullyOnboarded ? new Date().toISOString() : null,
      })
    } catch (err) {
      console.error('Error completing onboarding step:', err)
      return null
    }
  }

  /**
   * Auto-generate buy boxes based on investor profile
   * Creates strategy-appropriate buy boxes based on capital, experience, and preferences
   */
  async generateBuyBoxesFromProfile(profileId?: string): Promise<GeneratedBuyBoxesResult | null> {
    try {
      console.log('Generating buy boxes from profile...')

      let targetProfileId = profileId

      if (!targetProfileId) {
        const profile = await this.getOrCreateInvestorProfile()
        if (!profile) throw new Error('Could not get investor profile')
        targetProfileId = profile.id
      }

      const { data, error } = await supabase.rpc('generate_buy_boxes_from_profile', {
        p_profile_id: targetProfileId,
      })

      if (error) throw error

      console.log('Buy boxes generated:', data)
      return data as GeneratedBuyBoxesResult
    } catch (err) {
      console.error('Error generating buy boxes:', err)
      return null
    }
  }

  /**
   * Get investor context for AI prompts
   * Returns a summary of the investor profile for injection into AI calls
   */
  async getInvestorContextForAI(): Promise<InvestorContext | null> {
    try {
      const { data, error } = await supabase.rpc('get_investor_context_for_ai')

      if (error) throw error
      return data as InvestorContext
    } catch (err) {
      console.error('Error getting investor context:', err)
      return null
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async isOnboardingComplete(): Promise<boolean> {
    try {
      const profile = await this.getOrCreateInvestorProfile()
      return profile?.onboarding_completed ?? false
    } catch (err) {
      console.error('Error checking onboarding status:', err)
      return false
    }
  }

  /**
   * Get remaining onboarding steps
   */
  async getRemainingOnboardingSteps(): Promise<string[]> {
    try {
      const profile = await this.getOrCreateInvestorProfile()
      if (!profile) return []

      const allSteps = ['experience', 'financial', 'goals', 'time', 'risk', 'team', 'market']
      const completed = profile.onboarding_steps_completed || []

      return allSteps.filter(step => !completed.includes(step))
    } catch (err) {
      console.error('Error getting remaining steps:', err)
      return []
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Run AI scoring on multiple leads/deals
   */
  async batchScore(
    subjectIds: string[],
    subjectType: 'deal' | 'lead' = 'lead'
  ): Promise<{ jobIds: string[]; errors: string[] }> {
    const jobIds: string[] = []
    const errors: string[] = []

    for (const id of subjectIds) {
      const result = await this.scoreWithAI(id, subjectType)
      if (result.jobId) {
        jobIds.push(result.jobId)
      } else if (result.error) {
        errors.push(`${id}: ${result.error}`)
      }
    }

    return { jobIds, errors }
  }

  /**
   * Get pending AI jobs for the current tenant
   */
  async getPendingJobs(): Promise<AIJob[]> {
    try {
      const tenantId = await getCurrentTenantId()

      const { data, error } = await supabase
        .from('dealroom_ai_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'running'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as AIJob[]
    } catch (err) {
      console.error('Error getting pending jobs:', err)
      return []
    }
  }

  /**
   * Get recent completed AI jobs for the current tenant
   */
  async getRecentJobs(limit: number = 20): Promise<AIJob[]> {
    try {
      const tenantId = await getCurrentTenantId()

      const { data, error } = await supabase
        .from('dealroom_ai_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data || []) as AIJob[]
    } catch (err) {
      console.error('Error getting recent jobs:', err)
      return []
    }
  }
}

// Export singleton instance
export const aiService = new AIService()
export default aiService
