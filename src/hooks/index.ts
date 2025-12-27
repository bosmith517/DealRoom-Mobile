/**
 * Hooks Index
 *
 * Re-exports all custom hooks.
 */

export {
  useCamera,
  type CapturedPhoto,
  type UseCameraResult,
  type CameraOptions,
} from './useCamera'

export {
  useEvaluationSession,
  type PhotoCapture,
  type EvaluationSessionState,
  type UseEvaluationSessionResult,
} from './useEvaluationSession'

export {
  useLocation,
  calculateDistance,
  metersPerSecondToMph,
  type LocationCoords,
} from './useLocation'

export {
  useDrivingSession,
  type DriveSession,
  type DrivePoint,
  type QuickLead,
} from './useDrivingSession'

export {
  useVoiceNote,
  formatDuration,
  type VoiceRecording,
  type UseVoiceNoteResult,
} from './useVoiceNote'

export {
  useFeatureGate,
  FeatureGate,
} from './useFeatureGate'
