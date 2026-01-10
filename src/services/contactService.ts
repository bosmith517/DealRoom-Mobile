/**
 * Contact Service (Mobile)
 *
 * Simplified contact operations for the mobile app.
 * Handles contact retrieval, phone/email lists, and basic actions.
 */

import { supabase } from '../lib/supabase'

export interface Contact {
  id: string
  tenant_id: string
  contact_type: 'seller' | 'buyer' | 'agent_listing' | 'agent_buyer' | 'wholesaler' | 'lender' | 'hard_money_lender' | 'private_lender' | 'title_company' | 'attorney' | 'contractor' | 'property_manager' | 'jv_partner' | 'bird_dog' | 'tenant' | 'other'
  display_name?: string
  full_name?: string
  first_name?: string
  last_name?: string
  suffix?: string
  primary_phone?: string
  primary_email?: string
  status: 'active' | 'inactive' | 'do_not_contact' | 'archived'
  engagement_level?: 'hot' | 'warm' | 'cold' | 'unknown'
  is_dnc?: boolean
  dnc_reason?: string
  notes?: string
  tags?: string[]
  last_contacted_at?: string
  created_at: string
  updated_at: string
  // Relations
  phones?: ContactPhone[]
  emails?: ContactEmail[]
  addresses?: ContactAddress[]
  deals?: ContactDeal[]
}

export interface ContactPhone {
  id: string
  contact_id: string
  phone_number: string
  phone_type: 'mobile' | 'home' | 'work' | 'fax' | 'other'
  is_primary: boolean
  is_verified: boolean
  can_sms: boolean
  source?: string
  notes?: string
}

export interface ContactEmail {
  id: string
  contact_id: string
  email: string
  email_type: 'personal' | 'work' | 'other'
  is_primary: boolean
  is_verified: boolean
  source?: string
}

export interface ContactAddress {
  id: string
  contact_id: string
  address_type: 'mailing' | 'property' | 'work' | 'other'
  address_line1: string
  address_line2?: string
  city?: string
  state?: string
  zip?: string
  is_primary: boolean
}

export interface ContactDeal {
  id: string
  contact_id: string
  deal_id: string
  role: 'seller' | 'buyer' | 'agent' | 'contractor' | 'lender' | 'attorney' | 'wholesaler' | 'other'
  is_primary: boolean
  notes?: string
  deal?: {
    id: string
    name?: string
    stage?: string
    property?: {
      address_line1?: string
      city?: string
      state?: string
    }
  }
}

export interface ContactTimelineEvent {
  id: string
  event_type: string
  summary: string
  event_data?: Record<string, unknown>
  created_at: string
}

class ContactService {
  /**
   * Get a contact by ID with all related data
   */
  async getContact(contactId: string): Promise<{ data: Contact | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_contacts')
        .select(`
          *,
          phones:dealroom_contact_phones(*),
          emails:dealroom_contact_emails(*),
          addresses:dealroom_contact_addresses(*)
        `)
        .eq('id', contactId)
        .is('deleted_at', null)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: null }
        }
        console.error('[ContactService] Error fetching contact:', error)
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get contacts list with search
   */
  async getContacts(options?: {
    limit?: number
    offset?: number
    search?: string
    contactType?: string
    status?: string
  }): Promise<{ data: Contact[] | null; count: number; error: Error | null }> {
    try {
      const limit = options?.limit || 25
      const offset = options?.offset || 0

      let query = supabase
        .from('dealroom_contacts')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)

      if (options?.search) {
        query = query.or(`display_name.ilike.%${options.search}%,full_name.ilike.%${options.search}%,primary_phone.ilike.%${options.search}%,primary_email.ilike.%${options.search}%`)
      }

      if (options?.contactType) {
        query = query.eq('contact_type', options.contactType)
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      query = query
        .order('display_name')
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('[ContactService] Error fetching contacts:', error)
        return { data: null, count: 0, error }
      }

      return { data: data || [], count: count || 0, error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, count: 0, error: err as Error }
    }
  }

  /**
   * Get phones for a contact
   */
  async getContactPhones(contactId: string): Promise<{ data: ContactPhone[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_contact_phones')
        .select('*')
        .eq('contact_id', contactId)
        .order('is_primary', { ascending: false })
        .order('created_at')

      if (error) {
        console.error('[ContactService] Error fetching phones:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get emails for a contact
   */
  async getContactEmails(contactId: string): Promise<{ data: ContactEmail[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_contact_emails')
        .select('*')
        .eq('contact_id', contactId)
        .order('is_primary', { ascending: false })
        .order('created_at')

      if (error) {
        console.error('[ContactService] Error fetching emails:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get deals linked to a contact
   */
  async getContactDeals(contactId: string): Promise<{ data: ContactDeal[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_contact_deals')
        .select(`
          *,
          deal:dealroom_deals(
            id, name, stage,
            property:dealroom_properties(address_line1, city, state)
          )
        `)
        .eq('contact_id', contactId)
        .order('linked_at', { ascending: false })

      if (error) {
        console.error('[ContactService] Error fetching deals:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get activity timeline for a contact
   */
  async getContactTimeline(
    contactId: string,
    options?: { limit?: number }
  ): Promise<{ data: ContactTimelineEvent[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_activities')
        .select('id, event_type, summary, event_data, created_at')
        .eq('entity_type', 'contact')
        .eq('entity_id', contactId)
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50)

      if (error) {
        console.error('[ContactService] Error fetching timeline:', error)
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Update contact notes
   */
  async updateNotes(contactId: string, notes: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('dealroom_contacts')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', contactId)

      if (error) {
        console.error('[ContactService] Error updating notes:', error)
        return { error }
      }

      return { error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { error: err as Error }
    }
  }

  /**
   * Log a call against a contact
   */
  async logCall(
    contactId: string,
    phone: string,
    outcome: string,
    notes?: string
  ): Promise<{ error: Error | null }> {
    try {
      const { data: userData } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('dealroom_activities')
        .insert({
          entity_type: 'contact',
          entity_id: contactId,
          event_type: 'call_logged',
          summary: `Called ${phone} - ${outcome}`,
          event_data: { phone, outcome, notes },
          created_by_user_id: userData.user?.id,
        })

      if (error) {
        console.error('[ContactService] Error logging call:', error)
        return { error }
      }

      // Update last_contacted_at
      await supabase
        .from('dealroom_contacts')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', contactId)

      return { error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { error: err as Error }
    }
  }

  /**
   * Mark contact as Do Not Contact
   */
  async markDoNotContact(contactId: string, reason: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('dealroom_contacts')
        .update({
          status: 'do_not_contact',
          is_dnc: true,
          dnc_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)

      if (error) {
        console.error('[ContactService] Error marking DNC:', error)
        return { error }
      }

      return { error: null }
    } catch (err) {
      console.error('[ContactService] Error:', err)
      return { error: err as Error }
    }
  }
}

export const contactService = new ContactService()
export default contactService
