/**
 * useCamera Hook
 *
 * Camera permission handling and photo capture for evaluations.
 * Uses expo-image-picker for all camera functionality.
 */

import { useState, useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Linking } from 'react-native'

// ============================================================================
// Types
// ============================================================================

export interface CapturedPhoto {
  uri: string
  width: number
  height: number
  base64?: string
}

export interface UseCameraResult {
  hasPermission: boolean | null
  isLoading: boolean
  requestPermission: () => Promise<boolean>
  takePhoto: () => Promise<CapturedPhoto | null>
  pickFromLibrary: () => Promise<CapturedPhoto | null>
}

export interface CameraOptions {
  quality?: number
  allowsEditing?: boolean
  aspect?: [number, number]
  base64?: boolean
}

// ============================================================================
// Hook
// ============================================================================

export function useCamera(options: CameraOptions = {}): UseCameraResult {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    quality = 0.8,
    allowsEditing = false,
    aspect = [4, 3],
    base64 = false,
  } = options

  /**
   * Request camera permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)

    try {
      // Request camera permission using ImagePicker
      const cameraResult = await ImagePicker.requestCameraPermissionsAsync()

      if (cameraResult.status === 'granted') {
        setHasPermission(true)
        return true
      }

      // Permission denied
      if (cameraResult.canAskAgain === false) {
        // Can't ask again, prompt to open settings
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        )
      }

      setHasPermission(false)
      return false

    } catch (error) {
      console.error('Camera permission error:', error)
      setHasPermission(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Take a photo with the camera
   */
  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    // Check permission first
    if (hasPermission === null) {
      const granted = await requestPermission()
      if (!granted) return null
    } else if (hasPermission === false) {
      await requestPermission()
      return null
    }

    setIsLoading(true)

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality,
        allowsEditing,
        aspect,
        base64,
        exif: true,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null
      }

      const asset = result.assets[0]

      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        base64: asset.base64 ?? undefined,
      }

    } catch (error) {
      console.error('Take photo error:', error)
      Alert.alert('Error', 'Failed to take photo. Please try again.')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [hasPermission, requestPermission, quality, allowsEditing, aspect, base64])

  /**
   * Pick a photo from the library
   */
  const pickFromLibrary = useCallback(async (): Promise<CapturedPhoto | null> => {
    setIsLoading(true)

    try {
      // Request media library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable photo library access to select photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        )
        return null
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality,
        allowsEditing,
        aspect,
        base64,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null
      }

      const asset = result.assets[0]

      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        base64: asset.base64 ?? undefined,
      }

    } catch (error) {
      console.error('Pick from library error:', error)
      Alert.alert('Error', 'Failed to select photo. Please try again.')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [quality, allowsEditing, aspect, base64])

  return {
    hasPermission,
    isLoading,
    requestPermission,
    takePhoto,
    pickFromLibrary,
  }
}
