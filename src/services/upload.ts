/**
 * UploadService
 *
 * Handles media uploads to Supabase Storage with:
 * - Signed URL generation via Edge Function
 * - Image compression before upload
 * - Retry logic with exponential backoff
 * - Offline queue integration
 * - Progress tracking
 */

import * as FileSystem from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '../lib/supabase'
import type {
  UploadUrlRequest,
  UploadUrlResponse,
} from '../types'

// ============================================================================
// Types
// ============================================================================

export interface UploadOptions {
  opportunityId?: string
  evaluationId?: string
  promptKey?: string
  caption?: string
  compress?: boolean
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export interface UploadProgress {
  uploadId: string
  status: 'pending' | 'compressing' | 'uploading' | 'completing' | 'completed' | 'failed'
  progress: number // 0-100
  error?: string
}

export interface UploadResult {
  success: boolean
  mediaId?: string
  uploadId: string
  path?: string
  error?: string
}

export type UploadProgressCallback = (progress: UploadProgress) => void

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const DEFAULT_MAX_WIDTH = 2048
const DEFAULT_MAX_HEIGHT = 2048
const DEFAULT_QUALITY = 0.8

// Edge Function URLs (relative to Supabase URL)
const UPLOAD_URL_ENDPOINT = '/functions/v1/media-upload-url'
const UPLOAD_COMPLETE_ENDPOINT = '/functions/v1/media-upload-complete'

// ============================================================================
// UploadService
// ============================================================================

class UploadService {
  private supabaseUrl: string
  private activeUploads: Map<string, AbortController> = new Map()

  constructor() {
    this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
  }

  /**
   * Upload a local image file to Supabase Storage
   */
  async uploadImage(
    localUri: string,
    options: UploadOptions = {},
    onProgress?: UploadProgressCallback
  ): Promise<UploadResult> {
    const uploadId = this.generateUploadId()
    const abortController = new AbortController()
    this.activeUploads.set(uploadId, abortController)

    try {
      // Step 1: Get file info and determine mime type
      const fileInfo = await FileSystem.getInfoAsync(localUri)
      if (!fileInfo.exists) {
        throw new Error('File not found')
      }

      const mimeType = this.getMimeType(localUri)

      this.reportProgress(onProgress, {
        uploadId,
        status: 'pending',
        progress: 5,
      })

      // Step 2: Compress image if needed
      let processedUri = localUri
      if (options.compress !== false) {
        this.reportProgress(onProgress, {
          uploadId,
          status: 'compressing',
          progress: 10,
        })

        processedUri = await this.compressImage(localUri, {
          maxWidth: options.maxWidth || DEFAULT_MAX_WIDTH,
          maxHeight: options.maxHeight || DEFAULT_MAX_HEIGHT,
          quality: options.quality || DEFAULT_QUALITY,
        })
      }

      // Step 3: Get signed upload URL from Edge Function
      this.reportProgress(onProgress, {
        uploadId,
        status: 'uploading',
        progress: 20,
      })

      const uploadUrlResponse = await this.getSignedUploadUrl({
        opportunityId: options.opportunityId,
        evaluationId: options.evaluationId,
        promptKey: options.promptKey,
        mimeType,
      })

      // Step 4: Upload file to Supabase Storage
      const uploadResult = await this.uploadToStorage(
        processedUri,
        uploadUrlResponse.uploadUrl,
        mimeType,
        (progress) => {
          this.reportProgress(onProgress, {
            uploadId,
            status: 'uploading',
            progress: 20 + Math.round(progress * 60), // 20-80%
          })
        }
      )

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed')
      }

      // Step 5: Get image dimensions
      const dimensions = await this.getImageDimensions(processedUri)

      // Step 6: Call completion endpoint
      this.reportProgress(onProgress, {
        uploadId,
        status: 'completing',
        progress: 85,
      })

      const completeResult = await this.completeUpload({
        uploadId: uploadUrlResponse.uploadId,
        path: uploadUrlResponse.path,
        bucket: uploadUrlResponse.bucket,
        width: dimensions?.width,
        height: dimensions?.height,
        fileSizeBytes: fileInfo.size,
        caption: options.caption,
      })

      if (!completeResult.success) {
        throw new Error(completeResult.error || 'Failed to complete upload')
      }

      // Success!
      this.reportProgress(onProgress, {
        uploadId,
        status: 'completed',
        progress: 100,
      })

      return {
        success: true,
        mediaId: completeResult.mediaId,
        uploadId,
        path: uploadUrlResponse.path,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.reportProgress(onProgress, {
        uploadId,
        status: 'failed',
        progress: 0,
        error: errorMessage,
      })

      return {
        success: false,
        uploadId,
        error: errorMessage,
      }
    } finally {
      this.activeUploads.delete(uploadId)
    }
  }

  /**
   * Upload with automatic retry on failure
   */
  async uploadWithRetry(
    localUri: string,
    options: UploadOptions = {},
    onProgress?: UploadProgressCallback,
    maxRetries: number = MAX_RETRIES
  ): Promise<UploadResult> {
    let lastError: string = ''

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.uploadImage(localUri, options, onProgress)

      if (result.success) {
        return result
      }

      lastError = result.error || 'Unknown error'

      // Don't retry on certain errors
      if (this.isNonRetryableError(lastError)) {
        return result
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await this.delay(RETRY_DELAY_MS * Math.pow(2, attempt))
      }
    }

    return {
      success: false,
      uploadId: this.generateUploadId(),
      error: `Upload failed after ${maxRetries} attempts: ${lastError}`,
    }
  }

  /**
   * Cancel an active upload
   */
  cancelUpload(uploadId: string): boolean {
    const controller = this.activeUploads.get(uploadId)
    if (controller) {
      controller.abort()
      this.activeUploads.delete(uploadId)
      return true
    }
    return false
  }

  /**
   * Get the current auth session token
   */
  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('No active session')
    }
    return session.access_token
  }

  /**
   * Request a signed upload URL from the Edge Function
   */
  private async getSignedUploadUrl(
    request: UploadUrlRequest
  ): Promise<UploadUrlResponse> {
    const token = await this.getAuthToken()

    const response = await fetch(`${this.supabaseUrl}${UPLOAD_URL_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Upload file to Supabase Storage using signed URL
   */
  private async uploadToStorage(
    localUri: string,
    uploadUrl: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      })

      // Convert to blob
      const response = await fetch(`data:${mimeType};base64,${base64}`)
      const blob = await response.blob()

      // Upload to signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`)
      }

      onProgress?.(1)
      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  }

  /**
   * Call the upload completion endpoint
   */
  private async completeUpload(params: {
    uploadId: string
    path: string
    bucket?: string
    width?: number
    height?: number
    fileSizeBytes?: number
    caption?: string
  }): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    const token = await this.getAuthToken()

    const response = await fetch(`${this.supabaseUrl}${UPLOAD_COMPLETE_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      }
    }

    const result = await response.json()
    return {
      success: true,
      mediaId: result.mediaId,
    }
  }

  /**
   * Compress an image using ImageManipulator
   */
  private async compressImage(
    uri: string,
    options: { maxWidth: number; maxHeight: number; quality: number }
  ): Promise<string> {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: options.maxWidth,
            height: options.maxHeight,
          },
        },
      ],
      {
        compress: options.quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    )

    return manipulated.uri
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(
    uri: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      // Use ImageManipulator to get dimensions
      const info = await ImageManipulator.manipulateAsync(uri, [], {})
      return {
        width: info.width,
        height: info.height,
      }
    } catch {
      return null
    }
  }

  /**
   * Determine MIME type from file extension
   */
  private getMimeType(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'heic': 'image/heic',
      'heif': 'image/heif',
    }
    return mimeTypes[extension] || 'image/jpeg'
  }

  /**
   * Generate a unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: string): boolean {
    const nonRetryable = [
      'No active session',
      'Invalid mime type',
      'File not found',
      'User profile not found',
    ]
    return nonRetryable.some((msg) => error.includes(msg))
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    callback: UploadProgressCallback | undefined,
    progress: UploadProgress
  ): void {
    callback?.(progress)
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const uploadService = new UploadService()

// Export class for testing
export { UploadService }
