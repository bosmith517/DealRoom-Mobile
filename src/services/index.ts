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
  getTriageChannelCounts,
  handleSwipeAction,
  undoSwipeAction,
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
  type TriageChannel,
  type TriageChannelCount,
  type SwipeResult,
  type AnalyzeQueueItem,
  type AnalysisSnapshot,
  type AIJob,
  type AIJobType,
  type AIJobStatus,
  type BuyBox,
  type ActivityEvent,
  type SavedSearch,
  // Usage Limit Error
  UsageLimitError,
  type UsageLimitErrorData,
} from './data'

// AI Service with Investor Profile Management
export { aiService } from './aiService'

// Intelligence Service (n8n workflow outputs)
export {
  intelligenceService,
  // Market Alerts
  getMarketAlerts,
  getUnreadAlertCount,
  getUrgentAlerts,
  markAlertRead,
  dismissAlert,
  markAllAlertsRead,
  // Seller Motivation
  getMotivationScore,
  getMotivationScoresForLeads,
  // Investor Patterns
  getInvestorPatterns,
  getPatternInsights,
  // Market Pulse
  getMarketPulseData,
  getAllMarketPulseData,
  getTrackedZipCodes,
  // Helpers
  getSeverityColor,
  getSeverityLabel,
  getAlertTypeIcon,
  getMotivationColor,
} from './intelligenceService'

// n8n Webhook Service (trigger n8n workflows)
export { n8nService } from './n8nService'

// Notification Service (push notifications)
export { notificationService } from './notificationService'

// Followup Service (tasks & reminders)
export {
  followupService,
  type Followup,
  type CreateFollowupInput,
  type UpdateFollowupInput,
  type FollowupCounts,
} from './followupService'

// Contact Service (contacts management)
export {
  contactService,
  type Contact,
  type ContactPhone,
  type ContactEmail,
  type ContactAddress,
  type ContactDeal,
  type ContactTimelineEvent,
} from './contactService'

// Pipeline Service (multi-pipeline management)
export {
  pipelineService,
  type Pipeline,
  type PipelineStage,
  type PipelineType,
} from './pipelineService'

// Calendar Service (events & appointments)
export {
  calendarService,
  type CalendarEvent,
  type EventType,
  type EventStatus,
} from './calendarService'

// Cost Service (deal costs & expenses)
export {
  costService,
  formatCurrency as formatCostCurrency,
  getStatusColor as getCostStatusColor,
  getStatusLabel as getCostStatusLabel,
  type CostCategory,
  type CostItem,
  type DealCost,
  type CreateCostInput,
  type CostSummary,
  type CostStatus,
} from './costService'

// Profile Service (user profile data)
export {
  profileService,
  type InvestorProfile,
} from './profileService'

// Dashboard Service (enhanced dashboard data)
export {
  dashboardService,
  getDailyFocus,
  getUserGoals,
  createUserGoal,
  updateUserGoal,
  deleteUserGoal,
  getQuickWinSuggestions,
  getPipelineHealth,
  getTimeBasedGreeting,
  getGoalTypeLabel,
  getGoalTypeIcon,
  formatGoalValue,
  type DailyFocus,
  type UserGoal,
  type CreateGoalInput,
  type QuickWin,
  type PipelineHealth,
} from './dashboardService'
