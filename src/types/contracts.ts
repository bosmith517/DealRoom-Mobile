/**
 * DealRoom Contracts - Local Types
 *
 * These types mirror the shared contracts package.
 * TODO: Replace with @dealroom/contracts when monorepo is set up.
 */

// ============================================================================
// CORE MODELS
// ============================================================================

export type DealStage =
  | 'lead'
  | 'researching'
  | 'contacted'
  | 'negotiating'
  | 'offer_sent'
  | 'under_contract'
  | 'due_diligence'
  | 'closing'
  | 'closed_won'
  | 'closed_lost'
  | 'on_hold'

export interface DealStageConfigItem {
  label: string
  color: string
  description?: string
}

export const DEAL_STAGE_CONFIG: Record<DealStage, DealStageConfigItem> = {
  lead: { label: 'Lead', color: '#94a3b8' },
  researching: { label: 'Researching', color: '#3b82f6' },
  contacted: { label: 'Contacted', color: '#8b5cf6' },
  negotiating: { label: 'Negotiating', color: '#f59e0b' },
  offer_sent: { label: 'Offer Sent', color: '#f97316' },
  under_contract: { label: 'Under Contract', color: '#22c55e' },
  due_diligence: { label: 'Due Diligence', color: '#14b8a6' },
  closing: { label: 'Closing', color: '#06b6d4' },
  closed_won: { label: 'Closed Won', color: '#10b981' },
  closed_lost: { label: 'Closed Lost', color: '#ef4444' },
  on_hold: { label: 'On Hold', color: '#6b7280' },
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
