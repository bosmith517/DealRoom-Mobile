/**
 * Calendar Service
 *
 * Service for managing calendar events in the mobile app.
 * Supports fetching today's appointments and upcoming events.
 */

import { supabase } from '../lib/supabase'

// Event types
export type EventType =
  | 'follow_up'
  | 'appointment'
  | 'showing'
  | 'inspection'
  | 'appraisal'
  | 'closing'
  | 'walkthrough'
  | 'meeting'
  | 'call'
  | 'task_deadline'
  | 'reminder'
  | 'other'

export type EventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'tentative'
  | 'canceled'
  | 'completed'
  | 'no_show'
  | 'rescheduled'

// Recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'none'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval?: number // e.g., every 2 weeks
  endDate?: string // When recurrence ends
  count?: number // Number of occurrences
  daysOfWeek?: number[] // 0-6 for weekly (Sunday = 0)
  dayOfMonth?: number // 1-31 for monthly
}

export interface CalendarEvent {
  id: string
  tenant_id: string
  title: string
  description?: string
  event_type: EventType
  status: EventStatus
  start_time: string
  end_time: string
  timezone: string
  all_day: boolean
  location?: string
  location_type?: 'property' | 'office' | 'virtual' | 'phone' | 'other'
  deal_id?: string
  lead_id?: string
  contact_id?: string
  property_id?: string
  // Recurrence fields
  is_recurring?: boolean
  recurrence_rule?: RecurrenceRule
  parent_event_id?: string // For instances of recurring events
  original_start_time?: string // Original time for modified instances
  created_at: string
  updated_at: string
}

// Helper to format time
function formatEventTime(startTime: string, endTime: string, allDay: boolean): string {
  if (allDay) return 'All Day'

  const start = new Date(startTime)
  const end = new Date(endTime)

  const formatTime = (date: Date) => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return minutes > 0 ? `${displayHours}:${displayMinutes} ${ampm}` : `${displayHours} ${ampm}`
  }

  return `${formatTime(start)} - ${formatTime(end)}`
}

// Get event type icon
function getEventTypeIcon(eventType: EventType): string {
  const icons: Record<EventType, string> = {
    follow_up: '📞',
    appointment: '📅',
    showing: '🏠',
    inspection: '🔍',
    appraisal: '📊',
    closing: '🔑',
    walkthrough: '🚶',
    meeting: '👥',
    call: '☎️',
    task_deadline: '⏰',
    reminder: '🔔',
    other: '📌',
  }
  return icons[eventType] || '📌'
}

// Get event type color
function getEventTypeColor(eventType: EventType): string {
  const colors: Record<EventType, string> = {
    follow_up: '#3B82F6',
    appointment: '#8B5CF6',
    showing: '#10B981',
    inspection: '#F59E0B',
    appraisal: '#EF4444',
    closing: '#34B55A',
    walkthrough: '#6366F1',
    meeting: '#EC4899',
    call: '#06B6D4',
    task_deadline: '#EF4444',
    reminder: '#F97316',
    other: '#6B7280',
  }
  return colors[eventType] || '#6B7280'
}

// Get recurrence label
function getRecurrenceLabel(rule: RecurrenceRule | undefined): string | null {
  if (!rule || rule.frequency === 'none') return null

  const labels: Record<RecurrenceFrequency, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Every 2 Weeks',
    monthly: 'Monthly',
    yearly: 'Yearly',
    none: '',
  }

  let label = labels[rule.frequency]

  if (rule.interval && rule.interval > 1) {
    switch (rule.frequency) {
      case 'daily':
        label = `Every ${rule.interval} days`
        break
      case 'weekly':
        label = `Every ${rule.interval} weeks`
        break
      case 'monthly':
        label = `Every ${rule.interval} months`
        break
      case 'yearly':
        label = `Every ${rule.interval} years`
        break
    }
  }

  return label
}

// Get recurrence icon
function getRecurrenceIcon(): string {
  return '🔄'
}

// Calendar service
export const calendarService = {
  /**
   * Get today's events for the current user
   */
  async getTodayEvents(): Promise<{
    data: CalendarEvent[] | null
    error: Error | null
  }> {
    try {
      // Get start and end of today in UTC
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

      const { data, error } = await supabase
        .from('dealroom_calendar_events')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lt('start_time', endOfDay.toISOString())
        .neq('status', 'canceled')
        .order('start_time', { ascending: true })

      if (error) throw error

      return { data: data as CalendarEvent[], error: null }
    } catch (err) {
      console.error('[calendarService] Error fetching today events:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(days: number = 7): Promise<{
    data: CalendarEvent[] | null
    error: Error | null
  }> {
    try {
      const now = new Date()
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('dealroom_calendar_events')
        .select('*')
        .gte('start_time', now.toISOString())
        .lt('start_time', futureDate.toISOString())
        .neq('status', 'canceled')
        .order('start_time', { ascending: true })
        .limit(20)

      if (error) throw error

      return { data: data as CalendarEvent[], error: null }
    } catch (err) {
      console.error('[calendarService] Error fetching upcoming events:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get events for a specific day
   */
  async getEventsForDay(date: Date): Promise<{
    data: CalendarEvent[] | null
    error: Error | null
  }> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const { data, error } = await supabase
        .from('dealroom_calendar_events')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lt('start_time', endOfDay.toISOString())
        .neq('status', 'canceled')
        .order('start_time', { ascending: true })

      if (error) throw error

      return { data: data as CalendarEvent[], error: null }
    } catch (err) {
      console.error('[calendarService] Error fetching events for day:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<{
    data: CalendarEvent | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_calendar_events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error

      return { data: data as CalendarEvent, error: null }
    } catch (err) {
      console.error('[calendarService] Error fetching event:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Update event status
   */
  async updateEventStatus(
    eventId: string,
    status: EventStatus
  ): Promise<{
    data: CalendarEvent | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_calendar_events')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select()
        .single()

      if (error) throw error

      return { data: data as CalendarEvent, error: null }
    } catch (err) {
      console.error('[calendarService] Error updating event status:', err)
      return { data: null, error: err as Error }
    }
  },

  // Helpers
  formatEventTime,
  getEventTypeIcon,
  getEventTypeColor,
  getRecurrenceLabel,
  getRecurrenceIcon,
}
