/**
 * Data Service
 *
 * Direct Supabase queries for deals, properties, and dashboard stats.
 * This is the primary data layer for the mobile app.
 */

import { supabase } from '../lib/supabase'
import { skipTraceService } from './skipTrace'
import type {
  Deal,
  DealWithProperty,
  Property,
  Underwriting,
  Followup,
  DashboardStats,
  DealStage,
  Lead,
} from '../types'

// Google Maps API key for Street View
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''

/**
 * Generate Google Street View URL for a location
 * Returns null if no API key is configured
 */
export function getStreetViewUrl(
  lat: number,
  lng: number,
  options?: {
    width?: number
    height?: number
    heading?: number
    pitch?: number
    fov?: number
  }
): string | null {
  if (!GOOGLE_MAPS_API_KEY) {
    return null
  }

  const {
    width = 600,
    height = 400,
    heading = 0,
    pitch = 0,
    fov = 90,
  } = options || {}

  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`
}

// ============================================================================
// Deals
// ============================================================================

export async function getDeals(options?: {
  stage?: DealStage
  status?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: DealWithProperty[]; error: Error | null }> {
  try {
    // Query deals and join properties via deal_id FK on properties table
    let query = supabase
      .from('dealroom_deals')
      .select(`
        *,
        property:dealroom_properties!deal_id(*)
      `)
      .order('created_at', { ascending: false })

    if (options?.stage) {
      query = query.eq('stage', options.stage)
    }

    if (options?.status) {
      query = query.eq('status', options.status)
    } else {
      // Default to active deals
      query = query.eq('status', 'active')
    }

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%`)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error } = await query

    if (error) throw error

    // Normalize: property comes back as array (one-to-many), take first
    const normalized = (data || []).map((deal: any) => ({
      ...deal,
      property: Array.isArray(deal.property) ? deal.property[0] || null : deal.property,
    }))

    return { data: normalized as DealWithProperty[], error: null }
  } catch (err) {
    console.error('Error fetching deals:', err)
    return { data: [], error: err as Error }
  }
}

export async function getDeal(dealId: string): Promise<{ data: DealWithProperty | null; error: Error | null }> {
  try {
    // Query deal with property join via deal_id FK
    const { data, error } = await supabase
      .from('dealroom_deals')
      .select(`
        *,
        property:dealroom_properties!deal_id(*)
      `)
      .eq('id', dealId)
      .single()

    if (error) {
      console.error('getDeal query error:', error.message, error.details, error.hint)

      // If join fails, try without join
      const { data: dealOnly, error: dealError } = await supabase
        .from('dealroom_deals')
        .select('*')
        .eq('id', dealId)
        .single()

      if (dealError) {
        console.error('getDeal fallback error:', dealError.message)
        throw dealError
      }

      // Fetch property separately via deal_id
      const { data: propData } = await supabase
        .from('dealroom_properties')
        .select('*')
        .eq('deal_id', dealOnly.id)
        .maybeSingle()

      return { data: { ...dealOnly, property: propData } as DealWithProperty, error: null }
    }

    // Normalize: property comes back as array, take first
    const normalized = {
      ...data,
      property: Array.isArray(data.property) ? data.property[0] || null : data.property,
    }

    return { data: normalized as DealWithProperty, error: null }
  } catch (err) {
    console.error('Error fetching deal:', err)
    return { data: null, error: err as Error }
  }
}

export interface CreateDealOptions {
  name: string
  stage?: DealStage
  source?: string
  address_line1?: string
  city?: string
  state?: string
  zip?: string
  lat?: number
  lng?: number
  notes?: string
  tags?: string[]
  strategy?: string
  lead_id?: string // Link to original lead if converting
}

export async function createDeal(options: CreateDealOptions): Promise<{ data: Deal | null; error: Error | null }> {
  try {
    // Get user and tenant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (tenantError || !tenantUser?.tenant_id) {
      throw new Error('No tenant assigned')
    }

    // Create the deal in dealroom_deals (standalone, no CRM dependency)
    const { data: deal, error: dealError } = await supabase
      .from('dealroom_deals')
      .insert({
        tenant_id: tenantUser.tenant_id,
        name: options.name,
        stage: options.stage || 'prospecting',
        exit_strategy: options.strategy || 'flip',
        source: options.source || 'manual',
        owner_user_id: user.id,
        lead_id: options.lead_id || null,
        notes: options.notes,
      })
      .select()
      .single()

    if (dealError) throw dealError

    // Create property if we have address info, linked to the deal
    if (options.address_line1) {
      const { error: propError } = await supabase
        .from('dealroom_properties')
        .insert({
          tenant_id: tenantUser.tenant_id,
          deal_id: deal.id,
          address_line1: options.address_line1,
          city: options.city || '',
          state: options.state || '',
          zip: options.zip || '',
          lat: options.lat,
          lng: options.lng,
        })

      if (propError) {
        console.error('Property creation error:', propError)
        // Continue - deal is still valid
      }
    }

    // If converting from a lead, mark lead as converted
    if (options.lead_id) {
      await supabase
        .from('dealroom_leads')
        .update({
          status: 'converted_to_deal',
          converted_deal_id: deal.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', options.lead_id)
    }

    return { data: deal as Deal, error: null }
  } catch (err) {
    console.error('Error creating deal:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateDeal(
  dealId: string,
  updates: Partial<Deal>
): Promise<{ data: Deal | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_deals')
      .update(updates)
      .eq('id', dealId)
      .select()
      .single()

    if (error) throw error

    return { data: data as Deal, error: null }
  } catch (err) {
    console.error('Error updating deal:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateDealStage(
  dealId: string,
  stage: DealStage
): Promise<{ data: Deal | null; error: Error | null }> {
  return updateDeal(dealId, { stage })
}

// ============================================================================
// Properties
// ============================================================================

export async function getProperty(propertyId: string): Promise<{ data: Property | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (error) throw error

    return { data: data as Property, error: null }
  } catch (err) {
    console.error('Error fetching property:', err)
    return { data: null, error: err as Error }
  }
}

export async function createProperty(property: Partial<Property>): Promise<{ data: Property | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_properties')
      .insert(property)
      .select()
      .single()

    if (error) throw error

    return { data: data as Property, error: null }
  } catch (err) {
    console.error('Error creating property:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateProperty(
  propertyId: string,
  updates: Partial<Property>
): Promise<{ data: Property | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) throw error

    return { data: data as Property, error: null }
  } catch (err) {
    console.error('Error updating property:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Underwriting
// ============================================================================

export async function getUnderwriting(opportunityId: string): Promise<{ data: Underwriting[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_underwriting_snapshots')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { data: data as Underwriting[], error: null }
  } catch (err) {
    console.error('Error fetching underwriting:', err)
    return { data: null, error: err as Error }
  }
}

export async function getLatestUnderwriting(opportunityId: string): Promise<{ data: Underwriting | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_underwriting_snapshots')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    return { data: data as Underwriting | null, error: null }
  } catch (err) {
    console.error('Error fetching latest underwriting:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Leads (Driving Captures)
// ============================================================================

// Lead type is exported from types/contracts.ts

export async function getLeads(options?: {
  status?: string
  sessionId?: string
  minScore?: number
  distressSignal?: string
  limit?: number
  offset?: number
}): Promise<{ data: Lead[]; error: Error | null }> {
  try {
    let query = supabase
      .from('dealroom_leads')
      .select('*')
      .order('rank_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    // Filter by status (default: active, not converted)
    if (options?.status) {
      query = query.eq('status', options.status)
    } else {
      query = query.neq('status', 'converted')
    }

    if (options?.sessionId) {
      query = query.eq('session_id', options.sessionId)
    }

    // Filter by minimum score
    if (options?.minScore && options.minScore > 0) {
      query = query.gte('rank_score', options.minScore)
    }

    // Filter by distress signal (JSONB array contains)
    if (options?.distressSignal) {
      query = query.contains('distress_signals', [options.distressSignal])
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error } = await query

    if (error) throw error

    // Map address_line1 to address (schema mismatch fix)
    const mapped = (data || []).map((lead: any) => ({
      ...lead,
      address: lead.address_line1 || lead.address,
    }))

    return { data: mapped as Lead[], error: null }
  } catch (err) {
    console.error('Error fetching leads:', err)
    return { data: [], error: err as Error }
  }
}

export async function getLead(leadId: string): Promise<{ data: Lead | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_leads')
      .select(`
        *,
        media:dealroom_lead_media(storage_path),
        lead_tags:dealroom_lead_tags(tag_key, tag_label)
      `)
      .eq('id', leadId)
      .single()

    if (error) throw error

    // Get photo URL: prefer captured photo, fallback to Street View
    let photoUrl: string | undefined
    if (data.media?.[0]?.storage_path) {
      photoUrl = getStorageUrl(data.media[0].storage_path)
    } else if (data.lat && data.lng) {
      // Fallback to Google Street View
      photoUrl = getStreetViewUrl(data.lat, data.lng) || undefined
    }

    // Map address_line1 to address and process related data
    const mapped = {
      ...data,
      address: data.address_line1 || data.address,
      // Hydrate tags array from joined table
      tags: data.lead_tags?.map((t: { tag_key: string }) => t.tag_key) || data.tags || [],
      // Photo URL (captured or Street View)
      photo_url: photoUrl,
    }

    return { data: mapped as Lead, error: null }
  } catch (err) {
    console.error('Error fetching lead:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>
): Promise<{ data: Lead | null; error: Error | null }> {
  try {
    // Map address to address_line1 for database (schema mismatch fix)
    const dbUpdates: any = { ...updates }
    if ('address' in dbUpdates) {
      dbUpdates.address_line1 = dbUpdates.address
      delete dbUpdates.address
    }

    const { data, error } = await supabase
      .from('dealroom_leads')
      .update(dbUpdates)
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error

    // Map address_line1 back to address in response
    const mapped = {
      ...data,
      address: data.address_line1 || data.address,
    }

    return { data: mapped as Lead, error: null }
  } catch (err) {
    console.error('Error updating lead:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Dashboard Stats
// ============================================================================

export async function getDashboardStats(): Promise<{ data: DashboardStats | null; error: Error | null }> {
  try {
    // Get all active deals with underwriting data
    const { data: deals, error: dealsError } = await supabase
      .from('dealroom_deals')
      .select(`
        id,
        stage,
        status,
        contract_price,
        offer_price,
        asking_price,
        actual_close_date,
        stage_entered_at,
        created_at
      `)

    if (dealsError) throw dealsError

    // Calculate stats
    const activeDeals = deals?.filter((d) => d.status === 'active') || []
    const allDeals = deals || []

    // Deals by stage
    const dealsByStage: Record<string, number> = {}
    activeDeals.forEach((deal) => {
      dealsByStage[deal.stage] = (dealsByStage[deal.stage] || 0) + 1
    })

    // Pipeline value (sum of contract_price or offer_price or asking_price)
    const pipelineValue = activeDeals.reduce((sum, deal) => {
      const value = deal.contract_price || deal.offer_price || deal.asking_price || 0
      return sum + value
    }, 0)

    // Closed this month
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const closedThisMonth = allDeals.filter(
      (d) => d.status === 'won' && d.actual_close_date && d.actual_close_date >= firstOfMonth
    ).length

    // Closed YTD
    const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
    const closedYTD = allDeals.filter(
      (d) => d.status === 'won' && d.actual_close_date && d.actual_close_date >= firstOfYear
    ).length

    // Average days to close (for closed deals)
    const closedDeals = allDeals.filter((d) => d.status === 'won' && d.actual_close_date && d.created_at)
    let avgDaysToClose = 0
    if (closedDeals.length > 0) {
      const totalDays = closedDeals.reduce((sum, deal) => {
        const created = new Date(deal.created_at)
        const closed = new Date(deal.actual_close_date!)
        const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return sum + days
      }, 0)
      avgDaysToClose = Math.round(totalDays / closedDeals.length)
    }

    const stats: DashboardStats = {
      totalDeals: allDeals.length,
      activeDeals: activeDeals.length,
      pipelineValue,
      closedThisMonth,
      closedYTD,
      avgDaysToClose,
      dealsByStage: dealsByStage as Record<DealStage, number>,
    }

    return { data: stats, error: null }
  } catch (err) {
    console.error('Error fetching dashboard stats:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Recent Activity
// ============================================================================

export async function getRecentDeals(limit = 5): Promise<{ data: DealWithProperty[]; error: Error | null }> {
  return getDeals({ status: 'active', limit })
}

// ============================================================================
// Followups
// ============================================================================

export async function getUpcomingFollowups(limit = 10): Promise<{ data: Followup[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_followups')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .gte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    return { data: data as Followup[], error: null }
  } catch (err) {
    console.error('Error fetching followups:', err)
    return { data: [], error: err as Error }
  }
}

export async function getOverdueFollowups(): Promise<{ data: Followup[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_followups')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .lt('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })

    if (error) throw error

    return { data: data as Followup[], error: null }
  } catch (err) {
    console.error('Error fetching overdue followups:', err)
    return { data: [], error: err as Error }
  }
}

export async function getTodayFollowups(): Promise<{ data: Followup[]; error: Error | null }> {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    const { data, error } = await supabase
      .from('dealroom_followups')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .gte('due_at', startOfDay)
      .lt('due_at', endOfDay)
      .order('due_at', { ascending: true })

    if (error) throw error

    return { data: data as Followup[], error: null }
  } catch (err) {
    console.error('Error fetching today followups:', err)
    return { data: [], error: err as Error }
  }
}

export async function getAllFollowups(options?: {
  status?: Followup['status'][]
  limit?: number
}): Promise<{ data: Followup[]; error: Error | null }> {
  try {
    let query = supabase
      .from('dealroom_followups')
      .select('*')
      .order('due_at', { ascending: true })

    if (options?.status && options.status.length > 0) {
      query = query.in('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return { data: data as Followup[], error: null }
  } catch (err) {
    console.error('Error fetching all followups:', err)
    return { data: [], error: err as Error }
  }
}

export async function createFollowup(followup: Partial<Followup>): Promise<{ data: Followup | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_followups')
      .insert({
        title: followup.title,
        description: followup.description,
        followup_type: followup.followup_type || 'task',
        due_at: followup.due_at,
        remind_at: followup.remind_at,
        deal_id: followup.deal_id,
        lead_id: followup.lead_id,
        recurring_pattern: followup.recurring_pattern || 'none',
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error

    return { data: data as Followup, error: null }
  } catch (err) {
    console.error('Error creating followup:', err)
    return { data: null, error: err as Error }
  }
}

export async function updateFollowup(
  id: string,
  updates: Partial<Followup>
): Promise<{ data: Followup | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('dealroom_followups')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data: data as Followup, error: null }
  } catch (err) {
    console.error('Error updating followup:', err)
    return { data: null, error: err as Error }
  }
}

// Calculate next due date based on recurring pattern
function getNextDueDate(currentDue: Date, pattern: string): Date {
  const next = new Date(currentDue)
  switch (pattern) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

export async function completeFollowup(
  id: string,
  outcome?: string
): Promise<{ data: Followup | null; nextFollowup: Followup | null; error: Error | null }> {
  try {
    // First get the followup to check for recurring pattern
    const { data: existing, error: fetchError } = await supabase
      .from('dealroom_followups')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Mark current as done
    const { data, error } = await supabase
      .from('dealroom_followups')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        outcome,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // If recurring, create next instance
    let nextFollowup: Followup | null = null
    if (existing.recurring_pattern && existing.recurring_pattern !== 'none') {
      const nextDueDate = getNextDueDate(new Date(existing.due_at), existing.recurring_pattern)

      const { data: newFollowup, error: createError } = await supabase
        .from('dealroom_followups')
        .insert({
          title: existing.title,
          description: existing.description,
          followup_type: existing.followup_type,
          due_at: nextDueDate.toISOString(),
          deal_id: existing.deal_id,
          lead_id: existing.lead_id,
          recurring_pattern: existing.recurring_pattern,
          parent_followup_id: existing.parent_followup_id || id,
          status: 'open',
        })
        .select()
        .single()

      if (!createError) {
        nextFollowup = newFollowup as Followup
      }
    }

    return { data: data as Followup, nextFollowup, error: null }
  } catch (err) {
    console.error('Error completing followup:', err)
    return { data: null, nextFollowup: null, error: err as Error }
  }
}

export async function snoozeFollowup(
  id: string,
  snoozeDays: number = 1
): Promise<{ data: Followup | null; error: Error | null }> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('dealroom_followups')
      .select('due_at')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const currentDue = new Date(existing.due_at)
    const newDue = new Date(currentDue)
    newDue.setDate(newDue.getDate() + snoozeDays)

    const { data, error } = await supabase
      .from('dealroom_followups')
      .update({
        due_at: newDue.toISOString(),
        status: 'snoozed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Reopen after snooze update
    const { data: reopened, error: reopenError } = await supabase
      .from('dealroom_followups')
      .update({ status: 'open' })
      .eq('id', id)
      .select()
      .single()

    if (reopenError) throw reopenError

    return { data: reopened as Followup, error: null }
  } catch (err) {
    console.error('Error snoozing followup:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Export all functions as dataService object
// ============================================================================

// ============================================================================
// Property Search (ATTOM)
// ============================================================================

export interface ATTOMPropertyResult {
  success: boolean
  property?: any
  cached?: boolean
  cacheId?: string
  attomId?: string
  error?: string
}

export async function searchProperty(
  address: string,
  city?: string,
  state?: string
): Promise<{ data: ATTOMPropertyResult | null; error: Error | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

    const response = await fetch(`${supabaseUrl}/functions/v1/get-attom-property-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, city, state }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Property search failed')
    }

    return { data: result, error: null }
  } catch (err) {
    console.error('Error searching property:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================================================
// Create Deal from Property Search
// ============================================================================

export async function createDealFromProperty(
  propertyData: any,
  cacheId?: string
): Promise<{ data: Deal | null; error: Error | null }> {
  try {
    console.log('createDealFromProperty: Starting...')

    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    console.log('createDealFromProperty: User ID:', user.id)

    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (tenantError) {
      console.error('createDealFromProperty: Tenant lookup error:', tenantError)
      throw new Error(`Tenant lookup failed: ${tenantError.message}`)
    }

    if (!tenantUser?.tenant_id) throw new Error('No tenant assigned')
    console.log('createDealFromProperty: Tenant ID:', tenantUser.tenant_id)

    // Create the deal first in dealroom_deals (standalone, no CRM dependency)
    console.log('createDealFromProperty: Creating deal...')
    const { data: deal, error: dealError } = await supabase
      .from('dealroom_deals')
      .insert({
        tenant_id: tenantUser.tenant_id,
        name: propertyData.location?.address || 'New Property',
        stage: 'prospecting',
        exit_strategy: 'flip',
        source: 'property_search',
        owner_user_id: user.id,
        purchase_price: propertyData.valuation?.avm || propertyData.saleHistory?.lastSalePrice,
      })
      .select()
      .single()

    if (dealError) {
      console.error('createDealFromProperty: Deal error:', dealError)
      throw dealError
    }
    console.log('createDealFromProperty: Deal created:', deal.id)

    // Create the property record linked to the deal
    console.log('createDealFromProperty: Creating property...')
    const { data: property, error: propError } = await supabase
      .from('dealroom_properties')
      .insert({
        tenant_id: tenantUser.tenant_id,
        deal_id: deal.id,
        address_line1: propertyData.location?.address || '',
        city: propertyData.location?.city || '',
        state: propertyData.location?.state || '',
        zip: propertyData.location?.zipCode || '',
        county: propertyData.location?.county || '',
        lat: propertyData.location?.latitude,
        lng: propertyData.location?.longitude,
        property_type: mapPropertyType(propertyData.summary?.proptype),
        bedrooms: propertyData.summary?.bedrooms,
        bathrooms: propertyData.summary?.bathrooms,
        sqft: propertyData.summary?.sqft,
        lot_sqft: propertyData.summary?.lotSqft,
        year_built: propertyData.summary?.yearbuilt,
        stories: propertyData.summary?.stories,
        attom_cache_id: cacheId,
        attom_fetched_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (propError) {
      console.error('createDealFromProperty: Property error:', propError)
      // Deal is still valid even if property creation fails
    } else {
      console.log('createDealFromProperty: Property created:', property.id)
    }

    return { data: deal, error: null }
  } catch (err) {
    console.error('Error creating deal from property:', err)
    return { data: null, error: err as Error }
  }
}

// Map ATTOM property type to our enum
function mapPropertyType(attomType?: string): string {
  if (!attomType) return 'sfr'
  const type = attomType.toUpperCase()
  if (type.includes('SFR') || type.includes('SINGLE')) return 'sfr'
  if (type.includes('MULTI') || type.includes('DUPLEX') || type.includes('TRIPLEX')) return 'multi_2_4'
  if (type.includes('CONDO')) return 'condo'
  if (type.includes('TOWN')) return 'townhouse'
  if (type.includes('LAND') || type.includes('LOT')) return 'land'
  if (type.includes('COMMERCIAL')) return 'commercial'
  return 'sfr'
}

// ============================================================================
// Triage (Swipe Queue)
// ============================================================================

export interface TriageLead extends Lead {
  photo_url?: string
  rank_score?: number
  distress_signals?: string[]
}

export async function getTriageLeads(options?: {
  limit?: number
}): Promise<TriageLead[]> {
  try {
    // Get leads that need triage (new status, not dismissed, not converted)
    // Join tags table to hydrate tags array
    const { data, error } = await supabase
      .from('dealroom_leads')
      .select(`
        *,
        media:dealroom_lead_media(storage_path),
        lead_tags:dealroom_lead_tags(tag_key, tag_label)
      `)
      .in('triage_status', ['new', 'watch'])
      .neq('status', 'converted')
      .order('rank_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50)

    if (error) throw error

    // Map fields to match expected interface
    return (data || []).map((lead: any) => {
      // Get photo URL: prefer captured photo, fallback to Street View
      let photoUrl: string | undefined
      if (lead.media?.[0]?.storage_path) {
        photoUrl = getStorageUrl(lead.media[0].storage_path)
      } else if (lead.lat && lead.lng) {
        // Fallback to Google Street View
        photoUrl = getStreetViewUrl(lead.lat, lead.lng) || undefined
      }

      return {
        ...lead,
        // Map address_line1 to address (schema mismatch fix)
        address: lead.address_line1 || lead.address,
        // Hydrate tags array from joined table
        tags: lead.lead_tags?.map((t: { tag_key: string }) => t.tag_key) || lead.tags || [],
        // Photo URL (captured or Street View)
        photo_url: photoUrl,
        // Ensure distress_signals is always an array
        distress_signals: lead.distress_signals || [],
      }
    })
  } catch (err) {
    console.error('Error fetching triage leads:', err)
    return []
  }
}

function getStorageUrl(path: string): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
  return `${supabaseUrl}/storage/v1/object/public/dealroom-media/${path}`
}

export interface SwipeResult {
  action_key: string
  new_status: string
  followup_created: boolean
  queue_created: boolean
}

export async function handleSwipeAction(
  leadId: string,
  direction: 'left' | 'right' | 'up' | 'down',
  dismissReason?: string
): Promise<SwipeResult | null> {
  try {
    const { data, error } = await supabase.rpc('handle_swipe_action', {
      p_lead_id: leadId,
      p_direction: direction,
      p_dismiss_reason: dismissReason || null,
    })

    if (error) throw error

    const result = data?.[0] || null

    // Auto-trigger skip trace for analyze queue or hot priority swipes
    if (result && (result.action_key === 'QUEUE_ANALYSIS' || result.new_status === 'analyze')) {
      triggerSkipTraceIfNeeded(leadId, 'analyze').catch((err) =>
        console.log('Skip trace auto-trigger skipped:', err.message)
      )
    }

    return result
  } catch (err) {
    console.error('Error handling swipe:', err)
    throw err
  }
}

/**
 * Trigger skip trace for a lead if auto-trigger conditions are met.
 * Runs in the background (non-blocking).
 */
async function triggerSkipTraceIfNeeded(
  leadId: string,
  trigger: 'analyze' | 'hot' | 'score'
): Promise<void> {
  try {
    // Get the lead to check if already skip traced
    const { data: lead, error: leadError } = await supabase
      .from('dealroom_leads')
      .select('id, priority, triage_status, rank_score, skip_traced_at')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return
    }

    // Check if should auto-trigger
    const shouldTrigger = await skipTraceService.shouldAutoTriggerSkipTrace(lead)

    if (shouldTrigger) {
      console.log(`Auto-triggering skip trace for lead ${leadId} (${trigger})`)
      const result = await skipTraceService.runSkipTrace(leadId)

      if (result.success && result.result?.isLitigator) {
        console.warn(`LITIGATOR DETECTED for lead ${leadId}!`)
      }
    }
  } catch (err) {
    console.error('Skip trace auto-trigger failed:', err)
  }
}

/**
 * Mark a lead as hot priority and optionally trigger skip trace
 */
export async function markLeadAsHot(leadId: string): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('dealroom_leads')
      .update({ priority: 'hot', updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error

    // Trigger skip trace for hot leads (non-blocking)
    triggerSkipTraceIfNeeded(leadId, 'hot').catch((err) =>
      console.log('Skip trace auto-trigger skipped:', err.message)
    )

    return data as Lead
  } catch (err) {
    console.error('Error marking lead as hot:', err)
    return null
  }
}

// ============================================================================
// Analyze Queue
// ============================================================================

export interface AnalysisSnapshot {
  id: string
  snapshot: {
    arv_low?: number
    arv_high?: number
    arv_confidence?: string
    rent_low?: number
    rent_high?: number
    equity_estimate?: number
    equity_percent?: number
    tax_assessed?: number
    last_sale_price?: number
    last_sale_date?: string
    owner_occupied?: boolean
    absentee_owner?: boolean
    foreclosure_status?: string
    distress_score?: number
    distress_reasons?: string[]
    buy_box_fit?: string
    mao_flip?: number
    mao_brrrr?: number
    mao_wholesale?: number
    risk_flags?: string[]
    comps_used?: number
  }
  ai_summary?: string
  ai_next_actions?: string[]
  created_at: string
}

export interface AnalyzeQueueItem {
  id: string
  tenant_id: string
  lead_id: string | null
  property_id: string | null
  status: 'queued' | 'fetching' | 'ready' | 'failed' | 'converted'
  priority: 'low' | 'normal' | 'high' | 'hot'
  rank_score: number
  last_error?: string
  queued_at: string
  analysis_completed_at?: string
  lead?: TriageLead
  snapshot?: AnalysisSnapshot
}

export async function getAnalyzeQueue(): Promise<AnalyzeQueueItem[]> {
  try {
    const { data, error } = await supabase
      .from('dealroom_analyze_queue')
      .select(`
        *,
        lead:dealroom_leads(*),
        snapshot:dealroom_analysis_snapshots(*)
      `)
      .not('status', 'eq', 'converted')
      .order('priority', { ascending: false })
      .order('rank_score', { ascending: false })
      .order('queued_at', { ascending: true })

    if (error) throw error

    // Flatten the snapshot (take first if multiple)
    return (data || []).map((item: any) => ({
      ...item,
      lead: item.lead,
      snapshot: Array.isArray(item.snapshot) ? item.snapshot[0] : item.snapshot,
    }))
  } catch (err) {
    console.error('Error fetching analyze queue:', err)
    return []
  }
}

export async function runQuickAnalysis(leadId: string): Promise<AnalysisSnapshot | null> {
  try {
    // Get user and tenant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (!tenantUser?.tenant_id) throw new Error('No tenant')

    // Get the lead data
    const { data: lead, error: leadError } = await supabase
      .from('dealroom_leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) throw new Error('Lead not found')

    // Update queue status to fetching
    await supabase
      .from('dealroom_analyze_queue')
      .update({ status: 'fetching', analysis_started_at: new Date().toISOString() })
      .eq('lead_id', leadId)

    // If we have an address, try to fetch ATTOM data
    let attomData = null
    if (lead.address) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

        const response = await fetch(`${supabaseUrl}/functions/v1/get-attom-property-data`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: lead.address,
            city: lead.city,
            state: lead.state,
          }),
        })

        if (response.ok) {
          attomData = await response.json()
        }
      } catch (attomErr) {
        console.error('ATTOM fetch failed:', attomErr)
      }
    }

    // Build the snapshot from available data
    const snapshotData = buildAnalysisSnapshot(lead, attomData)

    // Create the snapshot record
    const { data: snapshot, error: snapError } = await supabase
      .from('dealroom_analysis_snapshots')
      .insert({
        tenant_id: tenantUser.tenant_id,
        lead_id: leadId,
        snapshot: snapshotData,
        ai_summary: generateAISummary(snapshotData),
        ai_next_actions: generateNextActions(snapshotData),
        data_sources: attomData ? ['attom', 'driving_tags'] : ['driving_tags'],
      })
      .select()
      .single()

    if (snapError) throw snapError

    // Update queue status to ready
    await supabase
      .from('dealroom_analyze_queue')
      .update({
        status: 'ready',
        analysis_completed_at: new Date().toISOString(),
      })
      .eq('lead_id', leadId)

    // Update lead with score
    await supabase
      .from('dealroom_leads')
      .update({
        rank_score: snapshotData.distress_score || 0,
        distress_signals: snapshotData.distress_reasons || [],
        last_scored_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    return snapshot as AnalysisSnapshot
  } catch (err) {
    console.error('Error running analysis:', err)

    // Update queue with error
    await supabase
      .from('dealroom_analyze_queue')
      .update({
        status: 'failed',
        last_error: (err as Error).message,
      })
      .eq('lead_id', leadId)

    throw err
  }
}

function buildAnalysisSnapshot(lead: Lead, attomData?: any): AnalysisSnapshot['snapshot'] {
  const snapshot: AnalysisSnapshot['snapshot'] = {}
  const reasons: string[] = []

  // Score from tags
  let distressScore = 0
  const tags = lead.tags || []

  if (tags.includes('vacant')) {
    distressScore += 25
    reasons.push('vacant_property')
  }
  if (tags.includes('boarded')) {
    distressScore += 30
    reasons.push('boarded_windows')
  }
  if (tags.includes('overgrown')) {
    distressScore += 15
    reasons.push('overgrown_yard')
  }
  if (tags.includes('mail_pileup')) {
    distressScore += 20
    reasons.push('mail_pileup')
  }
  if (tags.includes('code_violation')) {
    distressScore += 25
    reasons.push('code_violation')
  }
  if (lead.priority === 'hot') {
    distressScore += 15
    reasons.push('marked_hot')
  }

  snapshot.distress_score = Math.min(distressScore, 100)
  snapshot.distress_reasons = reasons

  // Add ATTOM data if available
  if (attomData?.property) {
    const prop = attomData.property

    // Valuation
    if (prop.valuation?.avm) {
      const avm = prop.valuation.avm
      snapshot.arv_low = Math.round(avm * 0.9)
      snapshot.arv_high = Math.round(avm * 1.1)
      snapshot.arv_confidence = 'medium'
    }

    // Rent estimate (rough)
    if (prop.valuation?.avm) {
      snapshot.rent_low = Math.round(prop.valuation.avm * 0.006) // 0.6% rule low
      snapshot.rent_high = Math.round(prop.valuation.avm * 0.008) // 0.8% rule high
    }

    // Sale history
    if (prop.saleHistory?.lastSalePrice) {
      snapshot.last_sale_price = prop.saleHistory.lastSalePrice
      snapshot.last_sale_date = prop.saleHistory.lastSaleDate
    }

    // Tax assessed
    if (prop.tax?.taxAmount || prop.tax?.assessedValue) {
      snapshot.tax_assessed = prop.tax.assessedValue
    }

    // Absentee owner detection
    if (prop.ownership?.absenteeOwner === 'Y' || prop.ownership?.ownerOccupied === 'N') {
      snapshot.absentee_owner = true
      if (!reasons.includes('absentee_owner')) {
        snapshot.distress_score = (snapshot.distress_score || 0) + 20
        snapshot.distress_reasons = [...(snapshot.distress_reasons || []), 'absentee_owner']
      }
    }

    // Equity calculation
    if (prop.valuation?.avm && prop.mortgage?.amount) {
      const equity = prop.valuation.avm - prop.mortgage.amount
      snapshot.equity_estimate = equity
      snapshot.equity_percent = Math.round((equity / prop.valuation.avm) * 100)

      if (snapshot.equity_percent > 50) {
        snapshot.distress_score = Math.min((snapshot.distress_score || 0) + 15, 100)
        snapshot.distress_reasons = [...(snapshot.distress_reasons || []), 'high_equity']
      }
    }

    // Foreclosure status
    if (prop.foreclosure?.status) {
      snapshot.foreclosure_status = prop.foreclosure.status
      snapshot.distress_score = Math.min((snapshot.distress_score || 0) + 30, 100)
      snapshot.distress_reasons = [...(snapshot.distress_reasons || []), 'in_foreclosure']
    }

    // MAO calculations (70% rule)
    if (snapshot.arv_high) {
      const repairEstimate = 30000 // Default repair estimate
      snapshot.mao_flip = Math.round(snapshot.arv_high * 0.7 - repairEstimate)
      snapshot.mao_brrrr = Math.round(snapshot.arv_high * 0.75 - repairEstimate)
      snapshot.mao_wholesale = Math.round(snapshot.mao_flip * 0.85)
    }

    // Buy box fit
    if (snapshot.distress_score && snapshot.distress_score >= 60) {
      snapshot.buy_box_fit = 'flip'
    } else if (snapshot.distress_score && snapshot.distress_score >= 40) {
      snapshot.buy_box_fit = 'brrrr'
    }
  }

  return snapshot
}

function generateAISummary(snapshot: AnalysisSnapshot['snapshot']): string {
  const parts: string[] = []

  if (snapshot.distress_score && snapshot.distress_score >= 70) {
    parts.push('High distress signals detected.')
  } else if (snapshot.distress_score && snapshot.distress_score >= 40) {
    parts.push('Moderate distress indicators.')
  } else {
    parts.push('Limited distress signals.')
  }

  if (snapshot.absentee_owner) {
    parts.push('Owner is absentee.')
  }

  if (snapshot.equity_percent && snapshot.equity_percent > 50) {
    parts.push(`High equity (${snapshot.equity_percent}%).`)
  }

  if (snapshot.foreclosure_status) {
    parts.push(`Foreclosure status: ${snapshot.foreclosure_status}.`)
  }

  if (snapshot.mao_flip) {
    parts.push(`Suggested MAO for flip: $${snapshot.mao_flip.toLocaleString()}.`)
  }

  return parts.join(' ')
}

function generateNextActions(snapshot: AnalysisSnapshot['snapshot']): string[] {
  const actions: string[] = []

  if (snapshot.distress_score && snapshot.distress_score >= 50) {
    actions.push('skip_trace')
    actions.push('verify_occupancy')
  }

  if (!snapshot.arv_high) {
    actions.push('run_comps')
  }

  if (snapshot.foreclosure_status) {
    actions.push('check_auction_date')
  }

  actions.push('drive_by_photos')
  actions.push('verify_condition')

  return actions
}

// ============================================================================
// Convert Lead to Deal
// ============================================================================

export async function convertLeadToDeal(leadId: string): Promise<Deal | null> {
  try {
    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('dealroom_leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) throw new Error('Lead not found')

    // Create deal using existing function
    const { data: deal, error: dealError } = await createDeal({
      name: lead.address || 'New Deal from Lead',
      stage: 'prospecting',
      source: 'driving',
      address_line1: lead.address,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      lat: lead.lat,
      lng: lead.lng,
      notes: lead.notes,
      tags: lead.tags,
      lead_id: leadId,
    })

    if (dealError) throw dealError

    // Update lead triage status
    await supabase
      .from('dealroom_leads')
      .update({ triage_status: 'deal_created' })
      .eq('id', leadId)

    // Update analyze queue status
    await supabase
      .from('dealroom_analyze_queue')
      .update({ status: 'converted', converted_at: new Date().toISOString() })
      .eq('lead_id', leadId)

    return deal
  } catch (err) {
    console.error('Error converting lead to deal:', err)
    throw err
  }
}

// ============================================================================
// Hot Leads (for dashboard)
// ============================================================================

export async function getHotLeads(limit = 10): Promise<TriageLead[]> {
  try {
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)

    const { data, error } = await supabase
      .from('dealroom_leads')
      .select(`
        *,
        media:dealroom_lead_media(storage_path)
      `)
      .neq('status', 'converted')
      .neq('triage_status', 'dismissed')
      .or(`priority.eq.hot,rank_score.gte.70,created_at.gte.${last24h.toISOString()}`)
      .order('rank_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Map address_line1 to address and add photo URLs
    return (data || []).map((lead: any) => {
      // Get photo URL: prefer captured photo, fallback to Street View
      let photoUrl: string | undefined
      if (lead.media?.[0]?.storage_path) {
        photoUrl = getStorageUrl(lead.media[0].storage_path)
      } else if (lead.lat && lead.lng) {
        photoUrl = getStreetViewUrl(lead.lat, lead.lng) || undefined
      }

      return {
        ...lead,
        address: lead.address_line1 || lead.address,
        photo_url: photoUrl,
      }
    }) as TriageLead[]
  } catch (err) {
    console.error('Error fetching hot leads:', err)
    return []
  }
}

// ============================================================================
// AI Jobs
// ============================================================================

export type AIJobType =
  | 'score_candidate'
  | 'underwrite_snapshot'
  | 'comp_select'
  | 'repair_estimate'
  | 'outreach_draft'
  | 'portal_summary'

export type AIJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AIJob {
  id: string
  tenant_id: string
  job_type: AIJobType
  subject_type: string
  subject_id: string
  status: AIJobStatus
  priority: number
  input: Record<string, unknown>
  result?: Record<string, unknown>
  error_message?: string
  model?: string
  total_tokens?: number
  cost_estimate?: number
  created_at: string
  completed_at?: string
}

export async function enqueueAIJob(
  jobType: AIJobType,
  subjectType: string,
  subjectId: string,
  input: Record<string, unknown> = {},
  priority: number = 5
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('enqueue_ai_job', {
      p_job_type: jobType,
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_input: input,
      p_priority: priority,
    })

    if (error) throw error
    return data as string
  } catch (err) {
    console.error('Error enqueuing AI job:', err)
    return null
  }
}

export async function getAIJobStatus(jobId: string): Promise<AIJob | null> {
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

export async function pollAIJobCompletion(
  jobId: string,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<AIJob | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getAIJobStatus(jobId)

    if (!job) return null

    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  // Timeout - return last status
  return getAIJobStatus(jobId)
}

// Trigger AI job processing (call the Edge Function)
export async function triggerAIJobProcessing(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

    await fetch(`${supabaseUrl}/functions/v1/ai-process-jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ maxJobs: 5 }),
    })
  } catch (err) {
    console.error('Error triggering AI job processing:', err)
  }
}

// ============================================================================
// Buy Box
// ============================================================================

export interface BuyBox {
  id: string
  tenant_id: string
  user_id: string
  name: string
  is_default: boolean
  is_active: boolean

  // Location
  target_zips: string[]
  target_cities: string[]
  target_states: string[]
  exclude_zips: string[]

  // Property
  property_types: string[]
  min_beds?: number
  max_beds?: number
  min_baths?: number
  max_baths?: number
  min_sqft?: number
  max_sqft?: number
  min_year_built?: number
  max_year_built?: number

  // Financial
  max_purchase_price?: number
  min_arv?: number
  max_arv?: number
  min_equity_percent?: number
  max_repair_budget?: number
  min_profit?: number
  min_roi_percent?: number

  // Strategy
  strategies: string[]
  preferred_strategy: string

  // Tags
  preferred_tags: string[]
  avoid_tags: string[]

  // Weights
  risk_tolerance: string
  weight_location: number
  weight_property_fit: number
  weight_financial: number
  weight_distress: number

  created_at: string
  updated_at: string
}

export async function getActiveBuyBox(): Promise<BuyBox | null> {
  try {
    const { data, error } = await supabase.rpc('get_active_buy_box')

    if (error) throw error
    return data as BuyBox
  } catch (err) {
    console.error('Error getting buy box:', err)
    return null
  }
}

export async function getBuyBoxes(): Promise<BuyBox[]> {
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

export async function createBuyBox(buyBox: Partial<BuyBox>): Promise<BuyBox | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (!tenantUser?.tenant_id) throw new Error('No tenant')

    const { data, error } = await supabase
      .from('dealroom_buy_box')
      .insert({
        tenant_id: tenantUser.tenant_id,
        user_id: user.id,
        name: buyBox.name || 'Default',
        is_default: buyBox.is_default ?? true,
        is_active: true,
        target_zips: buyBox.target_zips || [],
        target_cities: buyBox.target_cities || [],
        target_states: buyBox.target_states || [],
        exclude_zips: buyBox.exclude_zips || [],
        property_types: buyBox.property_types || ['sfr'],
        min_beds: buyBox.min_beds,
        max_beds: buyBox.max_beds,
        min_baths: buyBox.min_baths,
        max_baths: buyBox.max_baths,
        min_sqft: buyBox.min_sqft,
        max_sqft: buyBox.max_sqft,
        min_year_built: buyBox.min_year_built,
        max_year_built: buyBox.max_year_built,
        max_purchase_price: buyBox.max_purchase_price,
        min_arv: buyBox.min_arv,
        max_arv: buyBox.max_arv,
        min_equity_percent: buyBox.min_equity_percent,
        max_repair_budget: buyBox.max_repair_budget,
        min_profit: buyBox.min_profit,
        min_roi_percent: buyBox.min_roi_percent,
        strategies: buyBox.strategies || ['flip'],
        preferred_strategy: buyBox.preferred_strategy || 'flip',
        preferred_tags: buyBox.preferred_tags || ['vacant', 'absentee_owner'],
        avoid_tags: buyBox.avoid_tags || [],
        risk_tolerance: buyBox.risk_tolerance || 'moderate',
        weight_location: buyBox.weight_location ?? 30,
        weight_property_fit: buyBox.weight_property_fit ?? 25,
        weight_financial: buyBox.weight_financial ?? 30,
        weight_distress: buyBox.weight_distress ?? 15,
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

export async function updateBuyBox(id: string, updates: Partial<BuyBox>): Promise<BuyBox | null> {
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

// ============================================================================
// Enhanced Analysis with AI
// ============================================================================

export async function runAIAnalysis(leadId: string): Promise<{
  jobId: string | null
  immediate?: AnalysisSnapshot
}> {
  // First, do the quick rule-based analysis
  const immediateResult = await runQuickAnalysis(leadId)

  // Then enqueue AI job for deeper analysis
  const jobId = await enqueueAIJob(
    'underwrite_snapshot',
    'lead',
    leadId,
    { quick_snapshot: immediateResult?.snapshot },
    3 // Higher priority
  )

  // Trigger processing
  if (jobId) {
    triggerAIJobProcessing()
  }

  return { jobId, immediate: immediateResult || undefined }
}

export async function scoreLeadWithAI(leadId: string): Promise<string | null> {
  // Enqueue scoring job
  const jobId = await enqueueAIJob(
    'score_candidate',
    'lead',
    leadId,
    {},
    5
  )

  if (jobId) {
    triggerAIJobProcessing()
  }

  return jobId
}

// ============================================================================
// Activity Timeline
// ============================================================================

export interface ActivityEvent {
  id: string
  type: 'deal_event' | 'reach_event' | 'interaction' | 'stage_change'
  event_type?: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
  created_at: string
  created_by_name?: string
}

/**
 * Get unified activity timeline for a lead
 * Combines: reach_events, interactions, and activity_events
 */
export async function getLeadActivityTimeline(leadId: string): Promise<ActivityEvent[]> {
  try {
    // Fetch reach events (status transitions)
    const { data: reachEvents, error: reachError } = await supabase
      .from('dealroom_lead_reach_events')
      .select('id, from_status, to_status, source, metadata, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (reachError) {
      console.warn('Error fetching reach events:', reachError)
    }

    // Fetch interactions (calls, texts, emails)
    const { data: interactions, error: interactionError } = await supabase
      .from('dealroom_lead_interactions')
      .select('id, interaction_type, direction, contact_phone, contact_email, outcome, notes, started_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (interactionError) {
      console.warn('Error fetching interactions:', interactionError)
    }

    // Combine and normalize events
    const events: ActivityEvent[] = []

    // Add reach events
    for (const event of reachEvents || []) {
      events.push({
        id: event.id,
        type: 'reach_event',
        event_type: 'status_change',
        title: `Status: ${formatStatus(event.from_status)} → ${formatStatus(event.to_status)}`,
        description: `Via ${event.source}`,
        metadata: event.metadata,
        created_at: event.created_at,
      })
    }

    // Add interactions
    for (const interaction of interactions || []) {
      const typeLabel = interaction.interaction_type.charAt(0).toUpperCase() + interaction.interaction_type.slice(1)
      const dirLabel = interaction.direction === 'outbound' ? 'Outgoing' : 'Incoming'
      const contact = interaction.contact_phone || interaction.contact_email || ''

      events.push({
        id: interaction.id,
        type: 'interaction',
        event_type: interaction.interaction_type,
        title: `${dirLabel} ${typeLabel}`,
        description: interaction.outcome
          ? `${formatOutcome(interaction.outcome)}${interaction.notes ? ` - ${interaction.notes}` : ''}`
          : contact,
        metadata: {
          outcome: interaction.outcome,
          notes: interaction.notes,
          contact: contact,
        },
        created_at: interaction.created_at,
      })
    }

    // Sort by date descending
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return events
  } catch (err) {
    console.error('Error fetching lead activity timeline:', err)
    return []
  }
}

/**
 * Get unified activity timeline for a deal
 * Combines: activity_events, stage_history, and notes
 */
export async function getDealActivityTimeline(dealId: string): Promise<ActivityEvent[]> {
  try {
    // Fetch activity events
    const { data: activityEvents, error: activityError } = await supabase
      .from('dealroom_activity_events')
      .select('id, event_type, title, description, metadata, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (activityError) {
      console.warn('Error fetching activity events:', activityError)
    }

    // Fetch stage history
    const { data: stageHistory, error: stageError } = await supabase
      .from('dealroom_stage_history')
      .select('id, from_stage, to_stage, notes, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (stageError) {
      console.warn('Error fetching stage history:', stageError)
    }

    // Combine and normalize events
    const events: ActivityEvent[] = []

    // Add activity events
    for (const event of activityEvents || []) {
      events.push({
        id: event.id,
        type: 'deal_event',
        event_type: event.event_type,
        title: event.title,
        description: event.description,
        metadata: event.metadata,
        created_at: event.created_at,
      })
    }

    // Add stage history
    for (const stage of stageHistory || []) {
      events.push({
        id: stage.id,
        type: 'stage_change',
        event_type: 'stage_transition',
        title: `Stage: ${formatStage(stage.from_stage)} → ${formatStage(stage.to_stage)}`,
        description: stage.notes,
        created_at: stage.created_at,
      })
    }

    // Sort by date descending
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return events
  } catch (err) {
    console.error('Error fetching deal activity timeline:', err)
    return []
  }
}

// Helper: Format reach status for display
function formatStatus(status?: string): string {
  if (!status) return 'Unknown'
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper: Format interaction outcome for display
function formatOutcome(outcome?: string): string {
  if (!outcome) return ''
  const labels: Record<string, string> = {
    no_answer: 'No Answer',
    voicemail: 'Left Voicemail',
    answered: 'Answered',
    wrong_number: 'Wrong Number',
    interested: 'Interested',
    not_interested: 'Not Interested',
    callback_scheduled: 'Callback Scheduled',
    deal_created: 'Deal Created',
  }
  return labels[outcome] || outcome
}

// Helper: Format deal stage for display
function formatStage(stage?: string): string {
  if (!stage) return 'Unknown'
  const labels: Record<string, string> = {
    prospecting: 'Prospecting',
    analyzing: 'Analyzing',
    offer_pending: 'Offer Pending',
    under_contract: 'Under Contract',
    due_diligence: 'Due Diligence',
    rehab: 'Rehab',
    listed: 'Listed',
    sold: 'Sold',
    closed: 'Closed',
    dead: 'Dead',
  }
  return labels[stage] || stage
}

// ============================================================================
// Saved Searches
// ============================================================================

export interface SavedSearch {
  id: string
  tenant_id: string
  created_by: string
  name: string
  description?: string
  is_active: boolean
  filters: {
    query?: string
    stage?: string
    distress_signals?: string[]
    property_types?: string[]
    zip_codes?: string[]
    min_price?: number
    max_price?: number
  }
  auto_run_enabled: boolean
  auto_run_schedule?: string
  last_auto_run_at?: string
  run_count: number
  last_run_at?: string
  last_result_count?: number
  created_at: string
  updated_at: string
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  try {
    const { data, error } = await supabase
      .from('dealroom_saved_searches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching saved searches:', err)
    return []
  }
}

export async function getSavedSearch(id: string): Promise<SavedSearch | null> {
  try {
    const { data, error } = await supabase
      .from('dealroom_saved_searches')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching saved search:', err)
    return null
  }
}

export async function createSavedSearch(search: {
  name: string
  description?: string
  filters: SavedSearch['filters']
  auto_run_enabled?: boolean
  auto_run_schedule?: string
}): Promise<SavedSearch | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('dealroom_saved_searches')
      .insert({
        name: search.name,
        description: search.description,
        filters: search.filters,
        auto_run_enabled: search.auto_run_enabled || false,
        auto_run_schedule: search.auto_run_schedule,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error creating saved search:', err)
    return null
  }
}

export async function updateSavedSearch(
  id: string,
  updates: Partial<Pick<SavedSearch, 'name' | 'description' | 'filters' | 'is_active' | 'auto_run_enabled' | 'auto_run_schedule'>>
): Promise<SavedSearch | null> {
  try {
    const { data, error } = await supabase
      .from('dealroom_saved_searches')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error updating saved search:', err)
    return null
  }
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  try {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('dealroom_saved_searches')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting saved search:', err)
    return false
  }
}

export async function runSavedSearch(id: string): Promise<{
  results: DealWithProperty[]
  count: number
} | null> {
  try {
    // Get the saved search
    const search = await getSavedSearch(id)
    if (!search) return null

    // Build query based on filters
    let query = supabase
      .from('dealroom_deals')
      .select(`*, property:dealroom_properties!deal_id(*)`)
      .order('created_at', { ascending: false })

    const filters = search.filters

    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,property.address.ilike.%${filters.query}%`)
    }

    if (filters.stage) {
      query = query.eq('stage', filters.stage)
    }

    if (filters.min_price) {
      query = query.gte('purchase_price', filters.min_price)
    }

    if (filters.max_price) {
      query = query.lte('purchase_price', filters.max_price)
    }

    const { data, error } = await query.limit(100)

    if (error) throw error

    // Update run stats
    await supabase
      .from('dealroom_saved_searches')
      .update({
        run_count: (search.run_count || 0) + 1,
        last_run_at: new Date().toISOString(),
        last_result_count: data?.length || 0,
      })
      .eq('id', id)

    return {
      results: data || [],
      count: data?.length || 0,
    }
  } catch (err) {
    console.error('Error running saved search:', err)
    return null
  }
}

// ============================================================================
// Export
// ============================================================================

export const dataService = {
  // Deals
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  updateDealStage,
  getRecentDeals,

  // Properties
  getProperty,
  createProperty,
  updateProperty,
  searchProperty,
  createDealFromProperty,

  // Leads
  getLeads,
  getLead,
  updateLead,

  // Triage
  getTriageLeads,
  handleSwipeAction,
  getHotLeads,
  markLeadAsHot,

  // Analyze Queue
  getAnalyzeQueue,
  runQuickAnalysis,
  convertLeadToDeal,

  // AI Jobs
  enqueueAIJob,
  getAIJobStatus,
  pollAIJobCompletion,
  triggerAIJobProcessing,
  runAIAnalysis,
  scoreLeadWithAI,

  // Buy Box
  getActiveBuyBox,
  getBuyBoxes,
  createBuyBox,
  updateBuyBox,

  // Underwriting
  getUnderwriting,
  getLatestUnderwriting,

  // Dashboard
  getDashboardStats,

  // Followups
  getUpcomingFollowups,
  getOverdueFollowups,
  getTodayFollowups,
  getAllFollowups,
  createFollowup,
  updateFollowup,
  completeFollowup,
  snoozeFollowup,

  // Activity Timeline
  getLeadActivityTimeline,
  getDealActivityTimeline,

  // Saved Searches
  getSavedSearches,
  getSavedSearch,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
}
