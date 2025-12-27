/**
 * OfflineService
 *
 * AsyncStorage-based local storage for offline caching and queue management.
 *
 * Stores:
 * - Cached deals/properties
 * - Pending uploads
 * - Evaluation drafts
 * - Voice note recordings
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UploadQueueItem, UploadStatus } from '../types'

// ============================================================================
// Keys
// ============================================================================

const KEYS = {
  // Cached data
  DEALS_CACHE: '@dealroom:deals:cache',
  PROPERTY_CACHE: '@dealroom:property:cache:',
  EVALUATION_DRAFT: '@dealroom:evaluation:draft:',

  // Upload queue
  UPLOAD_QUEUE: '@dealroom:upload:queue',

  // Sync state
  LAST_SYNC: '@dealroom:sync:last',
  PENDING_MUTATIONS: '@dealroom:sync:mutations',

  // User preferences
  MAP_VIEWPORT: '@dealroom:user:mapViewport',
  OFFLINE_MODE: '@dealroom:user:offlineMode',
}

// ============================================================================
// Types
// ============================================================================

export interface CachedDeal {
  id: string
  data: any
  cachedAt: string
  expiresAt: string
}

export interface PendingMutation {
  id: string
  type:
    | 'evaluation_update'
    | 'note_create'
    | 'checklist_update'
    | 'lead_update'
    | 'deal_update'
    | 'reach_transition'
    | 'reach_interaction'
  payload: any
  createdAt: string
  retryCount: number
}

export interface OfflineQueueItem extends UploadQueueItem {
  localPath: string
  thumbnailPath?: string
}

// ============================================================================
// OfflineService
// ============================================================================

class OfflineService {
  // --------------------------------------------------------------------------
  // Generic Storage
  // --------------------------------------------------------------------------

  get<T>(key: string): T | null {
    // Synchronous wrapper - returns cached value or null
    // For async operations, use the async methods directly
    return null
  }

  set(key: string, value: any): void {
    // Fire and forget async set
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.warn)
  }

  delete(key: string): void {
    AsyncStorage.removeItem(key).catch(console.warn)
  }

  // --------------------------------------------------------------------------
  // Deal Cache
  // --------------------------------------------------------------------------

  getCachedDeals(): CachedDeal[] {
    // Sync version returns empty, use async version
    return []
  }

  async getCachedDealsAsync(): Promise<CachedDeal[]> {
    try {
      const value = await AsyncStorage.getItem(KEYS.DEALS_CACHE)
      if (!value) return []
      const cache = JSON.parse(value) as CachedDeal[]
      const now = new Date().toISOString()
      return cache.filter((item) => item.expiresAt > now)
    } catch {
      return []
    }
  }

  setCachedDeals(deals: any[]): void {
    const now = new Date()
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const cache: CachedDeal[] = deals.map((deal) => ({
      id: deal.id,
      data: deal,
      cachedAt: now.toISOString(),
      expiresAt: expiry.toISOString(),
    }))

    AsyncStorage.setItem(KEYS.DEALS_CACHE, JSON.stringify(cache)).catch(console.warn)
  }

  getCachedProperty(propertyId: string): any | null {
    return null
  }

  async getCachedPropertyAsync(propertyId: string): Promise<any | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.PROPERTY_CACHE + propertyId)
      if (!value) return null
      const cached = JSON.parse(value) as CachedDeal
      if (cached.expiresAt < new Date().toISOString()) {
        await AsyncStorage.removeItem(KEYS.PROPERTY_CACHE + propertyId)
        return null
      }
      return cached.data
    } catch {
      return null
    }
  }

  setCachedProperty(propertyId: string, data: any): void {
    const now = new Date()
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const cached: CachedDeal = {
      id: propertyId,
      data,
      cachedAt: now.toISOString(),
      expiresAt: expiry.toISOString(),
    }

    AsyncStorage.setItem(KEYS.PROPERTY_CACHE + propertyId, JSON.stringify(cached)).catch(console.warn)
  }

  // --------------------------------------------------------------------------
  // Evaluation Drafts
  // --------------------------------------------------------------------------

  getEvaluationDraft(sessionId: string): any | null {
    return null
  }

  async getEvaluationDraftAsync(sessionId: string): Promise<any | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.EVALUATION_DRAFT + sessionId)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  }

  setEvaluationDraft(sessionId: string, draft: any): void {
    AsyncStorage.setItem(
      KEYS.EVALUATION_DRAFT + sessionId,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    ).catch(console.warn)
  }

  deleteEvaluationDraft(sessionId: string): void {
    AsyncStorage.removeItem(KEYS.EVALUATION_DRAFT + sessionId).catch(console.warn)
  }

  // --------------------------------------------------------------------------
  // Upload Queue
  // --------------------------------------------------------------------------

  getUploadQueue(): OfflineQueueItem[] {
    return []
  }

  async getUploadQueueAsync(): Promise<OfflineQueueItem[]> {
    try {
      const value = await AsyncStorage.getItem(KEYS.UPLOAD_QUEUE)
      return value ? JSON.parse(value) : []
    } catch {
      return []
    }
  }

  addToUploadQueue(item: OfflineQueueItem): void {
    this.getUploadQueueAsync().then((queue) => {
      queue.push(item)
      AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify(queue)).catch(console.warn)
    })
  }

  updateUploadQueueItem(id: string, updates: Partial<OfflineQueueItem>): void {
    this.getUploadQueueAsync().then((queue) => {
      const index = queue.findIndex((item) => item.id === id)
      if (index === -1) return
      queue[index] = { ...queue[index], ...updates }
      AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify(queue)).catch(console.warn)
    })
  }

  removeFromUploadQueue(id: string): void {
    this.getUploadQueueAsync().then((queue) => {
      const filtered = queue.filter((item) => item.id !== id)
      AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify(filtered)).catch(console.warn)
    })
  }

  getUploadQueueByStatus(status: UploadStatus): OfflineQueueItem[] {
    return []
  }

  async getUploadQueueByStatusAsync(status: UploadStatus): Promise<OfflineQueueItem[]> {
    const queue = await this.getUploadQueueAsync()
    return queue.filter((item) => item.status === status)
  }

  getPendingUploads(): OfflineQueueItem[] {
    return []
  }

  async getPendingUploadsAsync(): Promise<OfflineQueueItem[]> {
    return this.getUploadQueueByStatusAsync('pending')
  }

  getFailedUploads(): OfflineQueueItem[] {
    return []
  }

  async getFailedUploadsAsync(): Promise<OfflineQueueItem[]> {
    return this.getUploadQueueByStatusAsync('failed')
  }

  clearCompletedUploads(): void {
    this.getUploadQueueAsync().then((queue) => {
      const pending = queue.filter((item) => item.status !== 'completed')
      AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify(pending)).catch(console.warn)
    })
  }

  // --------------------------------------------------------------------------
  // Pending Mutations
  // --------------------------------------------------------------------------

  getPendingMutations(): PendingMutation[] {
    return []
  }

  async getPendingMutationsAsync(): Promise<PendingMutation[]> {
    try {
      const value = await AsyncStorage.getItem(KEYS.PENDING_MUTATIONS)
      return value ? JSON.parse(value) : []
    } catch {
      return []
    }
  }

  addPendingMutation(type: PendingMutation['type'], payload: any): string {
    const id = `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.getPendingMutationsAsync().then((mutations) => {
      mutations.push({
        id,
        type,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      })
      AsyncStorage.setItem(KEYS.PENDING_MUTATIONS, JSON.stringify(mutations)).catch(console.warn)
    })

    return id
  }

  updatePendingMutation(id: string, updates: Partial<PendingMutation>): void {
    this.getPendingMutationsAsync().then((mutations) => {
      const index = mutations.findIndex((m) => m.id === id)
      if (index === -1) return
      mutations[index] = { ...mutations[index], ...updates }
      AsyncStorage.setItem(KEYS.PENDING_MUTATIONS, JSON.stringify(mutations)).catch(console.warn)
    })
  }

  removePendingMutation(id: string): void {
    this.getPendingMutationsAsync().then((mutations) => {
      const filtered = mutations.filter((m) => m.id !== id)
      AsyncStorage.setItem(KEYS.PENDING_MUTATIONS, JSON.stringify(filtered)).catch(console.warn)
    })
  }

  // --------------------------------------------------------------------------
  // Sync State
  // --------------------------------------------------------------------------

  getLastSyncTime(): string | null {
    return null
  }

  async getLastSyncTimeAsync(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.LAST_SYNC)
    } catch {
      return null
    }
  }

  setLastSyncTime(time: string = new Date().toISOString()): void {
    AsyncStorage.setItem(KEYS.LAST_SYNC, time).catch(console.warn)
  }

  // --------------------------------------------------------------------------
  // User Preferences
  // --------------------------------------------------------------------------

  getMapViewport(): { lat: number; lng: number; zoom: number } | null {
    return null
  }

  async getMapViewportAsync(): Promise<{ lat: number; lng: number; zoom: number } | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.MAP_VIEWPORT)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  }

  setMapViewport(viewport: { lat: number; lng: number; zoom: number }): void {
    AsyncStorage.setItem(KEYS.MAP_VIEWPORT, JSON.stringify(viewport)).catch(console.warn)
  }

  isOfflineModeEnabled(): boolean {
    return false
  }

  async isOfflineModeEnabledAsync(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.OFFLINE_MODE)
      return value === 'true'
    } catch {
      return false
    }
  }

  setOfflineModeEnabled(enabled: boolean): void {
    AsyncStorage.setItem(KEYS.OFFLINE_MODE, enabled ? 'true' : 'false').catch(console.warn)
  }

  // --------------------------------------------------------------------------
  // Clear All
  // --------------------------------------------------------------------------

  clearAll(): void {
    AsyncStorage.getAllKeys().then((keys) => {
      const dealroomKeys = keys.filter((key) => key.startsWith('@dealroom:'))
      AsyncStorage.multiRemove(dealroomKeys).catch(console.warn)
    })
  }

  clearCache(): void {
    AsyncStorage.removeItem(KEYS.DEALS_CACHE).catch(console.warn)
    AsyncStorage.getAllKeys().then((keys) => {
      const propertyKeys = keys.filter((key) => key.startsWith(KEYS.PROPERTY_CACHE))
      if (propertyKeys.length > 0) {
        AsyncStorage.multiRemove(propertyKeys).catch(console.warn)
      }
    })
  }
}

// Export singleton
export const offlineService = new OfflineService()

// Export class for testing
export { OfflineService }
