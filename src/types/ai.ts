/**
 * AI Types for FlipMantis Mobile
 *
 * Type definitions for AI-powered features including:
 * - AI Job Queue (score, underwrite, outreach)
 * - Buy Box Preferences
 * - Analysis Snapshots
 * - Outreach Content Generation
 * - Investor Profiles
 */

// ============================================================================
// AI JOB TYPES
// ============================================================================

export type AIJobType =
  | 'score_candidate'      // Score leads 0-100 with buy box matching (Claude Haiku)
  | 'underwrite_snapshot'  // ARV, MAO, equity analysis (Claude 3.5 Sonnet)
  | 'comp_select'          // Smart comp selection
  | 'repair_estimate'      // AI-powered rehab estimation
  | 'outreach_draft'       // SMS, voicemail, letter generation (Claude 3.5 Sonnet)
  | 'portal_summary'       // Generate portal summaries

export type AIJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AIJob {
  id: string
  tenant_id: string
  job_type: AIJobType
  subject_type: string    // 'lead', 'deal', 'property', 'candidate'
  subject_id: string
  status: AIJobStatus
  priority: number        // 1 = highest, 10 = lowest
  input: Record<string, unknown>
  result?: Record<string, unknown>
  error_message?: string
  model?: string          // claude-3-haiku, claude-3-sonnet, gpt-4o-mini, gpt-4o
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost_estimate?: number  // in USD
  attempts: number
  max_attempts: number
  started_at?: string
  completed_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// AI SCORING
// ============================================================================

export type AIConfidenceLevel = 'low' | 'medium' | 'high'

export interface AIScoreResult {
  score: number              // 0-100 overall score
  match_percent: number      // Buy box match percentage
  reasons: string[]          // Why this score
  flags: string[]            // Risk flags/warnings
  confidence: AIConfidenceLevel
  next_action: string        // Recommended next step
  buy_box_match?: {
    buy_box_id: string
    buy_box_name: string
    location_score: number
    property_score: number
    financial_score: number
    distress_score: number
    match_percent: number
  }
}

/**
 * Score color thresholds for UI display
 */
export const AI_SCORE_COLORS = {
  exceptional: { min: 86, max: 100, color: 'purple', bg: '#F3E8FF', text: '#7C3AED' },
  high: { min: 71, max: 85, color: 'emerald', bg: '#D1FAE5', text: '#059669' },
  good: { min: 51, max: 70, color: 'blue', bg: '#DBEAFE', text: '#2563EB' },
  moderate: { min: 31, max: 50, color: 'amber', bg: '#FEF3C7', text: '#D97706' },
  low: { min: 0, max: 30, color: 'red', bg: '#FEE2E2', text: '#DC2626' },
} as const

export function getScoreColorConfig(score: number | undefined) {
  if (score === undefined || score === null) return AI_SCORE_COLORS.low
  if (score >= 86) return AI_SCORE_COLORS.exceptional
  if (score >= 71) return AI_SCORE_COLORS.high
  if (score >= 51) return AI_SCORE_COLORS.good
  if (score >= 31) return AI_SCORE_COLORS.moderate
  return AI_SCORE_COLORS.low
}

// ============================================================================
// ANALYSIS SNAPSHOTS
// ============================================================================

export interface AnalysisSnapshot {
  id: string
  tenant_id?: string
  lead_id?: string
  deal_id?: string
  property_id?: string

  // Core Analysis
  snapshot: {
    // ARV Analysis
    arv_low?: number
    arv_high?: number
    arv_confidence?: string
    comps_used?: number

    // Rent Analysis
    rent_low?: number
    rent_high?: number

    // Equity
    equity_estimate?: number
    equity_percent?: number
    tax_assessed?: number
    last_sale_price?: number
    last_sale_date?: string

    // Owner Status
    owner_occupied?: boolean
    absentee_owner?: boolean
    foreclosure_status?: string

    // Distress
    distress_score?: number
    distress_reasons?: string[]

    // MAO Calculations
    mao_flip?: number
    mao_brrrr?: number
    mao_wholesale?: number

    // Risk Assessment
    risk_flags?: string[]
    buy_box_fit?: string
  }

  // AI-Generated Content
  ai_summary?: string
  ai_next_actions?: string[]
  ai_confidence?: AIConfidenceLevel

  // Metadata
  job_id?: string
  created_at: string
  updated_at?: string
}

// ============================================================================
// BUY BOX
// ============================================================================

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'

export type InvestmentStrategy = 'flip' | 'brrrr' | 'wholesale' | 'hold'

export interface BuyBox {
  id: string
  tenant_id: string
  user_id: string

  // Identity
  name: string
  is_default: boolean
  is_active: boolean

  // Location Criteria
  target_zips: string[]
  target_cities: string[]
  target_counties?: string[]
  target_states: string[]
  exclude_zips: string[]

  // Property Criteria
  property_types: string[]   // sfr, multi_2_4, condo, townhouse, land
  min_beds?: number
  max_beds?: number
  min_baths?: number
  max_baths?: number
  min_sqft?: number
  max_sqft?: number
  min_lot_sqft?: number
  max_lot_sqft?: number
  min_year_built?: number
  max_year_built?: number

  // Financial Criteria
  max_purchase_price?: number
  min_arv?: number
  max_arv?: number
  min_equity_percent?: number
  max_repair_budget?: number
  min_profit?: number
  min_roi_percent?: number

  // Strategy
  strategies: InvestmentStrategy[]
  preferred_strategy: InvestmentStrategy

  // Distress Tags
  preferred_tags: string[]
  avoid_tags: string[]

  // Weights (0-100, must sum to 100)
  risk_tolerance: RiskTolerance
  weight_location: number
  weight_property_fit: number
  weight_financial: number
  weight_distress: number

  // Metadata
  created_at: string
  updated_at: string
}

export interface BuyBoxInput {
  name?: string
  is_default?: boolean
  target_zips?: string[]
  target_cities?: string[]
  target_states?: string[]
  exclude_zips?: string[]
  property_types?: string[]
  min_beds?: number
  max_beds?: number
  min_baths?: number
  max_baths?: number
  min_sqft?: number
  max_sqft?: number
  min_year_built?: number
  max_year_built?: number
  max_purchase_price?: number
  min_arv?: number
  max_arv?: number
  min_equity_percent?: number
  max_repair_budget?: number
  min_profit?: number
  min_roi_percent?: number
  strategies?: InvestmentStrategy[]
  preferred_strategy?: InvestmentStrategy
  preferred_tags?: string[]
  avoid_tags?: string[]
  risk_tolerance?: RiskTolerance
  weight_location?: number
  weight_property_fit?: number
  weight_financial?: number
  weight_distress?: number
}

/**
 * Default buy box values for new users
 */
export const DEFAULT_BUY_BOX: BuyBoxInput = {
  name: 'Default',
  is_default: true,
  target_zips: [],
  target_cities: [],
  target_states: [],
  exclude_zips: [],
  property_types: ['sfr'],
  strategies: ['flip'],
  preferred_strategy: 'flip',
  preferred_tags: ['vacant', 'absentee_owner'],
  avoid_tags: [],
  risk_tolerance: 'moderate',
  weight_location: 30,
  weight_property_fit: 25,
  weight_financial: 30,
  weight_distress: 15,
}

// ============================================================================
// OUTREACH
// ============================================================================

export interface OutreachDraft {
  id?: string
  deal_id?: string
  lead_id?: string
  owner_name?: string

  // SMS
  sms_initial: string
  sms_followup_1: string
  sms_followup_2?: string

  // Voice
  voicemail_script: string
  call_opener: string
  call_talking_points?: string[]

  // Written
  letter_subject: string
  letter_body: string
  email_subject?: string
  email_body?: string

  // Objection Handling
  objection_responses: Record<string, string>

  // Metadata
  generated_at?: string
  job_id?: string
}

/**
 * Outreach content types for UI tabs
 */
export const OUTREACH_TYPES = [
  { id: 'sms', label: 'SMS', icon: 'message-square' },
  { id: 'voicemail', label: 'Voicemail', icon: 'phone' },
  { id: 'letter', label: 'Letter', icon: 'mail' },
  { id: 'call', label: 'Call Script', icon: 'phone-call' },
] as const

export type OutreachType = typeof OUTREACH_TYPES[number]['id']

// ============================================================================
// DISTRESS SIGNALS
// ============================================================================

export interface DistressSignal {
  tag: string
  label: string
  severity: 'high' | 'medium' | 'low'
  color: string
  bgColor: string
  description: string
}

export const DISTRESS_SIGNALS: Record<string, DistressSignal> = {
  vacant: {
    tag: 'vacant',
    label: 'Vacant',
    severity: 'high',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    description: 'Property appears to be vacant',
  },
  boarded: {
    tag: 'boarded',
    label: 'Boarded',
    severity: 'high',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    description: 'Windows or doors are boarded up',
  },
  code_violation: {
    tag: 'code_violation',
    label: 'Code Violation',
    severity: 'high',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    description: 'Active code violations on record',
  },
  foreclosure: {
    tag: 'foreclosure',
    label: 'Foreclosure',
    severity: 'high',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    description: 'Property in foreclosure proceedings',
  },
  tax_lien: {
    tag: 'tax_lien',
    label: 'Tax Lien',
    severity: 'high',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    description: 'Unpaid property taxes',
  },
  absentee_owner: {
    tag: 'absentee_owner',
    label: 'Absentee Owner',
    severity: 'medium',
    color: '#D97706',
    bgColor: '#FEF3C7',
    description: 'Owner does not live at property',
  },
  overgrown: {
    tag: 'overgrown',
    label: 'Overgrown',
    severity: 'medium',
    color: '#D97706',
    bgColor: '#FEF3C7',
    description: 'Yard is overgrown or unmaintained',
  },
  mail_pileup: {
    tag: 'mail_pileup',
    label: 'Mail Pileup',
    severity: 'medium',
    color: '#D97706',
    bgColor: '#FEF3C7',
    description: 'Mail accumulation visible',
  },
  deferred_maintenance: {
    tag: 'deferred_maintenance',
    label: 'Deferred Maintenance',
    severity: 'medium',
    color: '#D97706',
    bgColor: '#FEF3C7',
    description: 'Visible signs of deferred maintenance',
  },
  probate: {
    tag: 'probate',
    label: 'Probate',
    severity: 'medium',
    color: '#D97706',
    bgColor: '#FEF3C7',
    description: 'Property in probate proceedings',
  },
  fsbo: {
    tag: 'fsbo',
    label: 'FSBO',
    severity: 'low',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    description: 'For sale by owner',
  },
  expired_listing: {
    tag: 'expired_listing',
    label: 'Expired Listing',
    severity: 'low',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    description: 'Previous listing has expired',
  },
  high_equity: {
    tag: 'high_equity',
    label: 'High Equity',
    severity: 'low',
    color: '#059669',
    bgColor: '#D1FAE5',
    description: 'Owner has significant equity',
  },
  long_ownership: {
    tag: 'long_ownership',
    label: 'Long Ownership',
    severity: 'low',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    description: 'Owner has held property 10+ years',
  },
}

export function getDistressSignal(tag: string): DistressSignal | undefined {
  return DISTRESS_SIGNALS[tag]
}

// ============================================================================
// AI USAGE & COST TRACKING
// ============================================================================

export interface AIUsageStats {
  tenant_id: string
  period: 'day' | 'month'
  period_start: string

  // Job counts by type
  jobs_total: number
  jobs_scoring: number
  jobs_underwriting: number
  jobs_outreach: number
  jobs_other: number

  // Token usage
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number

  // Costs
  total_cost_usd: number
  cost_by_model: Record<string, number>
  cost_by_job_type: Record<AIJobType, number>

  // Success rates
  jobs_completed: number
  jobs_failed: number
  success_rate: number
}

// ============================================================================
// BUY BOX TEMPLATES
// ============================================================================

export interface BuyBoxTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  strategies: string[]
  preferred_strategy: string
  risk_tolerance: string
}

export interface BuyBoxScore {
  buy_box_id: string
  name: string
  strategy: string
  score: number
  match_percent: number
  summary: string
  reasons: string[]
  breakdown: {
    location: number
    property: number
    financial: number
    distress: number
  }
  is_default: boolean
}

// ============================================================================
// INVESTOR PROFILE
// ============================================================================

export interface InvestorProfile {
  id: string
  user_id: string
  tenant_id: string

  // Experience
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  deals_completed: number
  years_investing: number
  strategies_executed: string[]

  // Financial
  capital_available: number
  capital_range: string
  funding_sources: string[]
  credit_score_range: string
  has_lending_relationships: boolean
  preferred_funding: string

  // Goals
  primary_goal: 'wealth_building' | 'cash_flow' | 'quick_profits' | 'portfolio_growth' | 'retirement'
  deals_per_year_target: number
  timeline_months: number
  monthly_income_target: number
  equity_growth_target: number

  // Time & Capacity
  hours_per_week: number
  is_full_time: boolean
  has_day_job: boolean
  can_take_calls_daytime: boolean
  preferred_work_style: 'hands_on' | 'delegator' | 'hybrid'

  // Risk
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  max_loss_tolerance: number
  comfortable_with_debt: boolean
  risk_aversions: string[]

  // Team
  has_contractor: boolean
  has_agent: boolean
  has_property_manager: boolean
  has_mentor: boolean
  team_notes: string | null

  // Market
  home_market_city: string | null
  home_market_state: string | null
  target_zips: string[]
  comfortable_remote_investing: boolean
  max_drive_time_minutes: number
  markets_interested: string[]

  // AI Preferences
  communication_style: 'detailed' | 'concise' | 'balanced'
  wants_education: boolean
  wants_market_updates: boolean
  preferred_contact_method: 'email' | 'sms' | 'in_app'
  ai_features_enabled: string[]

  // Onboarding
  onboarding_completed: boolean
  onboarding_started_at: string | null
  onboarding_completed_at: string | null
  onboarding_steps_completed: string[]
  last_profile_update: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

export interface InvestorProfileUpdate {
  experience_level?: string
  deals_completed?: number
  years_investing?: number
  strategies_executed?: string[]
  capital_available?: number
  capital_range?: string
  funding_sources?: string[]
  credit_score_range?: string
  has_lending_relationships?: boolean
  preferred_funding?: string
  primary_goal?: string
  deals_per_year_target?: number
  timeline_months?: number
  monthly_income_target?: number
  equity_growth_target?: number
  hours_per_week?: number
  is_full_time?: boolean
  has_day_job?: boolean
  can_take_calls_daytime?: boolean
  preferred_work_style?: string
  risk_tolerance?: string
  max_loss_tolerance?: number
  comfortable_with_debt?: boolean
  risk_aversions?: string[]
  has_contractor?: boolean
  has_agent?: boolean
  has_property_manager?: boolean
  has_mentor?: boolean
  team_notes?: string
  home_market_city?: string
  home_market_state?: string
  target_zips?: string[]
  comfortable_remote_investing?: boolean
  max_drive_time_minutes?: number
  markets_interested?: string[]
  communication_style?: string
  wants_education?: boolean
  wants_market_updates?: boolean
  preferred_contact_method?: string
  ai_features_enabled?: string[]
  onboarding_steps_completed?: string[]
  onboarding_completed?: boolean
  onboarding_completed_at?: string | null
}

export interface GeneratedBuyBoxesResult {
  created: number
  buy_box_ids: string[]
  strategies: string[]
  message: string
}

export interface InvestorContext {
  experience_level: string
  deals_completed: number
  capital_range: string
  strategies: string[]
  risk_tolerance: string
  preferred_strategy: string | null
  primary_goal: string
  has_contractor: boolean
  has_agent: boolean
  home_market: string | null
  hours_per_week: number
  is_hands_on: boolean
  onboarding_completed: boolean
  summary: string
}

// ============================================================================
// AI STATE FOR HOOKS
// ============================================================================

export interface AIAnalysisState {
  // Current data
  score?: AIScoreResult
  analysis?: AnalysisSnapshot
  outreach?: OutreachDraft

  // Job tracking
  currentJobId?: string
  currentJobType?: AIJobType
  jobStatus?: AIJobStatus
  jobProgress?: number

  // UI state
  isLoading: boolean
  isScoring: boolean
  isAnalyzing: boolean
  isGeneratingOutreach: boolean
  error?: string

  // Timestamps
  lastScoredAt?: string
  lastAnalyzedAt?: string
  lastOutreachAt?: string
}

export interface BuyBoxState {
  activeBuyBox?: BuyBox
  allBuyBoxes: BuyBox[]
  isLoading: boolean
  isSaving: boolean
  error?: string
}
