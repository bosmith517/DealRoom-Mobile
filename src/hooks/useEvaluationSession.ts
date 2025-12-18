/**
 * useEvaluationSession Hook
 *
 * Manages evaluation session state with photo capture and upload integration.
 */

import { useState, useCallback, useEffect } from 'react'
import { useCamera, type CapturedPhoto } from './useCamera'
import { uploadService, type UploadProgress } from '../services/upload'
import { offlineService } from '../services/offline'
import { apiService } from '../services/api'
import { useOffline } from '../contexts/OfflineContext'
import type { PhotoPrompt, ExitStrategy } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface PhotoCapture extends PhotoPrompt {
  localUri?: string
  isUploading?: boolean
  uploadProgress?: number
  uploadError?: string
}

export interface EvaluationSessionState {
  sessionId: string | null
  opportunityId: string
  strategy: ExitStrategy
  status: 'idle' | 'loading' | 'active' | 'completing' | 'completed' | 'error'
  photos: PhotoCapture[]
  error: string | null
}

export interface UseEvaluationSessionResult {
  // State
  state: EvaluationSessionState
  currentPromptIndex: number

  // Photo operations
  capturePhoto: (promptKey: string) => Promise<boolean>
  pickPhoto: (promptKey: string) => Promise<boolean>
  retakePhoto: (promptKey: string) => Promise<boolean>
  deletePhoto: (promptKey: string) => void

  // Session operations
  startSession: () => Promise<boolean>
  completeSession: () => Promise<boolean>
  abandonSession: () => void
  saveProgress: () => void

  // Navigation
  goToPrompt: (index: number) => void
  nextPrompt: () => void
  prevPrompt: () => void

  // Computed
  capturedCount: number
  requiredCount: number
  requiredCapturedCount: number
  isReadyToComplete: boolean
  hasUnsyncedPhotos: boolean

  // Camera
  isCapturing: boolean
}

// ============================================================================
// Default Photo Prompts by Strategy
// ============================================================================

const FLIP_PHOTO_PROMPTS: Omit<PhotoPrompt, 'capturedMediaId' | 'capturedAt'>[] = [
  { key: 'exterior_front', label: 'Exterior - Front', required: true },
  { key: 'exterior_rear', label: 'Exterior - Rear', required: true },
  { key: 'exterior_sides', label: 'Exterior - Sides', required: false },
  { key: 'kitchen_wide', label: 'Kitchen - Wide Shot', required: true },
  { key: 'kitchen_appliances', label: 'Kitchen - Appliances', required: false },
  { key: 'kitchen_cabinets', label: 'Kitchen - Cabinets', required: false },
  { key: 'bathroom_1', label: 'Bathroom 1', required: true },
  { key: 'bathroom_2', label: 'Bathroom 2', required: false },
  { key: 'panel_closeup', label: 'Electrical Panel', required: true },
  { key: 'hvac_unit', label: 'HVAC Unit', required: true },
  { key: 'water_heater', label: 'Water Heater', required: false },
  { key: 'roof_condition', label: 'Roof Condition', required: true },
  { key: 'foundation', label: 'Foundation', required: false },
  { key: 'flooring_samples', label: 'Flooring Samples', required: false },
  { key: 'damage_areas', label: 'Damage Areas', required: false },
]

const BRRRR_PHOTO_PROMPTS: Omit<PhotoPrompt, 'capturedMediaId' | 'capturedAt'>[] = [
  ...FLIP_PHOTO_PROMPTS,
  { key: 'rental_comps_exterior', label: 'Rental Comps - Exterior', required: false },
]

const WHOLESALE_PHOTO_PROMPTS: Omit<PhotoPrompt, 'capturedMediaId' | 'capturedAt'>[] = [
  { key: 'exterior_front', label: 'Exterior - Front', required: true },
  { key: 'exterior_rear', label: 'Exterior - Rear', required: false },
  { key: 'neighborhood_1', label: 'Neighborhood Context 1', required: false },
  { key: 'neighborhood_2', label: 'Neighborhood Context 2', required: false },
  { key: 'street_view', label: 'Street View', required: false },
]

function getPhotoPromptsForStrategy(strategy: ExitStrategy): PhotoCapture[] {
  let prompts: Omit<PhotoPrompt, 'capturedMediaId' | 'capturedAt'>[]

  switch (strategy) {
    case 'flip':
      prompts = FLIP_PHOTO_PROMPTS
      break
    case 'brrrr':
      prompts = BRRRR_PHOTO_PROMPTS
      break
    case 'wholesale':
      prompts = WHOLESALE_PHOTO_PROMPTS
      break
    default:
      prompts = FLIP_PHOTO_PROMPTS
  }

  return prompts.map((p) => ({
    ...p,
    capturedMediaId: null,
    capturedAt: null,
  }))
}

// ============================================================================
// Hook
// ============================================================================

export function useEvaluationSession(
  opportunityId: string,
  strategy: ExitStrategy = 'flip'
): UseEvaluationSessionResult {
  // Initialize state
  const [state, setState] = useState<EvaluationSessionState>({
    sessionId: null,
    opportunityId,
    strategy,
    status: 'idle',
    photos: getPhotoPromptsForStrategy(strategy),
    error: null,
  })

  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)

  // Hooks
  const camera = useCamera({ quality: 0.85 })
  const { isOnline, addToUploadQueue } = useOffline()

  // -------------------------------------------------------------------------
  // Photo Operations
  // -------------------------------------------------------------------------

  const updatePhoto = useCallback(
    (promptKey: string, updates: Partial<PhotoCapture>) => {
      setState((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.key === promptKey ? { ...p, ...updates } : p
        ),
      }))
    },
    []
  )

  const uploadPhoto = useCallback(
    async (promptKey: string, localUri: string) => {
      const { sessionId, opportunityId } = state

      updatePhoto(promptKey, { isUploading: true, uploadProgress: 0 })

      const handleProgress = (progress: UploadProgress) => {
        updatePhoto(promptKey, { uploadProgress: progress.progress })
      }

      if (!isOnline) {
        // Queue for offline upload
        addToUploadQueue({
          id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          localUri,
          localPath: localUri,
          targetPath: '',
          promptKey,
          evaluationId: sessionId || undefined,
          opportunityId,
          mimeType: 'image/jpeg',
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        })

        updatePhoto(promptKey, {
          isUploading: false,
          capturedAt: new Date().toISOString(),
        })
        return true
      }

      try {
        const result = await uploadService.uploadWithRetry(
          localUri,
          {
            opportunityId,
            evaluationId: sessionId || undefined,
            promptKey,
          },
          handleProgress
        )

        if (result.success) {
          updatePhoto(promptKey, {
            isUploading: false,
            uploadProgress: 100,
            capturedMediaId: result.mediaId || null,
            capturedAt: new Date().toISOString(),
            uploadError: undefined,
          })
          return true
        } else {
          updatePhoto(promptKey, {
            isUploading: false,
            uploadError: result.error,
          })
          return false
        }
      } catch (error) {
        updatePhoto(promptKey, {
          isUploading: false,
          uploadError: error instanceof Error ? error.message : 'Upload failed',
        })
        return false
      }
    },
    [state.sessionId, state.opportunityId, isOnline, addToUploadQueue, updatePhoto]
  )

  const capturePhoto = useCallback(
    async (promptKey: string): Promise<boolean> => {
      const photo = await camera.takePhoto()
      if (!photo) return false

      updatePhoto(promptKey, { localUri: photo.uri })

      // Start upload in background
      uploadPhoto(promptKey, photo.uri)

      return true
    },
    [camera, updatePhoto, uploadPhoto]
  )

  const pickPhoto = useCallback(
    async (promptKey: string): Promise<boolean> => {
      const photo = await camera.pickFromLibrary()
      if (!photo) return false

      updatePhoto(promptKey, { localUri: photo.uri })

      // Start upload in background
      uploadPhoto(promptKey, photo.uri)

      return true
    },
    [camera, updatePhoto, uploadPhoto]
  )

  const retakePhoto = useCallback(
    async (promptKey: string): Promise<boolean> => {
      // Clear existing photo
      updatePhoto(promptKey, {
        localUri: undefined,
        capturedMediaId: null,
        capturedAt: null,
        uploadError: undefined,
      })

      // Capture new photo
      return capturePhoto(promptKey)
    },
    [capturePhoto, updatePhoto]
  )

  const deletePhoto = useCallback(
    (promptKey: string) => {
      updatePhoto(promptKey, {
        localUri: undefined,
        capturedMediaId: null,
        capturedAt: null,
        uploadError: undefined,
        isUploading: false,
        uploadProgress: undefined,
      })
    },
    [updatePhoto]
  )

  // -------------------------------------------------------------------------
  // Session Operations
  // -------------------------------------------------------------------------

  const startSession = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))

    try {
      const { data, error } = await apiService.createEvaluation({
        dealId: opportunityId,
        strategy,
      })

      if (error) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message,
        }))
        return false
      }

      if (data) {
        setState((prev) => ({
          ...prev,
          sessionId: data.session.id,
          status: 'active',
          photos: data.session.photoPrompts.length > 0
            ? data.session.photoPrompts.map((p) => ({
                ...p,
                localUri: undefined,
                isUploading: false,
              }))
            : prev.photos,
        }))
        return true
      }

      return false
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to start session',
      }))
      return false
    }
  }, [opportunityId, strategy])

  const completeSession = useCallback(async (): Promise<boolean> => {
    if (!state.sessionId) return false

    setState((prev) => ({ ...prev, status: 'completing' }))

    try {
      const { error } = await apiService.updateEvaluation(state.sessionId, {
        status: 'completed',
      })

      if (error) {
        setState((prev) => ({
          ...prev,
          status: 'active',
          error: error.message,
        }))
        return false
      }

      setState((prev) => ({ ...prev, status: 'completed' }))

      // Clear draft from offline storage
      offlineService.deleteEvaluationDraft(state.sessionId!)

      return true
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'active',
        error: err instanceof Error ? err.message : 'Failed to complete session',
      }))
      return false
    }
  }, [state.sessionId])

  const abandonSession = useCallback(() => {
    if (state.sessionId) {
      // Update status on server (best effort)
      apiService.updateEvaluation(state.sessionId, { status: 'abandoned' })
    }

    setState((prev) => ({ ...prev, status: 'idle', sessionId: null }))
  }, [state.sessionId])

  const saveProgress = useCallback(() => {
    if (!state.sessionId) return

    offlineService.setEvaluationDraft(state.sessionId, {
      photos: state.photos,
      currentPromptIndex,
    })
  }, [state.sessionId, state.photos, currentPromptIndex])

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const goToPrompt = useCallback((index: number) => {
    setCurrentPromptIndex(Math.max(0, Math.min(index, state.photos.length - 1)))
  }, [state.photos.length])

  const nextPrompt = useCallback(() => {
    setCurrentPromptIndex((prev) =>
      Math.min(prev + 1, state.photos.length - 1)
    )
  }, [state.photos.length])

  const prevPrompt = useCallback(() => {
    setCurrentPromptIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const capturedCount = state.photos.filter(
    (p) => p.capturedAt !== null || p.localUri
  ).length

  const requiredCount = state.photos.filter((p) => p.required).length

  const requiredCapturedCount = state.photos.filter(
    (p) => p.required && (p.capturedAt !== null || p.localUri)
  ).length

  const isReadyToComplete = requiredCapturedCount >= requiredCount

  const hasUnsyncedPhotos = state.photos.some(
    (p) => p.localUri && !p.capturedMediaId
  )

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Auto-save progress periodically
  useEffect(() => {
    if (state.status === 'active') {
      const interval = setInterval(saveProgress, 30000) // Every 30 seconds
      return () => clearInterval(interval)
    }
  }, [state.status, saveProgress])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    state,
    currentPromptIndex,

    // Photo operations
    capturePhoto,
    pickPhoto,
    retakePhoto,
    deletePhoto,

    // Session operations
    startSession,
    completeSession,
    abandonSession,
    saveProgress,

    // Navigation
    goToPrompt,
    nextPrompt,
    prevPrompt,

    // Computed
    capturedCount,
    requiredCount,
    requiredCapturedCount,
    isReadyToComplete,
    hasUnsyncedPhotos,

    // Camera
    isCapturing: camera.isLoading,
  }
}
