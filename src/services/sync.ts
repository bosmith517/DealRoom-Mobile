/**
 * SyncService
 *
 * Handles syncing offline data when connectivity is restored.
 *
 * - Processes pending uploads
 * - Processes pending mutations
 * - Updates cache with fresh data
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { offlineService, type OfflineQueueItem, type PendingMutation } from './offline'
import { uploadService } from './upload'
import { apiService } from './api'
import { supabase } from '../lib/supabase'

// ============================================================================
// Types
// ============================================================================

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingUploads: number
  pendingMutations: number
  lastSyncTime: string | null
  errors: SyncError[]
}

export interface SyncError {
  id: string
  type: 'upload' | 'mutation'
  message: string
  timestamp: string
}

export type SyncStatusCallback = (status: SyncStatus) => void

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRY_COUNT = 3
const SYNC_DEBOUNCE_MS = 2000

// ============================================================================
// SyncService
// ============================================================================

class SyncService {
  private isOnline: boolean = true
  private isSyncing: boolean = false
  private syncTimeout: ReturnType<typeof setTimeout> | null = null
  private listeners: Set<SyncStatusCallback> = new Set()
  private errors: SyncError[] = []
  private unsubscribeNetInfo: (() => void) | null = null
  private cachedPendingUploads: number = 0
  private cachedPendingMutations: number = 0
  private cachedLastSyncTime: string | null = null

  /**
   * Initialize the sync service and start listening for connectivity changes
   */
  initialize(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleConnectivityChange)

    // Check initial state
    NetInfo.fetch().then(this.handleConnectivityChange)

    // Load initial counts
    this.refreshCounts()
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo()
      this.unsubscribeNetInfo = null
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
    }
    this.listeners.clear()
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: SyncStatusCallback): () => void {
    this.listeners.add(callback)
    // Immediately notify with current status
    callback(this.getStatus())
    return () => this.listeners.delete(callback)
  }

  /**
   * Refresh cached counts from async storage
   */
  private async refreshCounts(): Promise<void> {
    const [uploads, mutations, lastSync] = await Promise.all([
      offlineService.getPendingUploadsAsync(),
      offlineService.getPendingMutationsAsync(),
      offlineService.getLastSyncTimeAsync(),
    ])
    this.cachedPendingUploads = uploads.length
    this.cachedPendingMutations = mutations.length
    this.cachedLastSyncTime = lastSync
  }

  /**
   * Get current sync status (synchronous - uses cached counts)
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingUploads: this.cachedPendingUploads,
      pendingMutations: this.cachedPendingMutations,
      lastSyncTime: this.cachedLastSyncTime,
      errors: this.errors,
    }
  }

  /**
   * Manually trigger a sync
   */
  async sync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) {
      return
    }

    this.isSyncing = true
    this.errors = []
    this.notifyListeners()

    try {
      // Process uploads first
      await this.processUploadQueue()

      // Then process mutations
      await this.processMutationQueue()

      // Update last sync time
      offlineService.setLastSyncTime()

    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
      await this.refreshCounts()
      this.notifyListeners()
    }
  }

  /**
   * Handle connectivity changes
   */
  private handleConnectivityChange = (state: NetInfoState): void => {
    const wasOffline = !this.isOnline
    this.isOnline = state.isConnected === true && state.isInternetReachable !== false

    this.notifyListeners()

    // If we just came online, trigger sync after debounce
    if (wasOffline && this.isOnline) {
      this.scheduleSyncDebounced()
    }
  }

  /**
   * Schedule a sync with debounce
   */
  private scheduleSyncDebounced(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    this.syncTimeout = setTimeout(() => {
      this.sync()
    }, SYNC_DEBOUNCE_MS)
  }

  /**
   * Process all pending uploads
   */
  private async processUploadQueue(): Promise<void> {
    const pendingUploads = await offlineService.getPendingUploadsAsync()

    for (const item of pendingUploads) {
      if (!this.isOnline) break // Stop if we go offline

      try {
        offlineService.updateUploadQueueItem(item.id, { status: 'uploading' })
        await this.refreshCounts()
        this.notifyListeners()

        const result = await uploadService.uploadWithRetry(
          item.localUri,
          {
            opportunityId: item.opportunityId,
            evaluationId: item.evaluationId,
            promptKey: item.promptKey,
          }
        )

        if (result.success) {
          offlineService.updateUploadQueueItem(item.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
        } else {
          const newRetryCount = item.retryCount + 1

          if (newRetryCount >= MAX_RETRY_COUNT) {
            offlineService.updateUploadQueueItem(item.id, {
              status: 'failed',
              errorMessage: result.error,
              retryCount: newRetryCount,
            })
            this.addError('upload', item.id, result.error || 'Upload failed')
          } else {
            offlineService.updateUploadQueueItem(item.id, {
              status: 'pending',
              errorMessage: result.error,
              retryCount: newRetryCount,
            })
          }
        }

        await this.refreshCounts()
        this.notifyListeners()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        offlineService.updateUploadQueueItem(item.id, {
          status: 'pending',
          errorMessage,
          retryCount: item.retryCount + 1,
        })
        this.addError('upload', item.id, errorMessage)
        await this.refreshCounts()
        this.notifyListeners()
      }
    }
  }

  /**
   * Process all pending mutations
   */
  private async processMutationQueue(): Promise<void> {
    const mutations = await offlineService.getPendingMutationsAsync()

    for (const mutation of mutations) {
      if (!this.isOnline) break // Stop if we go offline

      try {
        const success = await this.processMutation(mutation)

        if (success) {
          offlineService.removePendingMutation(mutation.id)
        } else {
          const newRetryCount = mutation.retryCount + 1

          if (newRetryCount >= MAX_RETRY_COUNT) {
            offlineService.removePendingMutation(mutation.id)
            this.addError('mutation', mutation.id, `Mutation ${mutation.type} failed after ${MAX_RETRY_COUNT} retries`)
          } else {
            offlineService.updatePendingMutation(mutation.id, {
              retryCount: newRetryCount,
            })
          }
        }

        await this.refreshCounts()
        this.notifyListeners()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.addError('mutation', mutation.id, errorMessage)
        this.notifyListeners()
      }
    }
  }

  /**
   * Process a single mutation
   */
  private async processMutation(mutation: PendingMutation): Promise<boolean> {
    switch (mutation.type) {
      case 'evaluation_update': {
        const { sessionId, ...updates } = mutation.payload
        const result = await apiService.updateEvaluation(sessionId, updates)
        return result.error === null
      }

      case 'note_create': {
        // Note creation - expects payload: { dealId?, leadId?, content, isPinned? }
        const { dealId, leadId, content, isPinned = false } = mutation.payload
        if ((!dealId && !leadId) || !content) {
          console.error('note_create mutation missing required fields:', mutation.payload)
          return false
        }

        // Get tenant_id from deal or lead
        let tenantId: string | null = null
        if (dealId) {
          const { data: deal } = await supabase
            .from('dealroom_deals')
            .select('tenant_id')
            .eq('id', dealId)
            .single()
          tenantId = deal?.tenant_id || null
        } else if (leadId) {
          const { data: lead } = await supabase
            .from('dealroom_leads')
            .select('tenant_id')
            .eq('id', leadId)
            .single()
          tenantId = lead?.tenant_id || null
        }

        if (!tenantId) {
          console.error('Could not determine tenant_id for note insert')
          return false
        }

        const { error } = await supabase
          .from('dealroom_notes')
          .insert({
            tenant_id: tenantId,
            deal_id: dealId || null,
            lead_id: leadId || null,
            content,
            is_pinned: isPinned,
          })
        if (error) {
          console.error('Failed to create note:', error.message)
          return false
        }
        return true
      }

      case 'checklist_update': {
        // Checklist update - expects payload: { checklistId, items } or { dealId, leadId, checklistType, items }
        const { checklistId, dealId, leadId, checklistType, items } = mutation.payload
        if (!items) {
          console.error('checklist_update mutation missing items:', mutation.payload)
          return false
        }

        if (checklistId) {
          // Update existing checklist by ID
          const { error } = await supabase
            .from('dealroom_checklists')
            .update({ items, updated_at: new Date().toISOString() })
            .eq('id', checklistId)
          if (error) {
            console.error('Failed to update checklist:', error.message)
            return false
          }
        } else if ((dealId || leadId) && checklistType) {
          // First try to find existing checklist
          let query = supabase
            .from('dealroom_checklists')
            .select('id')
            .eq('checklist_type', checklistType)

          if (dealId) {
            query = query.eq('deal_id', dealId)
          } else if (leadId) {
            query = query.eq('lead_id', leadId)
          }

          const { data: existing } = await query.maybeSingle()

          if (existing) {
            // Update existing
            const { error } = await supabase
              .from('dealroom_checklists')
              .update({ items, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
            if (error) {
              console.error('Failed to update checklist:', error.message)
              return false
            }
          } else {
            // Insert new - need to get tenant_id from deal or lead
            let tenantId: string | null = null

            if (dealId) {
              const { data: deal } = await supabase
                .from('dealroom_deals')
                .select('tenant_id')
                .eq('id', dealId)
                .single()
              tenantId = deal?.tenant_id || null
            } else if (leadId) {
              const { data: lead } = await supabase
                .from('dealroom_leads')
                .select('tenant_id')
                .eq('id', leadId)
                .single()
              tenantId = lead?.tenant_id || null
            }

            if (!tenantId) {
              console.error('Could not determine tenant_id for checklist insert')
              return false
            }

            const { error } = await supabase
              .from('dealroom_checklists')
              .insert({
                tenant_id: tenantId,
                deal_id: dealId || null,
                lead_id: leadId || null,
                checklist_type: checklistType,
                items,
              })
            if (error) {
              console.error('Failed to insert checklist:', error.message)
              return false
            }
          }
        } else {
          console.error('checklist_update mutation missing checklistId or (dealId|leadId)+checklistType:', mutation.payload)
          return false
        }
        return true
      }

      case 'lead_update': {
        // Lead update - expects payload: { leadId, updates }
        const { leadId, updates } = mutation.payload
        if (!leadId || !updates) {
          console.error('lead_update mutation missing required fields:', mutation.payload)
          return false
        }

        const { error } = await supabase
          .from('dealroom_leads')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', leadId)

        if (error) {
          console.error('Failed to update lead:', error.message)
          return false
        }
        return true
      }

      case 'deal_update': {
        // Deal update - expects payload: { dealId, updates }
        const { dealId, updates } = mutation.payload
        if (!dealId || !updates) {
          console.error('deal_update mutation missing required fields:', mutation.payload)
          return false
        }

        const { error } = await supabase
          .from('dealroom_deals')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', dealId)

        if (error) {
          console.error('Failed to update deal:', error.message)
          return false
        }
        return true
      }

      case 'reach_transition': {
        // Reach status transition - expects payload: { leadId, newStatus, source, metadata }
        const { leadId, newStatus, source = 'mobile', metadata = {} } = mutation.payload
        if (!leadId || !newStatus) {
          console.error('reach_transition mutation missing required fields:', mutation.payload)
          return false
        }

        const { error } = await supabase.rpc('transition_lead_reach_status', {
          p_lead_id: leadId,
          p_new_status: newStatus,
          p_source: source,
          p_metadata: metadata,
        })

        if (error) {
          console.error('Failed to transition reach status:', error.message)
          return false
        }
        return true
      }

      case 'reach_interaction': {
        // Reach interaction - expects payload: { leadId, interactionType, direction, contactPhone, contactEmail }
        const { leadId, interactionType, direction, contactPhone, contactEmail } = mutation.payload
        if (!leadId || !interactionType || !direction) {
          console.error('reach_interaction mutation missing required fields:', mutation.payload)
          return false
        }

        const { error } = await supabase.rpc('record_reach_interaction', {
          p_lead_id: leadId,
          p_interaction_type: interactionType,
          p_direction: direction,
          p_contact_phone: contactPhone || null,
          p_contact_email: contactEmail || null,
        })

        if (error) {
          console.error('Failed to record reach interaction:', error.message)
          return false
        }
        return true
      }

      default:
        console.error(`Unknown mutation type: ${(mutation as any).type}`)
        return false
    }
  }

  /**
   * Add an error to the list
   */
  private addError(type: 'upload' | 'mutation', id: string, message: string): void {
    this.errors.push({
      id,
      type,
      message,
      timestamp: new Date().toISOString(),
    })

    // Keep only last 10 errors
    if (this.errors.length > 10) {
      this.errors = this.errors.slice(-10)
    }
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus()
    this.listeners.forEach((callback) => callback(status))
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = []
    this.notifyListeners()
  }

  /**
   * Retry failed uploads
   */
  async retryFailedUploads(): Promise<void> {
    const failed = await offlineService.getFailedUploadsAsync()

    for (const item of failed) {
      offlineService.updateUploadQueueItem(item.id, {
        status: 'pending',
        retryCount: 0,
        errorMessage: undefined,
      })
    }

    // Trigger sync
    await this.sync()
  }
}

// Export singleton
export const syncService = new SyncService()

// Export class for testing
export { SyncService }
