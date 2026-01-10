/**
 * Cost Service
 *
 * Service for managing deal costs in the mobile app.
 * Supports cost categories, line items, and totals.
 */

import { supabase } from '../lib/supabase'

// Cost types
export type CostStatus = 'estimated' | 'quoted' | 'contracted' | 'paid' | 'waived'

export interface CostCategory {
  id: string
  tenant_id?: string
  category_key: string
  category_label: string
  description?: string
  icon?: string
  color?: string
  sort_order: number
  is_system: boolean
  is_active: boolean
}

export interface CostItem {
  id: string
  tenant_id?: string
  category_id: string
  item_key: string
  item_label: string
  description?: string
  default_amount?: number
  default_is_percentage: boolean
  percentage_of?: string
  is_recurring: boolean
  typical_range_low?: number
  typical_range_high?: number
  icon?: string
  help_text?: string
  input_type: 'currency' | 'percentage' | 'months'
  is_system: boolean
  is_active: boolean
  sort_order: number
}

export interface DealCost {
  id: string
  tenant_id: string
  deal_id: string
  cost_item_id?: string
  category_id: string
  custom_label?: string
  custom_description?: string
  estimated_amount: number
  actual_amount?: number
  is_percentage: boolean
  percentage_value?: number
  percentage_of?: string
  is_recurring: boolean
  recurring_months?: number
  status: CostStatus
  paid_date?: string
  paid_to?: string
  notes?: string
  receipt_url?: string
  is_required: boolean
  is_negotiable: boolean
  flagged_risk: boolean
  created_at: string
  updated_at: string
  // Joined data
  category?: CostCategory
  cost_item?: CostItem
}

export interface CreateCostInput {
  deal_id: string
  category_id: string
  cost_item_id?: string
  custom_label?: string
  custom_description?: string
  estimated_amount: number
  actual_amount?: number
  is_percentage?: boolean
  percentage_value?: number
  percentage_of?: string
  is_recurring?: boolean
  recurring_months?: number
  status?: CostStatus
  notes?: string
  is_required?: boolean
  flagged_risk?: boolean
}

export interface CostSummary {
  total_estimated: number
  total_actual: number
  total_paid: number
  total_remaining: number
  categories: {
    category_id: string
    category_label: string
    color?: string
    estimated: number
    actual: number
    count: number
  }[]
}

// Cost service
export const costService = {
  /**
   * Get all cost categories
   */
  async getCategories(): Promise<{
    data: CostCategory[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_cost_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return { data: data as CostCategory[], error: null }
    } catch (err) {
      console.error('[costService] Error fetching categories:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get cost items for a category
   */
  async getCategoryItems(categoryId: string): Promise<{
    data: CostItem[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_cost_items')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return { data: data as CostItem[], error: null }
    } catch (err) {
      console.error('[costService] Error fetching category items:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get all costs for a deal
   */
  async getDealCosts(dealId: string): Promise<{
    data: DealCost[] | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_deal_costs')
        .select(`
          *,
          category:dealroom_cost_categories(*),
          cost_item:dealroom_cost_items(*)
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return { data: data as DealCost[], error: null }
    } catch (err) {
      console.error('[costService] Error fetching deal costs:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Get cost summary for a deal
   */
  async getDealCostSummary(dealId: string): Promise<{
    data: CostSummary | null
    error: Error | null
  }> {
    try {
      const { data: costs, error } = await supabase
        .from('dealroom_deal_costs')
        .select(`
          *,
          category:dealroom_cost_categories(id, category_label, color)
        `)
        .eq('deal_id', dealId)

      if (error) throw error

      if (!costs || costs.length === 0) {
        return {
          data: {
            total_estimated: 0,
            total_actual: 0,
            total_paid: 0,
            total_remaining: 0,
            categories: [],
          },
          error: null,
        }
      }

      // Calculate totals
      let total_estimated = 0
      let total_actual = 0
      let total_paid = 0
      const categoryMap = new Map<string, { estimated: number; actual: number; count: number; label: string; color?: string }>()

      costs.forEach((cost: any) => {
        const estimated = cost.estimated_amount || 0
        const actual = cost.actual_amount || 0
        total_estimated += estimated
        total_actual += actual
        if (cost.status === 'paid') {
          total_paid += actual || estimated
        }

        const catId = cost.category_id
        const existing = categoryMap.get(catId) || {
          estimated: 0,
          actual: 0,
          count: 0,
          label: cost.category?.category_label || 'Unknown',
          color: cost.category?.color,
        }
        existing.estimated += estimated
        existing.actual += actual
        existing.count += 1
        categoryMap.set(catId, existing)
      })

      const categories = Array.from(categoryMap.entries()).map(([category_id, data]) => ({
        category_id,
        category_label: data.label,
        color: data.color,
        estimated: data.estimated,
        actual: data.actual,
        count: data.count,
      }))

      return {
        data: {
          total_estimated,
          total_actual,
          total_paid,
          total_remaining: (total_actual || total_estimated) - total_paid,
          categories,
        },
        error: null,
      }
    } catch (err) {
      console.error('[costService] Error fetching cost summary:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Create a new cost entry
   */
  async createCost(input: CreateCostInput): Promise<{
    data: DealCost | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_deal_costs')
        .insert({
          deal_id: input.deal_id,
          category_id: input.category_id,
          cost_item_id: input.cost_item_id,
          custom_label: input.custom_label,
          custom_description: input.custom_description,
          estimated_amount: input.estimated_amount,
          actual_amount: input.actual_amount,
          is_percentage: input.is_percentage || false,
          percentage_value: input.percentage_value,
          percentage_of: input.percentage_of,
          is_recurring: input.is_recurring || false,
          recurring_months: input.recurring_months,
          status: input.status || 'estimated',
          notes: input.notes,
          is_required: input.is_required || false,
          flagged_risk: input.flagged_risk || false,
        })
        .select()
        .single()

      if (error) throw error

      return { data: data as DealCost, error: null }
    } catch (err) {
      console.error('[costService] Error creating cost:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Update a cost entry
   */
  async updateCost(
    costId: string,
    updates: Partial<CreateCostInput> & { status?: CostStatus; paid_date?: string; paid_to?: string }
  ): Promise<{
    data: DealCost | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_deal_costs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', costId)
        .select()
        .single()

      if (error) throw error

      return { data: data as DealCost, error: null }
    } catch (err) {
      console.error('[costService] Error updating cost:', err)
      return { data: null, error: err as Error }
    }
  },

  /**
   * Delete a cost entry
   */
  async deleteCost(costId: string): Promise<{
    success: boolean
    error: Error | null
  }> {
    try {
      const { error } = await supabase
        .from('dealroom_deal_costs')
        .delete()
        .eq('id', costId)

      if (error) throw error

      return { success: true, error: null }
    } catch (err) {
      console.error('[costService] Error deleting cost:', err)
      return { success: false, error: err as Error }
    }
  },

  /**
   * Mark cost as paid
   */
  async markAsPaid(
    costId: string,
    paidTo: string,
    actualAmount?: number
  ): Promise<{
    data: DealCost | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('dealroom_deal_costs')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          paid_to: paidTo,
          actual_amount: actualAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', costId)
        .select()
        .single()

      if (error) throw error

      return { data: data as DealCost, error: null }
    } catch (err) {
      console.error('[costService] Error marking cost as paid:', err)
      return { data: null, error: err as Error }
    }
  },
}

// Helper functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getStatusColor(status: CostStatus): string {
  const colors: Record<CostStatus, string> = {
    estimated: '#6B7280',
    quoted: '#3B82F6',
    contracted: '#8B5CF6',
    paid: '#10B981',
    waived: '#F59E0B',
  }
  return colors[status] || '#6B7280'
}

export function getStatusLabel(status: CostStatus): string {
  const labels: Record<CostStatus, string> = {
    estimated: 'Estimated',
    quoted: 'Quoted',
    contracted: 'Contracted',
    paid: 'Paid',
    waived: 'Waived',
  }
  return labels[status] || status
}
