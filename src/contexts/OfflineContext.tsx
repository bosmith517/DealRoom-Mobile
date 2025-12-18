/**
 * OfflineContext
 *
 * Provides offline status and sync controls to React components.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { syncService, type SyncStatus, type SyncError } from '../services/sync'
import { offlineService, type OfflineQueueItem } from '../services/offline'

// ============================================================================
// Types
// ============================================================================

interface OfflineContextValue {
  // Status
  isOnline: boolean
  isSyncing: boolean
  pendingUploads: number
  pendingMutations: number
  lastSyncTime: string | null
  errors: SyncError[]

  // Actions
  sync: () => Promise<void>
  retryFailed: () => Promise<void>
  clearErrors: () => void

  // Upload queue management
  addToUploadQueue: (item: OfflineQueueItem) => Promise<void>
  removeFromUploadQueue: (id: string) => Promise<void>
  getPendingUploads: () => Promise<OfflineQueueItem[]>

  // Cache management
  clearCache: () => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const OfflineContext = createContext<OfflineContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface OfflineProviderProps {
  children: ReactNode
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [status, setStatus] = useState<SyncStatus>(() => syncService.getStatus())

  // Initialize sync service
  useEffect(() => {
    syncService.initialize()

    const unsubscribe = syncService.subscribe((newStatus) => {
      setStatus(newStatus)
    })

    return () => {
      unsubscribe()
      syncService.cleanup()
    }
  }, [])

  // Sync action
  const sync = useCallback(async () => {
    await syncService.sync()
  }, [])

  // Retry failed uploads
  const retryFailed = useCallback(async () => {
    await syncService.retryFailedUploads()
  }, [])

  // Clear errors
  const clearErrors = useCallback(() => {
    syncService.clearErrors()
  }, [])

  // Add to upload queue
  const addToUploadQueue = useCallback(async (item: OfflineQueueItem) => {
    await offlineService.addToUploadQueue(item)
    // Trigger sync if online
    if (status.isOnline) {
      syncService.sync()
    }
  }, [status.isOnline])

  // Remove from upload queue
  const removeFromUploadQueue = useCallback(async (id: string) => {
    await offlineService.removeFromUploadQueue(id)
  }, [])

  // Get pending uploads
  const getPendingUploads = useCallback(async () => {
    return offlineService.getPendingUploads()
  }, [])

  // Clear cache
  const clearCache = useCallback(async () => {
    await offlineService.clearCache()
  }, [])

  const value: OfflineContextValue = {
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    pendingUploads: status.pendingUploads,
    pendingMutations: status.pendingMutations,
    lastSyncTime: status.lastSyncTime,
    errors: status.errors,
    sync,
    retryFailed,
    clearErrors,
    addToUploadQueue,
    removeFromUploadQueue,
    getPendingUploads,
    clearCache,
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext)

  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }

  return context
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to check if the app is online
 */
export function useIsOnline(): boolean {
  const { isOnline } = useOffline()
  return isOnline
}

/**
 * Hook to check if sync is in progress
 */
export function useIsSyncing(): boolean {
  const { isSyncing } = useOffline()
  return isSyncing
}

/**
 * Hook to get pending item counts
 */
export function usePendingCounts(): { uploads: number; mutations: number } {
  const { pendingUploads, pendingMutations } = useOffline()
  return { uploads: pendingUploads, mutations: pendingMutations }
}
