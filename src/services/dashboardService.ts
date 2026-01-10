/**
 * Dashboard Service
 *
 * Provides enhanced dashboard data including:
 * - Daily focus metrics for personalized greeting
 * - User goals with progress tracking
 * - Quick win suggestions
 * - Pipeline health indicators
 */

import { supabase } from '../lib/supabase'

// Types for daily focus data
export interface DailyFocus {
  overdue_tasks_count: number
  hot_leads_count: number
  deals_needing_attention: number
  today_appointments_count: number
  greeting_context: string
}

// Types for user goals
export interface UserGoal {
  id: string
  goal_type: 'deals_closed' | 'revenue' | 'leads_captured' | 'profit'
  target_value: number
  current_value: number
  progress_percent: number
  period_start: string
  period_end: string
  days_remaining: number
}

export interface CreateGoalInput {
  goal_type: 'deals_closed' | 'revenue' | 'leads_captured' | 'profit'
  target_value: number
  period_start: string
  period_end: string
}

// Types for quick win suggestions
export interface QuickWin {
  id: string
  type: 'follow_up' | 'hot_lead' | 'stuck_deal' | 'callback'
  title: string
  subtitle: string
  action_label: string
  priority: 'high' | 'medium' | 'low'
  entity_type: 'lead' | 'deal' | 'contact' | 'followup'
  entity_id: string
}

// Types for pipeline health
export interface PipelineHealth {
  total_active_deals: number
  healthy_count: number
  warning_count: number
  critical_count: number
  health_score: number // 0-100
  oldest_stuck_days: number | null
}

/**
 * Get daily focus metrics for personalized dashboard greeting
 */
export async function getDailyFocus(): Promise<{ data: DailyFocus | null; error: Error | null }> {
  try {
    // Get current tenant
    const { data: tenantData } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (!tenantData?.tenant_id) {
      return { data: null, error: new Error('No tenant found') }
    }

    const { data, error } = await supabase
      .rpc('get_daily_focus', { p_tenant_id: tenantData.tenant_id })

    if (error) {
      console.error('[DashboardService] getDailyFocus error:', error)
      return { data: null, error }
    }

    // RPC returns an array, take first row
    const result = Array.isArray(data) ? data[0] : data
    return { data: result || null, error: null }
  } catch (err) {
    console.error('[DashboardService] getDailyFocus exception:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get user goals with real-time progress
 */
export async function getUserGoals(): Promise<{ data: UserGoal[]; error: Error | null }> {
  try {
    // Get current tenant and user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: new Error('Not authenticated') }
    }

    const { data: tenantData } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (!tenantData?.tenant_id) {
      return { data: [], error: new Error('No tenant found') }
    }

    const { data, error } = await supabase
      .rpc('get_user_goals_with_progress', {
        p_tenant_id: tenantData.tenant_id,
        p_user_id: user.id
      })

    if (error) {
      console.error('[DashboardService] getUserGoals error:', error)
      return { data: [], error }
    }

    return { data: data || [], error: null }
  } catch (err) {
    console.error('[DashboardService] getUserGoals exception:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Create a new user goal
 */
export async function createUserGoal(input: CreateGoalInput): Promise<{ data: UserGoal | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: new Error('Not authenticated') }
    }

    const { data: tenantData } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (!tenantData?.tenant_id) {
      return { data: null, error: new Error('No tenant found') }
    }

    const { data, error } = await supabase
      .from('dealroom_user_goals')
      .insert({
        tenant_id: tenantData.tenant_id,
        user_id: user.id,
        goal_type: input.goal_type,
        target_value: input.target_value,
        period_start: input.period_start,
        period_end: input.period_end,
      })
      .select()
      .single()

    if (error) {
      console.error('[DashboardService] createUserGoal error:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[DashboardService] createUserGoal exception:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Update an existing user goal
 */
export async function updateUserGoal(
  goalId: string,
  updates: Partial<CreateGoalInput>
): Promise<{ data: UserGoal | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_user_goals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .select()
      .single()

    if (error) {
      console.error('[DashboardService] updateUserGoal error:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[DashboardService] updateUserGoal exception:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Delete a user goal
 */
export async function deleteUserGoal(goalId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('dealroom_user_goals')
      .delete()
      .eq('id', goalId)

    if (error) {
      console.error('[DashboardService] deleteUserGoal error:', error)
      return { error }
    }

    return { error: null }
  } catch (err) {
    console.error('[DashboardService] deleteUserGoal exception:', err)
    return { error: err as Error }
  }
}

/**
 * Get quick win suggestions for the dashboard
 */
export async function getQuickWinSuggestions(limit: number = 5): Promise<{ data: QuickWin[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: new Error('Not authenticated') }
    }

    const { data: tenantData } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (!tenantData?.tenant_id) {
      return { data: [], error: new Error('No tenant found') }
    }

    const { data, error } = await supabase
      .rpc('get_quick_win_suggestions', {
        p_tenant_id: tenantData.tenant_id,
        p_user_id: user.id,
        p_limit: limit
      })

    if (error) {
      console.error('[DashboardService] getQuickWinSuggestions error:', error)
      return { data: [], error }
    }

    // Map the RPC response to QuickWin type
    const suggestions: QuickWin[] = (data || []).map((s: any) => ({
      id: s.id,
      type: s.suggestion_type as QuickWin['type'],
      title: s.title,
      subtitle: s.subtitle,
      action_label: s.action_label,
      priority: s.priority as QuickWin['priority'],
      entity_type: s.entity_type as QuickWin['entity_type'],
      entity_id: s.entity_id,
    }))

    return { data: suggestions, error: null }
  } catch (err) {
    console.error('[DashboardService] getQuickWinSuggestions exception:', err)
    return { data: [], error: err as Error }
  }
}

/**
 * Get pipeline health metrics
 */
export async function getPipelineHealth(): Promise<{ data: PipelineHealth | null; error: Error | null }> {
  try {
    const { data: tenantData } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (!tenantData?.tenant_id) {
      return { data: null, error: new Error('No tenant found') }
    }

    // Get all active deals with their stage_entered_at
    const { data: deals, error } = await supabase
      .from('dealroom_deals')
      .select('id, stage, stage_entered_at, status')
      .eq('tenant_id', tenantData.tenant_id)
      .eq('status', 'active')
      .is('deleted_at', null)

    if (error) {
      console.error('[DashboardService] getPipelineHealth error:', error)
      return { data: null, error }
    }

    if (!deals || deals.length === 0) {
      return {
        data: {
          total_active_deals: 0,
          healthy_count: 0,
          warning_count: 0,
          critical_count: 0,
          health_score: 100,
          oldest_stuck_days: null,
        },
        error: null,
      }
    }

    // Stage thresholds in days (warning, critical)
    const stageThresholds: Record<string, { warning: number; critical: number }> = {
      lead: { warning: 3, critical: 7 },
      offer_pending: { warning: 3, critical: 7 },
      researching: { warning: 5, critical: 10 },
      analyzing: { warning: 5, critical: 10 },
      evaluating: { warning: 7, critical: 14 },
      closing: { warning: 7, critical: 14 },
      due_diligence: { warning: 10, critical: 21 },
      under_contract: { warning: 14, critical: 30 },
    }

    const now = new Date()
    let healthyCount = 0
    let warningCount = 0
    let criticalCount = 0
    let oldestStuckDays = 0

    for (const deal of deals) {
      if (!deal.stage_entered_at) {
        healthyCount++
        continue
      }

      const enteredAt = new Date(deal.stage_entered_at)
      const daysInStage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))

      const thresholds = stageThresholds[deal.stage] || { warning: 7, critical: 14 }

      if (daysInStage >= thresholds.critical) {
        criticalCount++
        oldestStuckDays = Math.max(oldestStuckDays, daysInStage)
      } else if (daysInStage >= thresholds.warning) {
        warningCount++
      } else {
        healthyCount++
      }
    }

    // Calculate health score (0-100)
    const total = deals.length
    const healthScore = Math.round(
      ((healthyCount * 100) + (warningCount * 50) + (criticalCount * 0)) / total
    )

    return {
      data: {
        total_active_deals: total,
        healthy_count: healthyCount,
        warning_count: warningCount,
        critical_count: criticalCount,
        health_score: healthScore,
        oldest_stuck_days: oldestStuckDays > 0 ? oldestStuckDays : null,
      },
      error: null,
    }
  } catch (err) {
    console.error('[DashboardService] getPipelineHealth exception:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get time-based greeting
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Get goal type label
 */
export function getGoalTypeLabel(goalType: string): string {
  const labels: Record<string, string> = {
    deals_closed: 'Deals Closed',
    revenue: 'Revenue',
    leads_captured: 'Leads Captured',
    profit: 'Profit',
  }
  return labels[goalType] || goalType
}

/**
 * Get goal type icon
 */
export function getGoalTypeIcon(goalType: string): string {
  const icons: Record<string, string> = {
    deals_closed: '🏠',
    revenue: '💵',
    leads_captured: '📍',
    profit: '📈',
  }
  return icons[goalType] || '🎯'
}

/**
 * Format goal value based on type
 */
export function formatGoalValue(goalType: string, value: number): string {
  if (goalType === 'revenue' || goalType === 'profit') {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }
  return value.toString()
}

export const dashboardService = {
  getDailyFocus,
  getUserGoals,
  createUserGoal,
  updateUserGoal,
  deleteUserGoal,
  getQuickWinSuggestions,
  getPipelineHealth,
  getTimeBasedGreeting,
  getGoalTypeLabel,
  getGoalTypeIcon,
  formatGoalValue,
}
