/**
 * Services Index
 *
 * Re-exports all service modules.
 */

export { apiService } from './api'
export {
  uploadService,
  type UploadOptions,
  type UploadProgress,
  type UploadResult,
  type UploadProgressCallback,
} from './upload'
export {
  offlineService,
  type CachedDeal,
  type PendingMutation,
  type OfflineQueueItem,
} from './offline'
export {
  syncService,
  type SyncStatus,
  type SyncError,
  type SyncStatusCallback,
} from './sync'
