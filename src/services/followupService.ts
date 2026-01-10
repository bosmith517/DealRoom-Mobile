/**
 * Followup Service (Mobile)
 *
 * Manages tasks, followups, and reminders for the mobile app.
 * Adapted from web app's followupService.
 */

import { supabase } from '../lib/supabase'

export interface Followup {
  id: string
  tenant_id: string
  entity_type: 'deal' | 'lead' | 'contact' | 'property'
  entity_id: string
  title: string
  description?: string
  task_type: 'follow_up' | 'call' | 'email' | 'meeting' | 'site_visit' | 'document' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  due_time?: string
  reminder_at?: string
  is_recurring: boolean
  recurrence_pattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurrence_end_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'snoozed'
  completed_at?: string
  snoozed_until?: string
  assigned_to_user_id?: string
  outcome?: 'connected' | 'voicemail' | 'no_answer' | 'wrong_number' | 'not_interested' | 'scheduled_callback'
  outcome_notes?: string
  created_by_user_id: string
  created_at: string
  updated_at: string
  // Joined fields
  assigned_to_name?: string
  entity_name?: string
}

export interface CreateFollowupInput {
  entity_type?: Followup['entity_type']
  entity_id?: string
  title: string
  description?: string
  task_type?: Followup['task_type']
  priority?: Followup['priority']
  due_date?: string
  due_time?: string
  reminder_at?: string
  is_recurring?: boolean
  recurrence_pattern?: Followup['recurrence_pattern']
  recurrence_end_date?: string
  assigned_to_user_id?: string
}

export interface UpdateFollowupInput {
  title?: string
  description?: string
  task_type?: Followup['task_type']
  priority?: Followup['priority']
  due_date?: string
  due_time?: string
  reminder_at?: string
  status?: Followup['status']
  outcome?: Followup['outcome']
  outcome_notes?: string
  assigned_to_user_id?: string
  snoozed_until?: string
}

export interface FollowupCounts {
  pending: number
  overdue: number
  dueToday: number
  upcoming: number
  completed: number
}

class FollowupService {
  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Get all followups for a user (assigned to them or created by them)
   */
  async getMyFollowups(options?: {
    status?: Followup['status'] | Followup['status'][]
    priority?: Followup['priority']
    dueToday?: boolean
    overdue?: boolean
    upcoming?: boolean
    limit?: number
    offset?: number
  }): Promise<{ data: Followup[] | null; error: Error | null }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      let query = supabase
        .from('dealroom_followups')
        .select('*')
        .or(`assigned_to_user_id.eq.${userData.user.id},created_by_user_id.eq.${userData.user.id}`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })

      if (options?.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status)
        } else {
          query = query.eq('status', options.status)
        }
      }

      if (options?.priority) {
        query = query.eq('priority', options.priority)
      }

      const today = this.getToday()

      if (options?.dueToday) {
        query = query.eq('due_date', today)
      }

      if (options?.overdue) {
        query = query
          .lt('due_date', today)
          .eq('status', 'pending')
      }

      if (options?.upcoming) {
        query = query
          .gt('due_date', today)
          .eq('status', 'pending')
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('[FollowupService] Error fetching followups:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get followups grouped by section (overdue, today, upcoming)
   */
  async getGroupedFollowups(): Promise<{
    data: {
      overdue: Followup[]
      today: Followup[]
      upcoming: Followup[]
    } | null
    error: Error | null
  }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const { data, error } = await supabase
        .from('dealroom_followups')
        .select('*')
        .or(`assigned_to_user_id.eq.${userData.user.id},created_by_user_id.eq.${userData.user.id}`)
        .in('status', ['pending', 'in_progress', 'snoozed'])
        .order('due_date', { ascending: true })
        .order('priority', { ascending: false })

      if (error) {
        console.error('[FollowupService] Error fetching followups:', error)
        return { data: null, error }
      }

      const today = this.getToday()
      const followups = data || []

      // Check if snoozed items should be unpaused
      const now = new Date().toISOString()

      return {
        data: {
          overdue: followups.filter(f => {
            if (f.status === 'snoozed' && f.snoozed_until && f.snoozed_until <= now) {
              return f.due_date && f.due_date < today
            }
            return f.status === 'pending' && f.due_date && f.due_date < today
          }),
          today: followups.filter(f => {
            if (f.status === 'snoozed' && f.snoozed_until && f.snoozed_until <= now) {
              return f.due_date === today
            }
            return f.status === 'pending' && f.due_date === today
          }),
          upcoming: followups.filter(f => {
            if (f.status === 'snoozed' && f.snoozed_until && f.snoozed_until > now) {
              return true // Show in upcoming
            }
            return f.status === 'pending' && (!f.due_date || f.due_date > today)
          }),
        },
        error: null,
      }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get followups for a specific entity
   */
  async getFollowupsForEntity(
    entityType: Followup['entity_type'],
    entityId: string,
    options?: {
      includeCompleted?: boolean
      limit?: number
    }
  ): Promise<{ data: Followup[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('dealroom_followups')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('due_date', { ascending: true })

      if (!options?.includeCompleted) {
        query = query.neq('status', 'completed').neq('status', 'cancelled')
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('[FollowupService] Error fetching followups:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Create a new followup
   */
  async createFollowup(input: CreateFollowupInput): Promise<{ data: Followup | null; error: Error | null }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userData.user.id)
        .single()

      if (!tenantUser?.tenant_id) {
        return { data: null, error: new Error('No tenant found') }
      }

      // Build insert data - entity fields are optional for standalone tasks
      const insertData: Record<string, unknown> = {
        tenant_id: tenantUser.tenant_id,
        title: input.title,
        description: input.description,
        task_type: input.task_type || 'follow_up',
        priority: input.priority || 'medium',
        due_date: input.due_date,
        due_time: input.due_time,
        reminder_at: input.reminder_at,
        is_recurring: input.is_recurring || false,
        recurrence_pattern: input.recurrence_pattern,
        recurrence_end_date: input.recurrence_end_date,
        assigned_to_user_id: input.assigned_to_user_id || userData.user.id,
        created_by_user_id: userData.user.id,
      }

      // Only add entity fields if provided
      if (input.entity_type && input.entity_id) {
        insertData.entity_type = input.entity_type
        insertData.entity_id = input.entity_id
      }

      const { data, error } = await supabase
        .from('dealroom_followups')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('[FollowupService] Error creating followup:', error)
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Create a followup (alias for createFollowup)
   */
  async create(input: CreateFollowupInput): Promise<{ data: Followup | null; error: Error | null }> {
    return this.createFollowup(input)
  }

  /**
   * Update a followup
   */
  async updateFollowup(
    followupId: string,
    input: UpdateFollowupInput
  ): Promise<{ data: Followup | null; error: Error | null }> {
    try {
      const updateData: Record<string, unknown> = {
        ...input,
        updated_at: new Date().toISOString(),
      }

      // Set completed_at if marking as completed
      if (input.status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('dealroom_followups')
        .update(updateData)
        .eq('id', followupId)
        .select()
        .single()

      if (error) {
        console.error('[FollowupService] Error updating followup:', error)
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Mark as completed
   */
  async complete(
    followupId: string,
    outcome?: Followup['outcome'],
    outcomeNotes?: string
  ): Promise<{ data: Followup | null; error: Error | null }> {
    return this.updateFollowup(followupId, {
      status: 'completed',
      outcome,
      outcome_notes: outcomeNotes,
    })
  }

  /**
   * Snooze a followup for a duration
   */
  async snooze(
    followupId: string,
    duration: '1h' | '3h' | 'tomorrow' | 'nextWeek'
  ): Promise<{ data: Followup | null; error: Error | null }> {
    const now = new Date()
    let until: Date

    switch (duration) {
      case '1h':
        until = new Date(now.getTime() + 60 * 60 * 1000)
        break
      case '3h':
        until = new Date(now.getTime() + 3 * 60 * 60 * 1000)
        break
      case 'tomorrow':
        until = new Date(now)
        until.setDate(until.getDate() + 1)
        until.setHours(9, 0, 0, 0)
        break
      case 'nextWeek':
        until = new Date(now)
        until.setDate(until.getDate() + 7)
        until.setHours(9, 0, 0, 0)
        break
    }

    return this.updateFollowup(followupId, {
      status: 'snoozed',
      snoozed_until: until.toISOString(),
    })
  }

  /**
   * Snooze a followup to a specific date and time
   */
  async snoozeToDate(
    followupId: string,
    dueDate: string,
    dueTime: string
  ): Promise<{ data: Followup | null; error: Error | null }> {
    const until = new Date(`${dueDate}T${dueTime}:00`)

    return this.updateFollowup(followupId, {
      status: 'snoozed',
      snoozed_until: until.toISOString(),
      due_date: dueDate,
      due_time: dueTime,
    })
  }

  /**
   * Delete a followup
   */
  async deleteFollowup(followupId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('dealroom_followups')
        .delete()
        .eq('id', followupId)

      if (error) {
        console.error('[FollowupService] Error deleting followup:', error)
        return { error }
      }

      return { error: null }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { error: err as Error }
    }
  }

  /**
   * Get followup counts by status
   */
  async getFollowupCounts(): Promise<{ data: FollowupCounts | null; error: Error | null }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const today = this.getToday()

      const { data, error } = await supabase
        .from('dealroom_followups')
        .select('id, status, due_date')
        .or(`assigned_to_user_id.eq.${userData.user.id},created_by_user_id.eq.${userData.user.id}`)

      if (error) {
        return { data: null, error }
      }

      const followups = data || []

      return {
        data: {
          pending: followups.filter((f) => f.status === 'pending').length,
          overdue: followups.filter((f) => f.status === 'pending' && f.due_date && f.due_date < today).length,
          dueToday: followups.filter((f) => f.status === 'pending' && f.due_date === today).length,
          upcoming: followups.filter((f) => f.status === 'pending' && (!f.due_date || f.due_date > today)).length,
          completed: followups.filter((f) => f.status === 'completed').length,
        },
        error: null,
      }
    } catch (err) {
      console.error('[FollowupService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Quick add call followup
   */
  async quickAddCallFollowup(
    entityType: Followup['entity_type'],
    entityId: string,
    phoneNumber: string,
    dueDate?: string
  ): Promise<{ data: Followup | null; error: Error | null }> {
    return this.createFollowup({
      entity_type: entityType,
      entity_id: entityId,
      title: `Call ${phoneNumber}`,
      task_type: 'call',
      priority: 'medium',
      due_date: dueDate || this.getToday(),
    })
  }
}

export const followupService = new FollowupService()
export default followupService
