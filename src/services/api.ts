/**
 * API Service
 *
 * Authenticated Edge Function calls with error handling.
 */

import { supabase } from '../lib/supabase'
import type {
  PropertyIntelRequest,
  PropertyIntelResponse,
  CompsRequest,
  CompsResponse,
  DealsListRequest,
  DealsListResponse,
  DashboardKPIsResponse,
  CreateEvaluationRequest,
  CreateEvaluationResponse,
  UpdateEvaluationRequest,
  EvaluationSessionWithDetails,
  ApiError,
} from '../types'

// ============================================================================
// Types
// ============================================================================

interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
}

// ============================================================================
// Constants
// ============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const DEFAULT_TIMEOUT_MS = 30000 // 30 seconds
const MAX_AUTH_RETRIES = 1 // Retry once on 401

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No active session')
  }
  return session.access_token
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  authRetryCount: number = 0
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      // Handle 401 - attempt token refresh and retry
      if (response.status === 401 && authRetryCount < MAX_AUTH_RETRIES) {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError) {
          return fetchWithAuth<T>(endpoint, options, authRetryCount + 1)
        }
        return {
          data: null,
          error: {
            code: 'AUTH_ERROR',
            message: 'Session expired. Please log in again.',
          },
        }
      }

      const data = await response.json()

      if (!response.ok) {
        return {
          data: null,
          error: data as ApiError,
        }
      }

      return {
        data: data as T,
        error: null,
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId)

      // Handle abort (timeout)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return {
          data: null,
          error: {
            code: 'TIMEOUT_ERROR',
            message: `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000} seconds`,
          },
        }
      }
      throw fetchErr
    }
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
      },
    }
  }
}

// ============================================================================
// API Service
// ============================================================================

export const apiService = {
  // --------------------------------------------------------------------------
  // Property Intel
  // --------------------------------------------------------------------------

  async getPropertyIntel(
    params: PropertyIntelRequest
  ): Promise<ApiResponse<PropertyIntelResponse>> {
    const searchParams = new URLSearchParams()
    if (params.assetId) searchParams.set('assetId', params.assetId)
    if (params.address) searchParams.set('address', params.address)
    if (params.forceRefresh) searchParams.set('forceRefresh', 'true')

    return fetchWithAuth<PropertyIntelResponse>(
      `/property-intel?${searchParams.toString()}`
    )
  },

  // --------------------------------------------------------------------------
  // Comps
  // --------------------------------------------------------------------------

  async getComps(params: CompsRequest): Promise<ApiResponse<CompsResponse>> {
    const searchParams = new URLSearchParams()
    if (params.assetId) searchParams.set('assetId', params.assetId)
    if (params.lat) searchParams.set('lat', params.lat.toString())
    if (params.lng) searchParams.set('lng', params.lng.toString())
    if (params.radiusMiles) searchParams.set('radiusMiles', params.radiusMiles.toString())
    if (params.monthsBack) searchParams.set('monthsBack', params.monthsBack.toString())
    if (params.limit) searchParams.set('limit', params.limit.toString())

    return fetchWithAuth<CompsResponse>(`/comps?${searchParams.toString()}`)
  },

  // --------------------------------------------------------------------------
  // Deals
  // --------------------------------------------------------------------------

  async getDeals(params: DealsListRequest = {}): Promise<ApiResponse<DealsListResponse>> {
    const searchParams = new URLSearchParams()
    if (params.stage) searchParams.set('stage', params.stage)
    if (params.search) searchParams.set('search', params.search)
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
    if (params.page) searchParams.set('page', params.page.toString())
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())

    return fetchWithAuth<DealsListResponse>(`/deals?${searchParams.toString()}`)
  },

  // --------------------------------------------------------------------------
  // Dashboard
  // --------------------------------------------------------------------------

  async getDashboardKPIs(): Promise<ApiResponse<DashboardKPIsResponse>> {
    return fetchWithAuth<DashboardKPIsResponse>('/dashboard/kpis')
  },

  // --------------------------------------------------------------------------
  // Evaluations
  // --------------------------------------------------------------------------

  async createEvaluation(
    params: CreateEvaluationRequest
  ): Promise<ApiResponse<CreateEvaluationResponse>> {
    return fetchWithAuth<CreateEvaluationResponse>('/evaluation/sessions', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  async updateEvaluation(
    sessionId: string,
    params: UpdateEvaluationRequest
  ): Promise<ApiResponse<EvaluationSessionWithDetails>> {
    return fetchWithAuth<EvaluationSessionWithDetails>(
      `/evaluation/sessions/${sessionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      }
    )
  },

  async getEvaluation(
    sessionId: string
  ): Promise<ApiResponse<EvaluationSessionWithDetails>> {
    return fetchWithAuth<EvaluationSessionWithDetails>(
      `/evaluation/sessions/${sessionId}`
    )
  },

  // --------------------------------------------------------------------------
  // Portal (public, no auth required)
  // --------------------------------------------------------------------------

  async getPortalContext(token: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/portal/${token}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        return { data: null, error: data }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      }
    }
  },

  async postPortalComment(
    token: string,
    message: string,
    actionRequestId?: string
  ): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/portal/${token}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, actionRequestId }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        return { data: null, error: data }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      }
    }
  },
}
