/**
 * n8n Webhook Service
 *
 * Triggers n8n workflows via webhooks for:
 * - Seller enrichment (motivation scoring)
 * - Contractor score updates
 * - Property analysis
 */

import Constants from 'expo-constants'

// Get n8n webhook URL from environment
const N8N_WEBHOOK_BASE =
  Constants.expoConfig?.extra?.n8nWebhookUrl ||
  process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL ||
  'https://boomie05.tradeworkspro.com'

// Webhook endpoints (paths appended to base URL)
const WEBHOOKS = {
  sellerEnrichment: '/webhook/seller-enrichment',
  contractorScore: '/webhook/contractor-score',
  propertyAnalysis: '/webhook/property-analysis',
  marketPulse: '/webhook/market-pulse',
  healthCheck: '/webhook/health',
}

interface WebhookResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

/**
 * Make a webhook request to n8n
 */
async function callWebhook(
  endpoint: string,
  payload: Record<string, any>
): Promise<WebhookResponse> {
  const url = `${N8N_WEBHOOK_BASE}${endpoint}`

  try {
    console.log(`[n8nService] Calling webhook: ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[n8nService] Webhook error: ${response.status} ${errorText}`)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    console.log('[n8nService] Webhook success:', data)

    return {
      success: true,
      data,
    }
  } catch (err) {
    console.error('[n8nService] Webhook failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * n8n Service - Trigger n8n workflows via webhooks
 */
export const n8nService = {
  /**
   * Get the configured webhook base URL
   */
  getWebhookBaseUrl(): string {
    return N8N_WEBHOOK_BASE
  },

  /**
   * Trigger seller enrichment workflow
   * This runs the n8n workflow that calculates seller motivation scores
   */
  async triggerSellerEnrichment(params: {
    leadId?: string
    dealId?: string
    attomId?: string
    propertyAddress?: string
    ownerName?: string
  }): Promise<WebhookResponse> {
    if (!params.leadId && !params.dealId && !params.attomId) {
      return {
        success: false,
        error: 'Either leadId, dealId, or attomId is required',
      }
    }

    return callWebhook(WEBHOOKS.sellerEnrichment, {
      lead_id: params.leadId,
      deal_id: params.dealId,
      attom_id: params.attomId,
      property_address: params.propertyAddress,
      owner_name: params.ownerName,
      triggered_from: 'mobile_app',
      triggered_at: new Date().toISOString(),
    })
  },

  /**
   * Trigger contractor score recalculation
   * Updates contractor reliability and quality scores
   */
  async triggerContractorScoreUpdate(params: {
    contractorId: string
    newReviewScore?: number
    jobCompleted?: boolean
    jobId?: string
  }): Promise<WebhookResponse> {
    return callWebhook(WEBHOOKS.contractorScore, {
      contractor_id: params.contractorId,
      new_review_score: params.newReviewScore,
      job_completed: params.jobCompleted,
      job_id: params.jobId,
      triggered_from: 'mobile_app',
      triggered_at: new Date().toISOString(),
    })
  },

  /**
   * Trigger property analysis workflow
   * Runs AI analysis on property data
   */
  async triggerPropertyAnalysis(params: {
    dealId?: string
    leadId?: string
    attomId?: string
    analysisType?: 'full' | 'quick' | 'rehab_estimate'
  }): Promise<WebhookResponse> {
    return callWebhook(WEBHOOKS.propertyAnalysis, {
      deal_id: params.dealId,
      lead_id: params.leadId,
      attom_id: params.attomId,
      analysis_type: params.analysisType || 'quick',
      triggered_from: 'mobile_app',
      triggered_at: new Date().toISOString(),
    })
  },

  /**
   * Trigger market pulse data refresh for a ZIP code
   */
  async triggerMarketPulseRefresh(params: {
    zipCode: string
    forceRefresh?: boolean
  }): Promise<WebhookResponse> {
    return callWebhook(WEBHOOKS.marketPulse, {
      zip_code: params.zipCode,
      force_refresh: params.forceRefresh || false,
      triggered_from: 'mobile_app',
      triggered_at: new Date().toISOString(),
    })
  },

  /**
   * Health check - verify n8n is reachable
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${N8N_WEBHOOK_BASE}${WEBHOOKS.healthCheck}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (err) {
      console.warn('[n8nService] Health check failed:', err)
      return false
    }
  },

  /**
   * Check if n8n service is configured
   */
  isConfigured(): boolean {
    return !!N8N_WEBHOOK_BASE && N8N_WEBHOOK_BASE.startsWith('http')
  },
}

export default n8nService
