/**
 * Services Index
 *
 * Re-exports all service modules.
 */

export { apiService } from './api'
export { attomService, AttomService } from './attomService'
// Re-export ATTOM types for convenience
export type {
  PropertyData,
  ComparablesResponse,
  ComparableSale,
  SalesTrendsResponse,
  TrendDataPoint,
  ZipSearchResponse,
  AreaSalesResponse,
  LocationLookupResponse,
  AttomApiResponse,
} from '../types/attom'
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
export {
  skipTraceService,
  type SkipTraceResult,
  type SkipTraceQuote,
  type SkipTraceSettings,
  type SkipTraceUsage,
  type SkipTraceLookupOptions,
  type PhoneResult,
  type EmailResult,
  type AddressResult,
  type RelativeResult,
  type LitigatorDetails,
} from './skipTrace'
export {
  dataService,
  // Deals
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  updateDealStage,
  getRecentDeals,
  // Properties
  getProperty,
  createProperty,
  updateProperty,
  searchProperty,
  createDealFromProperty,
  // Leads
  getLeads,
  getLead,
  updateLead,
  // Triage (Swipe Queue)
  getTriageLeads,
  handleSwipeAction,
  getHotLeads,
  markLeadAsHot,
  // Analyze Queue
  getAnalyzeQueue,
  runQuickAnalysis,
  convertLeadToDeal,
  // AI Jobs
  enqueueAIJob,
  getAIJobStatus,
  pollAIJobCompletion,
  triggerAIJobProcessing,
  runAIAnalysis,
  scoreLeadWithAI,
  // Buy Box
  getActiveBuyBox,
  getBuyBoxes,
  createBuyBox,
  updateBuyBox,
  // Underwriting
  getUnderwriting,
  getLatestUnderwriting,
  // Dashboard
  getDashboardStats,
  // Followups
  getUpcomingFollowups,
  getOverdueFollowups,
  getTodayFollowups,
  getAllFollowups,
  createFollowup,
  updateFollowup,
  completeFollowup,
  snoozeFollowup,
  // Activity Timeline
  getLeadActivityTimeline,
  getDealActivityTimeline,
  // Saved Searches
  getSavedSearches,
  getSavedSearch,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
  // Utilities
  getStreetViewUrl,
  // Types
  type ATTOMPropertyResult,
  type CreateDealOptions,
  type TriageLead,
  type SwipeResult,
  type AnalyzeQueueItem,
  type AnalysisSnapshot,
  type AIJob,
  type AIJobType,
  type AIJobStatus,
  type BuyBox,
  type ActivityEvent,
  type SavedSearch,
} from './data'
