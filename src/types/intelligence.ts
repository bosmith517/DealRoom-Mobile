/**
 * FlipMantis Intelligence Platform Types (Mobile)
 *
 * Types for deal outcomes, patterns, passed deals, seller motivation, and market intelligence
 * Ported from web app for n8n workflow integration
 */

// ============================================================================
// DEAL OUTCOMES - Track predictions vs actuals
// ============================================================================

export type OutcomeType = 'sold' | 'rented' | 'wholesaled' | 'held' | 'lost' | 'pending'

export interface DealOutcome {
  id: string
  deal_id: string
  tenant_id: string

  // Predictions (at time of deal entry)
  predicted_arv?: number
  predicted_rehab_cost?: number
  predicted_hold_days?: number
  predicted_profit?: number

  // Actuals (filled in after completion)
  actual_arv?: number
  actual_rehab_cost?: number
  actual_hold_days?: number
  actual_profit?: number
  actual_sale_price?: number

  // Outcome details
  outcome_type?: OutcomeType
  outcome_date?: string
  outcome_notes?: string

  // Computed accuracy metrics
  arv_accuracy_pct?: number
  rehab_accuracy_pct?: number
  profit_accuracy_pct?: number

  created_at: string
  updated_at: string
}

// ============================================================================
// INVESTOR PATTERNS - Learned from deal outcomes
// ============================================================================

export type PatternType =
  | 'arv_bias'           // Tendency to over/under estimate ARV
  | 'rehab_bias'         // Tendency to over/under estimate rehab
  | 'hold_time_bias'     // Tendency to over/under estimate timelines
  | 'property_type_success' // Which property types work best

export interface InvestorPattern {
  id: string
  investor_profile_id?: string
  tenant_id: string
  pattern_type: PatternType
  pattern_data: Record<string, unknown>
  confidence?: number // 0-100
  suggestion?: string
  sample_size?: number
  last_calculated?: string
  created_at: string
  updated_at: string
}

export interface PatternInsight {
  pattern_type: PatternType
  title: string
  description: string
  suggestion: string
  confidence: number
  sample_size: number
  trend_direction?: 'improving' | 'stable' | 'declining'
}

// ============================================================================
// PASSED DEALS - Track deals you skipped
// ============================================================================

export type PassReason =
  | 'too_expensive'
  | 'bad_location'
  | 'too_much_work'
  | 'title_issues'
  | 'financing_fell_through'
  | 'competition'
  | 'seller_unreasonable'
  | 'inspection_issues'
  | 'market_concerns'
  | 'other'

export type PassedDealStatus =
  | 'unknown'
  | 'still_listed'
  | 'price_reduced'
  | 'pending'
  | 'sold'
  | 'withdrawn'
  | 'expired'

export interface PassedDeal {
  id: string
  tenant_id: string
  user_id?: string

  deal_id?: string
  attom_id?: string
  address: string
  city?: string
  state?: string
  zip_code?: string

  passed_at: string
  pass_reason?: PassReason
  pass_notes?: string
  asking_price_at_pass?: number
  our_max_offer?: number

  is_watching: boolean
  watch_until?: string

  current_status: PassedDealStatus
  current_price?: number
  last_price_change?: string
  sold_price?: number
  sold_date?: string
  days_on_market?: number

  outcome_analysis?: Record<string, unknown>
  was_good_pass?: boolean
  missed_profit_estimate?: number

  created_at: string
  updated_at: string
}

// ============================================================================
// SELLER MOTIVATION SCORES
// ============================================================================

export type MotivationLevel = 'low' | 'medium' | 'high' | 'very_high'

export interface MotivationSignal {
  type: string
  description: string
  weight: number // 1-10
  source?: string
}

export interface SellerMotivationScore {
  id: string
  tenant_id: string
  property_id?: string
  deal_id?: string
  lead_id?: string
  attom_id?: string
  address?: string

  motivation_score?: number // 1-100
  motivation_level?: MotivationLevel

  // Component scores (1-100 each)
  ownership_duration_score?: number
  equity_position_score?: number
  life_events_score?: number
  property_condition_score?: number
  market_behavior_score?: number
  owner_situation_score?: number

  signals?: MotivationSignal[]
  outreach_angle?: string
  risk_factors?: string[]

  last_enriched?: string
  enrichment_sources?: string[]
  enrichment_data?: Record<string, unknown>

  created_at: string
  updated_at: string
}

// ============================================================================
// CONTRACTORS
// ============================================================================

export type MaxJobSize = 'small' | 'medium' | 'large' | 'any'
export type ContractorJobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface Contractor {
  id: string
  tenant_id: string

  name: string
  company_name?: string
  phone?: string
  email?: string
  address?: string

  specialties?: string[]
  max_job_size?: MaxJobSize
  service_area?: string[]

  overall_score?: number // 1-100
  bid_accuracy_score?: number
  timeline_score?: number
  quality_score?: number
  communication_score?: number

  total_jobs?: number
  total_value?: number
  avg_job_size?: number

  notes?: string
  is_active?: boolean
  is_preferred?: boolean

  created_at: string
  updated_at: string
}

export interface ContractorJob {
  id: string
  contractor_id: string
  deal_id?: string
  tenant_id: string

  job_type?: string
  scope_description?: string

  bid_amount?: number
  bid_date?: string
  bid_timeline_days?: number

  actual_amount?: number
  actual_timeline_days?: number
  start_date?: string
  end_date?: string
  status?: ContractorJobStatus

  quality_rating?: number // 1-5
  communication_rating?: number // 1-5
  would_use_again?: boolean

  had_change_orders?: boolean
  change_order_amount?: number
  had_callbacks?: boolean

  notes?: string

  created_at: string
  updated_at: string

  // Joined data
  contractor?: Contractor
}

// ============================================================================
// MARKET PULSE DATA
// ============================================================================

export type MarketTemperature = 'cold' | 'cool' | 'neutral' | 'warm' | 'hot'
export type TrendDirection = 'declining' | 'stable' | 'rising'

export interface MarketPulseData {
  id: string
  zip_code: string
  city?: string
  state?: string
  county?: string
  metro?: string
  period_date: string

  // Listing metrics
  active_listings?: number
  new_listings?: number
  pending_sales?: number
  closed_sales?: number

  // Pricing
  median_list_price?: number
  median_sale_price?: number
  avg_price_per_sqft?: number
  price_change_pct?: number

  // Market velocity
  avg_days_on_market?: number
  sale_to_list_ratio?: number
  absorption_rate?: number

  // Investor activity
  llc_purchase_pct?: number
  cash_purchase_pct?: number
  flip_volume?: number
  investor_purchase_volume?: number

  // Analysis
  market_temperature?: MarketTemperature
  trend_direction?: TrendDirection
  investor_opportunity_score?: number

  created_at: string
}

// ============================================================================
// MARKET ALERTS
// ============================================================================

export type MarketAlertType =
  | 'price_drop'
  | 'inventory_spike'
  | 'investor_surge'
  | 'permit_activity'
  | 'dom_change'
  | 'new_listings_surge'
  | 'market_shift'
  | 'opportunity'

export type AlertSeverity = 'info' | 'notable' | 'significant' | 'urgent'

export interface MarketAlert {
  id: string
  tenant_id?: string
  user_id?: string
  zip_code?: string
  city?: string
  state?: string

  alert_type: MarketAlertType
  severity: AlertSeverity
  title: string
  description?: string
  data?: Record<string, unknown>

  action_url?: string
  action_label?: string

  is_read: boolean
  read_at?: string
  is_dismissed: boolean

  created_at: string
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreatePassedDealInput {
  deal_id?: string
  attom_id?: string
  address: string
  city?: string
  state?: string
  zip_code?: string
  pass_reason: PassReason
  pass_notes?: string
  asking_price_at_pass?: number
  our_max_offer?: number
  is_watching?: boolean
  watch_until?: string
}

export interface CreateOutcomeInput {
  deal_id: string
  predicted_arv?: number
  predicted_rehab_cost?: number
  predicted_hold_days?: number
  predicted_profit?: number
  actual_arv?: number
  actual_rehab_cost?: number
  actual_hold_days?: number
  actual_profit?: number
  actual_sale_price?: number
  outcome_type: OutcomeType
  outcome_date?: string
  outcome_notes?: string
}

export interface UpdateOutcomeInput {
  id: string
  actual_arv?: number
  actual_rehab_cost?: number
  actual_hold_days?: number
  actual_profit?: number
  actual_sale_price?: number
  outcome_type?: OutcomeType
  outcome_date?: string
  outcome_notes?: string
}

// ============================================================================
// OUTCOME METRICS - Aggregated views
// ============================================================================

export interface OutcomeMetrics {
  total_deals_with_outcomes: number
  avg_arv_accuracy: number
  avg_rehab_accuracy: number
  avg_profit_accuracy: number
  total_profit: number
  avg_profit_per_deal: number
  best_property_type?: string
  best_zip_code?: string
}
