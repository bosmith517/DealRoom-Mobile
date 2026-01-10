/**
 * FlipMantis Contracts - Local Types
 *
 * These types mirror the shared contracts package.
 * TODO: Replace with @flipmantis/contracts when monorepo is set up.
 */

// ============================================================================
// CORE MODELS
// ============================================================================

// Database stages from dealroom_deals table
export type DealStage =
  | 'lead'
  | 'prospect'
  | 'prospecting'
  | 'researching'
  | 'evaluating'
  | 'analyzing'
  | 'underwriting'
  | 'offer_pending'
  | 'offer_submitted'
  | 'under_contract'
  | 'due_diligence'
  | 'closing'
  | 'closed'
  | 'dead'

export interface DealStageConfigItem {
  label: string
  color: string
  description?: string
}

export const DEAL_STAGE_CONFIG: Record<DealStage, DealStageConfigItem> = {
  lead: { label: 'Lead', color: '#94a3b8' },
  prospect: { label: 'Prospect', color: '#a78bfa' },
  prospecting: { label: 'Prospecting', color: '#a78bfa' },
  researching: { label: 'Researching', color: '#8b5cf6' },
  evaluating: { label: 'Evaluating', color: '#6366f1' },
  analyzing: { label: 'Analyzing', color: '#60a5fa' },
  underwriting: { label: 'Underwriting', color: '#3b82f6' },
  offer_pending: { label: 'Offer Pending', color: '#f59e0b' },
  offer_submitted: { label: 'Offer Submitted', color: '#f97316' },
  under_contract: { label: 'Under Contract', color: '#22c55e' },
  due_diligence: { label: 'Due Diligence', color: '#14b8a6' },
  closing: { label: 'Closing', color: '#0891b2' },
  closed: { label: 'Closed', color: '#06b6d4' },
  dead: { label: 'Dead', color: '#ef4444' },
}

export type PropertyType =
  | 'single_family'
  | 'multi_family'
  | 'condo'
  | 'townhouse'
  | 'land'
  | 'commercial'
  | 'mixed_use'
  | 'other'

export type ExitStrategy = 'flip' | 'brrrr' | 'wholesale' | 'hold' | 'other'

// Contact types - aligned with web's comprehensive list
export type ContactType =
  | 'seller'
  | 'buyer'
  | 'agent_listing'
  | 'agent_buyer'
  | 'wholesaler'
  | 'lender'
  | 'hard_money_lender'
  | 'private_lender'
  | 'title_company'
  | 'attorney'
  | 'contractor'
  | 'property_manager'
  | 'jv_partner'
  | 'bird_dog'
  | 'tenant'
  | 'other'

export type ContactStatus =
  | 'active'
  | 'inactive'
  | 'do_not_contact'
  | 'deceased'
  | 'bad_data'
  | 'archived'

export type EngagementLevel = 'hot' | 'warm' | 'cold' | 'dead'

export interface PhotoPrompt {
  key: string
  label: string
  required: boolean
  capturedMediaId: string | null
  capturedAt: string | null
}

// ============================================================================
// API TYPES
// ============================================================================

export interface UploadUrlRequest {
  opportunityId?: string
  evaluationId?: string
  promptKey?: string
  mimeType: string
  fileName?: string
}

export interface UploadUrlResponse {
  uploadUrl: string
  uploadId: string
  expiresAt: string
  bucket: string
  path: string
  token?: string
}

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'

export interface UploadQueueItem {
  id: string
  localUri: string
  targetPath: string
  promptKey?: string
  evaluationId?: string
  opportunityId?: string
  mimeType: string
  status: UploadStatus
  retryCount: number
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export interface PropertyIntelRequest {
  assetId?: string
  address?: string
  forceRefresh?: boolean
}

export interface PropertyIntelResponse {
  property: any
  attom: any | null
  lastFetchedAt: string | null
}

export interface CompsRequest {
  assetId?: string
  lat?: number
  lng?: number
  radiusMiles?: number
  monthsBack?: number
  limit?: number
}

export interface CompsResponse {
  rows: any[]
  pins: any[]
  adjustments: any[]
  subject: {
    lat: number
    lng: number
    address: string
  }
  searchRadiusMiles: number
  searchMonths: number
}

export interface DealsListRequest {
  stage?: string
  search?: string
  sortBy?: 'created_at' | 'updated_at' | 'stage_entered_at' | 'name'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface DealsListResponse {
  deals: any[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface DashboardKPIsResponse {
  totalDeals: number
  activeDeals: number
  pipelineValue: number
  closedThisMonth: number
  projectedProfit: number
  averageDaysToClose: number
  dealsByStage: { stage: string; count: number }[]
}

export interface CreateEvaluationRequest {
  dealId: string
  strategy: ExitStrategy
  priorSessionId?: string
}

export interface CreateEvaluationResponse {
  session: EvaluationSessionWithDetails
}

export interface UpdateEvaluationRequest {
  status?: 'in_progress' | 'completed' | 'abandoned'
  items?: any[]
  followUpDate?: string
  followUpNotes?: string
}

export interface EvaluationSessionWithDetails {
  id: string
  dealId: string
  evaluatorId: string
  evaluatorName?: string
  strategy: ExitStrategy
  status: 'in_progress' | 'completed' | 'abandoned'
  items: any[]
  photoPrompts: PhotoPrompt[]
  voiceNotes: any[]
  priorSession?: any
  followUpDate?: string
  followUpNotes?: string
  startedAt: string
  completedAt?: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// ============================================================================
// DATABASE MODELS
// ============================================================================

export interface Deal {
  id: string
  tenant_id: string
  name: string
  stage: DealStage
  status: 'active' | 'on_hold' | 'closed' | 'dead'
  exit_strategy?: 'flip' | 'brrrr' | 'wholesale' | 'hold' | 'subject_to' | 'lease_option' | 'other'
  owner_user_id?: string
  assigned_user_id?: string
  stage_entered_at?: string
  expected_close_date?: string
  actual_close_date?: string
  purchase_price?: number
  arv?: number
  rehab_budget?: number
  expected_profit?: number
  source?: string
  lead_id?: string
  notes?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
}

export interface Property {
  id: string
  tenant_id: string
  deal_id?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip: string
  county?: string
  lat?: number
  lng?: number
  property_type: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_sqft?: number
  year_built?: number
  stories?: number
  garage_spaces?: number
  pool?: boolean
  acquisition_source?: string
  lead_list_name?: string
  attom_cache_id?: string
  attom_fetched_at?: string
  street_view_url?: string
  primary_photo_url?: string
  created_at: string
  updated_at: string
}

export interface Underwriting {
  id: string
  tenant_id: string
  deal_id?: string
  property_id?: string
  snapshot_name?: string
  as_of_date: string
  asking_price?: number
  offer_price?: number
  purchase_price?: number
  closing_costs?: number
  arv: number
  arv_confidence: 'low' | 'medium' | 'high'
  rehab_budget: number
  holding_months?: number
  holding_cost_monthly?: number
  exit_strategy: string
  projected_sale_price?: number
  selling_costs_percent?: number
  total_investment?: number
  projected_profit?: number
  roi_percent?: number
  max_allowable_offer?: number
  equity_captured?: number
  created_at: string
  updated_at: string
}

export type RecurringPattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface Followup {
  id: string
  tenant_id: string
  deal_id?: string
  property_id?: string
  lead_id?: string
  task_type: string
  title: string
  description?: string
  due_at: string
  remind_at?: string
  assigned_to?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'snoozed'
  completed_at?: string
  outcome?: string
  recurring_pattern?: RecurringPattern
  parent_followup_id?: string
  created_at: string
  updated_at?: string
}

export interface DashboardStats {
  totalDeals: number
  activeDeals: number
  pipelineValue: number
  closedThisMonth: number
  closedYTD: number
  avgDaysToClose: number
  dealsByStage: Record<DealStage, number>
}

export interface DealWithProperty extends Omit<Deal, 'property'> {
  property: Property | null
  // Additional display/computed fields
  deal_name?: string
  contract_price?: number
  offer_price?: number
  asking_price?: number
}

// Lead from driving mode captures
export interface Lead {
  id: string
  tenant_id: string
  session_id?: string
  address?: string
  address_line1?: string
  city?: string
  state?: string
  zip?: string
  lat: number
  lng: number
  tags: string[]
  priority: 'low' | 'normal' | 'high' | 'hot'
  notes?: string
  capture_notes?: string
  source?: string
  status: 'active' | 'converted' | 'archived' | 'deleted'
  // Triage status for swipe queue
  triage_status?: 'new' | 'queued' | 'dismissed' | 'watch' | 'deal_created'
  triage_reason?: string
  // Distress scoring
  rank_score?: number
  lead_score?: number
  distress_signals?: string[]
  last_scored_at?: string
  // Reach workflow status
  reach_status?: 'not_started' | 'in_progress' | 'contacted' | 'follow_up' | 'completed' | 'dead'
  // Skip trace fields
  skip_trace_id?: string
  skip_traced_at?: string
  is_litigator?: boolean
  litigator_warning?: string
  // Photo from lead capture
  photo_url?: string
  // Ownership
  created_by?: string
  assigned_user_id?: string
  converted_to_deal_id?: string
  converted_at?: string
  created_at: string
  updated_at?: string
}

// Triage status types
export type TriageStatus = 'new' | 'queued' | 'dismissed' | 'watch' | 'deal_created'
export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeAction {
  direction: SwipeDirection
  action_key: 'DISMISS' | 'QUEUE_ANALYSIS' | 'WATCH' | 'OUTREACH_QUEUE'
  new_status: TriageStatus
}

// ============================================================================
// SKIP TRACE TYPES
// ============================================================================

export interface SkipTracePhone {
  phone: string
  type: 'mobile' | 'landline' | 'voip' | 'unknown'
  isValid: boolean
  isPrimary: boolean
  carrier?: string
}

export interface SkipTraceEmail {
  email: string
  type: 'personal' | 'work' | 'unknown'
  isValid: boolean
  isPrimary: boolean
}

export interface SkipTraceAddress {
  street: string
  city: string
  state: string
  zip: string
  type?: 'current' | 'mailing' | 'previous'
}

export interface SkipTraceRelative {
  fullName: string
  relationship?: string
  phones?: string[]
}

export type LitigatorRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SkipTraceLitigator {
  isLitigator: boolean
  score: number
  riskLevel: LitigatorRiskLevel
  caseCount?: number
}

export interface LeadWithSkipTrace extends Lead {
  skip_trace_id?: string
  skip_traced_at?: string
  is_litigator?: boolean
  litigator_warning?: string
}
