/**
 * useLocation Hook
 *
 * GPS location tracking with permissions handling.
 * Supports foreground and background location modes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import * as Location from 'expo-location'
import { Alert, Linking, Platform } from 'react-native'

export interface LocationCoords {
  lat: number
  lng: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: number
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean
  distanceInterval?: number // meters between updates
  timeInterval?: number // ms between updates
  enableBackground?: boolean
}

interface UseLocationReturn {
  // Current location
  location: LocationCoords | null
  error: string | null
  isLoading: boolean

  // Permission status
  hasPermission: boolean
  hasBackgroundPermission: boolean

  // Actions
  requestPermission: () => Promise<boolean>
  requestBackgroundPermission: () => Promise<boolean>
  getCurrentLocation: () => Promise<LocationCoords | null>
  startTracking: () => Promise<LocationCoords | null> // Returns initial location
  stopTracking: () => void

  // Tracking state
  isTracking: boolean
}

const DEFAULT_OPTIONS: UseLocationOptions = {
  enableHighAccuracy: true,
  distanceInterval: 10, // 10 meters
  timeInterval: 3000, // 3 seconds
  enableBackground: false,
}

export function useLocation(options: UseLocationOptions = {}): UseLocationReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [location, setLocation] = useState<LocationCoords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  const watchSubscription = useRef<Location.LocationSubscription | null>(null)

  // Check permissions on mount
  useEffect(() => {
    checkPermissions()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove()
      }
    }
  }, [])

  // Check current permission status
  const checkPermissions = useCallback(async () => {
    try {
      const { status: foreground } = await Location.getForegroundPermissionsAsync()
      setHasPermission(foreground === 'granted')

      if (foreground === 'granted') {
        const { status: background } = await Location.getBackgroundPermissionsAsync()
        setHasBackgroundPermission(background === 'granted')
      }
    } catch (err) {
      console.error('Error checking location permissions:', err)
    }
  }, [])

  // Request foreground permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status === 'granted') {
        setHasPermission(true)
        setError(null)
        return true
      }

      if (status === 'denied') {
        setError('Location permission denied')
        Alert.alert(
          'Location Required',
          'FlipMantis needs location access to track your driving route and tag properties. Please enable location in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        )
      }

      return false
    } catch (err) {
      console.error('Error requesting location permission:', err)
      setError('Failed to request permission')
      return false
    }
  }, [])

  // Request background permission
  const requestBackgroundPermission = useCallback(async (): Promise<boolean> => {
    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) return false
    }

    try {
      const { status } = await Location.requestBackgroundPermissionsAsync()

      if (status === 'granted') {
        setHasBackgroundPermission(true)
        return true
      }

      if (status === 'denied') {
        Alert.alert(
          'Background Location',
          'To track your route while the app is minimized, please enable "Always" location access in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        )
      }

      return false
    } catch (err) {
      console.error('Error requesting background permission:', err)
      return false
    }
  }, [hasPermission, requestPermission])

  // Get current location once
  const getCurrentLocation = useCallback(async (): Promise<LocationCoords | null> => {
    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy: opts.enableHighAccuracy
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
      })

      const coords: LocationCoords = {
        lat: result.coords.latitude,
        lng: result.coords.longitude,
        accuracy: result.coords.accuracy,
        altitude: result.coords.altitude,
        heading: result.coords.heading,
        speed: result.coords.speed,
        timestamp: result.timestamp,
      }

      setLocation(coords)
      return coords
    } catch (err: any) {
      console.error('Error getting location:', err)
      setError(err.message || 'Failed to get location')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [hasPermission, requestPermission, opts.enableHighAccuracy])

  // Start continuous tracking
  const startTracking = useCallback(async (): Promise<LocationCoords | null> => {
    if (isTracking) return location // Return current location if already tracking

    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) return null
    }

    // Request background permission if needed
    if (opts.enableBackground && !hasBackgroundPermission) {
      await requestBackgroundPermission()
    }

    let initialCoords: LocationCoords | null = null

    try {
      setIsTracking(true)
      setError(null)

      // PROGRESSIVE ACCURACY: Instant response (< 3s total blocking) -> High accuracy upgrade
      // Phase 1: Get LAST KNOWN position IMMEDIATELY (sub-second response)
      // Using maxAge and requiredAccuracy for explicit control
      try {
        console.log('[Location] Phase 1: Getting last known position...')
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 60000, // Accept positions up to 1 minute old
          requiredAccuracy: 100, // Accept up to 100m accuracy
        })
        if (lastKnown) {
          const ageSeconds = (Date.now() - lastKnown.timestamp) / 1000
          initialCoords = {
            lat: lastKnown.coords.latitude,
            lng: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
            altitude: lastKnown.coords.altitude,
            heading: lastKnown.coords.heading,
            speed: lastKnown.coords.speed,
            timestamp: lastKnown.timestamp,
          }
          setLocation(initialCoords)
          console.log('[Location] Phase 1 SUCCESS: Cached position:', initialCoords.lat.toFixed(5), initialCoords.lng.toFixed(5), 'accuracy:', initialCoords.accuracy, 'm, age:', Math.round(ageSeconds), 's')
        } else {
          console.log('[Location] Phase 1: No cached position available')
        }
      } catch (lastKnownErr) {
        console.log('[Location] Phase 1 skipped: No cached position')
      }

      // Phase 2: Get BALANCED accuracy (3s timeout) - fast fresh GPS
      try {
        console.log('[Location] Phase 2: Fetching balanced position (3s timeout)...')

        const balancedTimeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Balanced position timeout')), 3000)
        )

        const balancedPositionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })

        const balancedResult = await Promise.race([balancedPositionPromise, balancedTimeoutPromise]) as Location.LocationObject

        if (balancedResult) {
          const balancedCoords: LocationCoords = {
            lat: balancedResult.coords.latitude,
            lng: balancedResult.coords.longitude,
            accuracy: balancedResult.coords.accuracy,
            altitude: balancedResult.coords.altitude,
            heading: balancedResult.coords.heading,
            speed: balancedResult.coords.speed,
            timestamp: balancedResult.timestamp,
          }
          // Only update if better accuracy than cached
          if (!initialCoords || (balancedCoords.accuracy !== null && (initialCoords.accuracy === null || balancedCoords.accuracy < initialCoords.accuracy))) {
            initialCoords = balancedCoords
            setLocation(initialCoords)
            console.log('[Location] Phase 2 SUCCESS: Balanced position:', initialCoords.lat.toFixed(5), initialCoords.lng.toFixed(5), 'accuracy:', initialCoords.accuracy, 'm')
          } else {
            console.log('[Location] Phase 2: Balanced position not better than cached')
          }
        }
      } catch (balancedErr: any) {
        console.log('[Location] Phase 2 timeout/error:', balancedErr.message, '- continuing with cached position')
      }

      // Phase 3: Try to upgrade to HIGH accuracy in background (non-blocking)
      if (opts.enableHighAccuracy) {
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).then((highAccuracyResult) => {
          // Only update if high accuracy is actually better
          if (highAccuracyResult.coords.accuracy !== null &&
              (initialCoords === null || initialCoords?.accuracy === null || highAccuracyResult.coords.accuracy < initialCoords.accuracy)) {
            const highCoords: LocationCoords = {
              lat: highAccuracyResult.coords.latitude,
              lng: highAccuracyResult.coords.longitude,
              accuracy: highAccuracyResult.coords.accuracy,
              altitude: highAccuracyResult.coords.altitude,
              heading: highAccuracyResult.coords.heading,
              speed: highAccuracyResult.coords.speed,
              timestamp: highAccuracyResult.timestamp,
            }
            setLocation(highCoords)
            console.log('[Location] Upgraded to high accuracy:', highCoords.accuracy, 'm')
          }
        }).catch((err) => {
          console.log('[Location] High accuracy upgrade skipped:', err.message)
        })
      }

      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: opts.enableHighAccuracy
            ? Location.Accuracy.High
            : Location.Accuracy.Balanced,
          distanceInterval: opts.distanceInterval,
          timeInterval: opts.timeInterval,
        },
        (result) => {
          const coords: LocationCoords = {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
            altitude: result.coords.altitude,
            heading: result.coords.heading,
            speed: result.coords.speed,
            timestamp: result.timestamp,
          }
          setLocation(coords)
        }
      )

      return initialCoords
    } catch (err: any) {
      console.error('Error starting location tracking:', err)
      setError(err.message || 'Failed to start tracking')
      setIsTracking(false)
      return null
    }
  }, [
    isTracking,
    location,
    hasPermission,
    hasBackgroundPermission,
    requestPermission,
    requestBackgroundPermission,
    opts,
  ])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchSubscription.current) {
      watchSubscription.current.remove()
      watchSubscription.current = null
    }
    setIsTracking(false)
  }, [])

  return {
    location,
    error,
    isLoading,
    hasPermission,
    hasBackgroundPermission,
    requestPermission,
    requestBackgroundPermission,
    getCurrentLocation,
    startTracking,
    stopTracking,
    isTracking,
  }
}

// Convert m/s to mph
export function metersPerSecondToMph(mps: number | null): number | null {
  if (mps === null) return null
  return mps * 2.237
}

// Calculate distance between two points (Haversine)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in miles
}

export default useLocation
