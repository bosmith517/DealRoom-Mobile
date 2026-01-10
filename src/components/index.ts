/**
 * FlipMantis Mobile UI Components
 *
 * Export all reusable components from a single entry point.
 */

// Card
export { Card, CardHeader, CardBody, CardFooter } from './Card'

// Button
export { Button, IconButton } from './Button'

// Input
export { Input, Textarea, SearchInput } from './Input'

// Screen Container
export {
  ScreenContainer,
  ViewContainer,
  CenteredContainer,
} from './ScreenContainer'

// Offline Banner
export { OfflineBanner } from './OfflineBanner'

// Map
export {
  FlipMantisMap,
  type MapPin,
  type RoutePoint,
  type FlipMantisMapRef,
} from './FlipMantisMap'

// Skip Trace
export { SkipTraceButton } from './SkipTraceButton'
export { SkipTraceResults } from './SkipTraceResults'

// Reach Workflow (State Machine UI)
export { ReachWorkflow } from './ReachWorkflow'
export { OutcomeRecorder, type InteractionOutcome } from './OutcomeRecorder'
export { ActivityTimeline } from './ActivityTimeline'
export { AIScoreCard } from './AIScoreCard'

// AI/Investor Features
export { InvestorOnboarding } from './InvestorOnboarding'
export { BuyBoxTemplateSelector } from './BuyBoxTemplateSelector'

// Intelligence Platform (n8n workflow integration)
export { MarketAlertBanner } from './MarketAlertBanner'
export { SellerMotivationCard } from './SellerMotivationCard'
export { PassDealModal } from './PassDealModal'
export { OutcomeLogger } from './OutcomeLogger'

// Address Search
export { AddressAutocomplete, type ParsedAddress } from './AddressAutocomplete'

// Trial/Usage Components
export { TrialLimitModal, type TrialLimitModalProps } from './TrialLimitModal'
export { TrialUsageWarning, type TrialUsageWarningProps } from './TrialUsageWarning'

// Dashboard Widgets
export { GoalTrackingWidget } from './GoalTrackingWidget'
export { WeekCalendarStrip } from './WeekCalendarStrip'
export { PipelineHealthGauge } from './PipelineHealthGauge'
export { QuickWinCard } from './QuickWinCard'

// Leads Components
export { LeadScoreBar } from './LeadScoreBar'

// Pipeline Components
export { StuckDealsAlert, type StuckDeal } from './StuckDealsAlert'
export { DealTimelinePreview } from './DealTimelinePreview'

// Triage Components
export { SwipeTutorial, shouldShowTutorial, resetTutorial } from './SwipeTutorial'

// Analysis Components
export { BatchProgressModal } from './BatchProgressModal'

// Saved Search Components
export { EditSearchModal } from './EditSearchModal'

// Buy Box Components
export { BuyBoxPreview } from './BuyBoxPreview'

// Alerts Components
export { AlertSettingsModal, getAlertSettings, type AlertSettings } from './AlertSettingsModal'
