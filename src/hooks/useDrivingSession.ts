/**
 * useDrivingSession Hook
 *
 * Manages driving for dollars sessions:
 * - Start/end sessions
 * - Track GPS points with batching (30m OR 5s threshold)
 * - Add leads with quick capture
 * - Calculate distance and stats
 * - Offline support with AsyncStorage queue
 *
 * Volume Control:
 * - Client-side: 30m minimum distance OR 5s minimum time between points
 * - Batch upload: 50 points at a time
 * - Server-side: deduplication + 10k point limit per session
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Alert } from 'react-native'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system'
import { decode as base64Decode } from 'base-64'
import { supabase } from '../lib/supabase'
import { useLocation, calculateDistance, type LocationCoords } from './useLocation'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Distress tag scoring weights
const DISTRESS_TAG_SCORES: Record<string, number> = {
  vacant: 25,
  boarded: 30,
  overgrown: 15,
  mail_pileup: 20,
  code_violation: 25,
  fire_damage: 35,
  abandoned: 30,
  damaged: 20,
  condemned: 40,
  for_sale: 10,
  estate_sale: 15,
  probate: 20,
  tax_delinquent: 25,
  pre_foreclosure: 30,
  bank_owned: 15,
}

// Tags that count as distress signals
const DISTRESS_TAGS = new Set([
  'vacant', 'boarded', 'overgrown', 'mail_pileup', 'code_violation',
  'fire_damage', 'abandoned', 'damaged', 'condemned', 'tax_delinquent',
  'pre_foreclosure', 'probate', 'estate_sale',
])

// Calculate quick score based on tags
function calculateQuickScore(tags: string[]): number {
  const score = tags.reduce((sum, tag) => sum + (DISTRESS_TAG_SCORES[tag] || 5), 0)
  return Math.min(100, score)
}

// Extract distress signals from tags
function extractDistressSignals(tags: string[]): string[] {
  return tags.filter(tag => DISTRESS_TAGS.has(tag))
}

// Reverse geocode coordinates to address
async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (results && results.length > 0) {
      const loc = results[0]
      // Build street address from components
      const streetNumber = loc.streetNumber || ''
      const street = loc.street || ''
      const address = streetNumber && street
        ? `${streetNumber} ${street}`.trim()
        : street || loc.name || null

      return {
        address,
        city: loc.city || loc.subregion || null,
        state: loc.region || null,
        zip: loc.postalCode || null,
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] Error:', err)
  }
  return { address: null, city: null, state: null, zip: null }
}

// Reverse geocode with retry and fallback
async function reverseGeocodeWithRetry(lat: number, lng: number, retries = 3): Promise<{
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  isCoordinateFallback?: boolean
}> {
  for (let i = 0; i < retries; i++) {
    const result = await reverseGeocode(lat, lng)
    if (result.address && result.address.length >= 5) {
      return result
    }
    // Wait before retry (exponential backoff)
    if (i < retries - 1) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
  // Fallback: format coordinates as address
  console.warn('[ReverseGeocode] All retries failed, using coordinate fallback')
  return {
    address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    city: null,
    state: null,
    zip: null,
    isCoordinateFallback: true,
  }
}

// Convert base64 string to Uint8Array using the base-64 library
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = base64Decode(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Upload photo to Supabase storage and return the storage path
async function uploadLeadPhoto(
  photoUri: string,
  tenantId: string,
  leadId: string
): Promise<string | null> {
  try {
    console.log('[DrivingSession] Uploading photo:', photoUri)

    // Generate unique filename
    const timestamp = Date.now()
    const ext = photoUri.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${leadId}_${timestamp}.${ext}`
    const storagePath = `leads/${tenantId}/${fileName}`

    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Convert base64 to Uint8Array and upload
    const bytes = base64ToUint8Array(base64Data)
    const { data, error } = await supabase.storage
      .from('flipmantis-media')
      .upload(storagePath, bytes, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: false,
      })

    if (error) {
      console.error('[DrivingSession] Photo upload error:', error.message)
      return null
    }

    console.log('[DrivingSession] Photo uploaded:', data.path)
    return data.path
  } catch (err) {
    console.error('[DrivingSession] Photo upload failed:', err)
    return null
  }
}

// Types
export interface DriveSession {
  id: string
  tenantId: string
  userId: string
  startedAt: string
  endedAt: string | null
  startLat: number | null
  startLng: number | null
  endLat: number | null
  endLng: number | null
  distanceMiles: number
  leadCount: number
  durationMinutes: number | null
  pointCount: number
  status: 'active' | 'paused' | 'completed' | 'abandoned'
}

export interface DrivePoint {
  id?: string
  sessionId: string
  lat: number
  lng: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speedMph: number | null
  capturedAt: string
  sequenceNum: number
}

export interface QuickLead {
  id?: string
  lat: number
  lng: number
  address?: string
  city?: string
  state?: string
  zip?: string
  tags: string[]
  notes?: string
  priority?: 'low' | 'normal' | 'high' | 'hot'
  photoUri?: string
  voiceUri?: string
}

// Result returned from addLead with geocoded address info
export interface AddLeadResult {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  isCoordinateFallback: boolean
}

interface UseDrivingSessionReturn {
  // Session state
  session: DriveSession | null
  isActive: boolean
  isPaused: boolean

  // Route data
  routePoints: DrivePoint[]
  distanceMiles: number
  durationMinutes: number
  pointCount: number

  // Leads captured this session
  leadsCount: number

  // Current location (from useLocation)
  currentLocation: LocationCoords | null
  isTracking: boolean
  locationError: string | null

  // Actions
  startSession: () => Promise<boolean>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  endSession: () => Promise<DriveSession | null>
  abandonSession: () => Promise<void>

  // Lead capture
  addLead: (lead: QuickLead) => Promise<AddLeadResult | null>
  addPhotoToLead: (leadId: string, photoUri: string) => Promise<boolean>
  updateLeadNotes: (leadId: string, notes: string, tags?: string[]) => Promise<boolean>

  // Helpers
  hasLocationPermission: boolean
  requestLocationPermission: () => Promise<boolean>
}

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_SESSION: '@flipmantis:driving:activeSession',
  ROUTE_POINTS: '@flipmantis:driving:routePoints',
  PENDING_BATCH: '@flipmantis:driving:pendingBatch',
}

// Constants for throttling
const MIN_DISTANCE_METERS = 30 // 30m minimum between points
const MIN_TIME_SECONDS = 5 // 5s minimum between points
const BATCH_SIZE = 50 // Upload 50 points at a time
const UPLOAD_INTERVAL_MS = 30000 // Try upload every 30s

export function useDrivingSession(): UseDrivingSessionReturn {
  const [session, setSession] = useState<DriveSession | null>(null)
  const [routePoints, setRoutePoints] = useState<DrivePoint[]>([])
  const [pendingBatch, setPendingBatch] = useState<DrivePoint[]>([])
  const [leadsCount, setLeadsCount] = useState(0)
  const [distanceMiles, setDistanceMiles] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [pointCount, setPointCount] = useState(0)

  const sequenceRef = useRef(0)
  const lastPointRef = useRef<{ lat: number; lng: number; time: number } | null>(null)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Use location hook with driving-optimized settings
  const {
    location: currentLocation,
    isTracking,
    error: locationError,
    hasPermission: hasLocationPermission,
    requestPermission: requestLocationPermission,
    startTracking,
    stopTracking,
  } = useLocation({
    enableHighAccuracy: true,
    distanceInterval: 10, // Get updates every 10m (we'll filter further)
    timeInterval: 3000, // Get updates every 3s (we'll filter further)
    enableBackground: true,
  })

  // Check if point passes throttle threshold
  const shouldCapturePoint = useCallback((coords: LocationCoords): boolean => {
    const now = Date.now()

    if (!lastPointRef.current) {
      return true
    }

    const distanceM = calculateDistance(
      lastPointRef.current.lat,
      lastPointRef.current.lng,
      coords.lat,
      coords.lng
    ) * 1609.34 // miles to meters

    const timeDiffS = (now - lastPointRef.current.time) / 1000

    // Capture if EITHER distance OR time threshold is met
    return distanceM >= MIN_DISTANCE_METERS || timeDiffS >= MIN_TIME_SECONDS
  }, [])

  // Update route when location changes during active session
  useEffect(() => {
    if (!session || session.status !== 'active' || !currentLocation) return

    // Apply throttling
    if (!shouldCapturePoint(currentLocation)) return

    const newPoint: DrivePoint = {
      sessionId: session.id,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      accuracy: currentLocation.accuracy,
      altitude: currentLocation.altitude,
      heading: currentLocation.heading,
      speedMph: currentLocation.speed ? currentLocation.speed * 2.237 : null,
      capturedAt: new Date(currentLocation.timestamp).toISOString(),
      sequenceNum: sequenceRef.current++,
    }

    // Calculate incremental distance BEFORE updating refs
    // This gives us the accurate distance from last point to new point
    if (lastPointRef.current) {
      const segmentDistance = calculateDistance(
        lastPointRef.current.lat,
        lastPointRef.current.lng,
        currentLocation.lat,
        currentLocation.lng
      )
      // Update distance incrementally - much more efficient and reliable
      setDistanceMiles((prevDistance) => {
        const newTotal = prevDistance + segmentDistance
        console.log('[Driving] Distance updated:', prevDistance.toFixed(3), '+', segmentDistance.toFixed(3), '=', newTotal.toFixed(3), 'miles')
        return newTotal
      })
    }

    // Update last point reference AFTER calculating distance
    lastPointRef.current = {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      time: Date.now(),
    }

    // Add the new point to route and save to storage
    setRoutePoints((prev) => {
      const updated = [...prev, newPoint]
      // Save route points to storage for session recovery
      AsyncStorage.setItem(STORAGE_KEYS.ROUTE_POINTS, JSON.stringify(updated)).catch(console.warn)
      return updated
    })

    setPointCount((prev) => prev + 1)

    // Add to pending batch
    setPendingBatch((prev) => {
      const updated = [...prev, newPoint]

      // Save to storage (fire and forget)
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_BATCH, JSON.stringify(updated)).catch(console.warn)

      return updated
    })

    console.log('[Driving] Point captured:', currentLocation.lat.toFixed(5), currentLocation.lng.toFixed(5), '| Points:', sequenceRef.current)
  }, [currentLocation, session, shouldCapturePoint])

  // Batch upload function
  const uploadPendingBatch = useCallback(async () => {
    if (pendingBatch.length === 0 || !session) return

    const pointsToUpload = pendingBatch.slice(0, BATCH_SIZE)

    try {
      // Use batch insert RPC for deduplication
      const { data, error } = await supabase.rpc('batch_insert_drive_points', {
        p_session_id: session.id,
        p_points: pointsToUpload.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          accuracy_m: p.accuracy,
          altitude_m: p.altitude,
          heading: p.heading,
          speed_mph: p.speedMph,
          captured_at: p.capturedAt,
          sequence_num: p.sequenceNum,
        })),
      })

      if (error) {
        console.warn('Batch upload error:', error)
        return
      }

      // Remove uploaded points from pending
      setPendingBatch((prev) => {
        const remaining = prev.slice(BATCH_SIZE)
        AsyncStorage.setItem(STORAGE_KEYS.PENDING_BATCH, JSON.stringify(remaining)).catch(console.warn)
        return remaining
      })

      console.log(`Uploaded ${data} points`)
    } catch (err) {
      console.warn('Failed to upload batch:', err)
    }
  }, [pendingBatch, session])

  // Periodic upload interval
  useEffect(() => {
    if (session?.status === 'active') {
      uploadIntervalRef.current = setInterval(uploadPendingBatch, UPLOAD_INTERVAL_MS)
    }

    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
      }
    }
  }, [session?.status, uploadPendingBatch])

  // Update duration while active
  useEffect(() => {
    if (session?.status === 'active' && startTime) {
      // Calculate immediately on start/restore
      const updateDuration = () => {
        const mins = Math.floor((Date.now() - startTime.getTime()) / 60000)
        setDurationMinutes(mins)
      }

      updateDuration() // Run immediately

      // Then update every 10 seconds for more responsive display
      durationIntervalRef.current = setInterval(updateDuration, 10000)
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [session?.status, startTime])

  // Restore session on mount
  useEffect(() => {
    restoreSession()
  }, [])

  // Restore active session from storage
  const restoreSession = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)
      if (saved) {
        const restored: DriveSession = JSON.parse(saved)
        if (restored.status === 'active' || restored.status === 'paused') {
          setSession(restored)
          setStartTime(new Date(restored.startedAt))
          setLeadsCount(restored.leadCount)
          setPointCount(restored.pointCount || 0)

          // Restore pending batch
          const batchStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_BATCH)
          if (batchStr) {
            const batch = JSON.parse(batchStr)
            setPendingBatch(batch)
          }

          // Restore route points (for display)
          const pointsStr = await AsyncStorage.getItem(STORAGE_KEYS.ROUTE_POINTS)
          if (pointsStr) {
            const points = JSON.parse(pointsStr)
            setRoutePoints(points)
            sequenceRef.current = points.length

            // Set last point for throttling
            if (points.length > 0) {
              const last = points[points.length - 1]
              lastPointRef.current = {
                lat: last.lat,
                lng: last.lng,
                time: new Date(last.capturedAt).getTime(),
              }
            }

            // Recalculate distance
            if (points.length > 1) {
              let totalDist = 0
              for (let i = 1; i < points.length; i++) {
                totalDist += calculateDistance(
                  points[i - 1].lat,
                  points[i - 1].lng,
                  points[i].lat,
                  points[i].lng
                )
              }
              setDistanceMiles(totalDist)
            }
          }

          // Resume tracking if was active
          if (restored.status === 'active') {
            startTracking()
          }
        }
      }
    } catch (err) {
      console.warn('Error restoring drive session:', err)
    }
  }

  // Start new session
  const startSession = useCallback(async (): Promise<boolean> => {
    if (session?.status === 'active') {
      console.warn('Session already active')
      return false
    }

    console.log('[DrivingSession] Starting new session...')

    // Start tracking FIRST to get GPS lock - this returns the initial location
    console.log('[DrivingSession] Starting location tracking...')
    const initialLocation = await startTracking()
    console.log('[DrivingSession] Initial location:', initialLocation ? `${initialLocation.lat}, ${initialLocation.lng}` : 'null (GPS still acquiring)')

    // Use the returned location (avoids stale closure issue)
    const loc = initialLocation

    // Get user/tenant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('No authenticated user')
      return false
    }

    // Get tenant ID
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (!tenantUser) {
      console.error('User not in a tenant')
      return false
    }

    try {
      const now = new Date()

      // Create session in DB
      console.log('[DrivingSession] Creating session in DB...')
      const { data: newSession, error } = await supabase
        .from('dealroom_drive_sessions')
        .insert({
          tenant_id: tenantUser.tenant_id,
          user_id: user.id,
          started_at: now.toISOString(),
          start_lat: loc?.lat,
          start_lng: loc?.lng,
          status: 'active',
          point_count: 0,
        })
        .select()
        .single()

      if (error) {
        console.error('[DrivingSession] Session creation error:', error.message, error.details, error.hint)
        throw error
      }
      console.log('[DrivingSession] Session created with ID:', newSession.id)

      const sessionObj: DriveSession = {
        id: newSession.id,
        tenantId: newSession.tenant_id,
        userId: newSession.user_id,
        startedAt: newSession.started_at,
        endedAt: null,
        startLat: newSession.start_lat,
        startLng: newSession.start_lng,
        endLat: null,
        endLng: null,
        distanceMiles: 0,
        leadCount: 0,
        durationMinutes: null,
        pointCount: 0,
        status: 'active',
      }

      setSession(sessionObj)
      setStartTime(now)
      setDistanceMiles(0)
      setLeadsCount(0)
      sequenceRef.current = 0

      // Initialize first route point if we have a location
      let initialPoints: DrivePoint[] = []
      if (loc) {
        const firstPoint: DrivePoint = {
          sessionId: newSession.id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          altitude: loc.altitude,
          heading: loc.heading,
          speedMph: loc.speed ? loc.speed * 2.237 : null,
          capturedAt: now.toISOString(),
          sequenceNum: sequenceRef.current++,
        }
        initialPoints = [firstPoint]
        // Set last point ref so next point calculates distance correctly
        lastPointRef.current = {
          lat: loc.lat,
          lng: loc.lng,
          time: Date.now(),
        }
        console.log('[DrivingSession] First point captured:', loc.lat, loc.lng)
      } else {
        lastPointRef.current = null
      }

      setRoutePoints(initialPoints)
      setPendingBatch(initialPoints)
      setPointCount(initialPoints.length)

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessionObj))
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTE_POINTS, JSON.stringify(initialPoints))
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_BATCH, JSON.stringify(initialPoints))

      // Note: Tracking already started at beginning of startSession()
      console.log('[DrivingSession] Session started successfully with', initialPoints.length, 'initial points')

      return true
    } catch (err) {
      console.error('Error starting drive session:', err)
      return false
    }
  }, [session, currentLocation, startTracking])

  // Pause session
  const pauseSession = useCallback(async () => {
    if (!session || session.status !== 'active') return

    stopTracking()

    // Upload any pending points before pausing
    await uploadPendingBatch()

    const updated = { ...session, status: 'paused' as const }
    setSession(updated)

    // Update DB
    await supabase
      .from('dealroom_drive_sessions')
      .update({ status: 'paused' })
      .eq('id', session.id)

    // Update storage
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updated))
  }, [session, stopTracking, uploadPendingBatch])

  // Resume session
  const resumeSession = useCallback(async () => {
    if (!session || session.status !== 'paused') return

    await startTracking()

    const updated = { ...session, status: 'active' as const }
    setSession(updated)

    // Update DB
    await supabase
      .from('dealroom_drive_sessions')
      .update({ status: 'active' })
      .eq('id', session.id)

    // Update storage
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updated))
  }, [session, startTracking])

  // End session
  const endSession = useCallback(async (): Promise<DriveSession | null> => {
    if (!session) return null

    stopTracking()

    // Upload any remaining points
    if (pendingBatch.length > 0) {
      await uploadPendingBatch()
    }

    const lastPoint = routePoints[routePoints.length - 1]

    try {
      // Use finalize RPC for server-side stats calculation
      const { data: finalizedSession, error } = await supabase.rpc('finalize_drive_session', {
        p_session_id: session.id,
        p_end_lat: lastPoint?.lat ?? currentLocation?.lat ?? null,
        p_end_lng: lastPoint?.lng ?? currentLocation?.lng ?? null,
      })

      if (error) {
        console.error('Finalize error:', error)
        // Fallback to client-side update
        await supabase
          .from('dealroom_drive_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            end_lat: lastPoint?.lat ?? currentLocation?.lat,
            end_lng: lastPoint?.lng ?? currentLocation?.lng,
            distance_miles: distanceMiles,
            duration_minutes: durationMinutes,
            point_count: pointCount,
          })
          .eq('id', session.id)
      }

      // Clear storage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACTIVE_SESSION,
        STORAGE_KEYS.ROUTE_POINTS,
        STORAGE_KEYS.PENDING_BATCH,
      ])

      const completedSession: DriveSession = {
        ...session,
        status: 'completed',
        endedAt: new Date().toISOString(),
        endLat: lastPoint?.lat ?? currentLocation?.lat ?? null,
        endLng: lastPoint?.lng ?? currentLocation?.lng ?? null,
        distanceMiles: distanceMiles,
        durationMinutes: durationMinutes,
        pointCount: pointCount,
      }

      setSession(null)
      setRoutePoints([])
      setPendingBatch([])
      setDistanceMiles(0)
      setDurationMinutes(0)
      setPointCount(0)
      setLeadsCount(0)
      setStartTime(null)
      lastPointRef.current = null

      return completedSession
    } catch (err) {
      console.error('Error ending session:', err)
      return null
    }
  }, [session, routePoints, distanceMiles, durationMinutes, pointCount, currentLocation, stopTracking, pendingBatch, uploadPendingBatch])

  // Abandon session
  const abandonSession = useCallback(async () => {
    if (!session) return

    stopTracking()

    // Update DB
    await supabase
      .from('dealroom_drive_sessions')
      .update({ status: 'abandoned' })
      .eq('id', session.id)

    // Clear storage
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACTIVE_SESSION,
      STORAGE_KEYS.ROUTE_POINTS,
      STORAGE_KEYS.PENDING_BATCH,
    ])

    setSession(null)
    setRoutePoints([])
    setPendingBatch([])
    setDistanceMiles(0)
    setDurationMinutes(0)
    setPointCount(0)
    setLeadsCount(0)
    setStartTime(null)
    lastPointRef.current = null
  }, [session, stopTracking])

  // Add lead
  const addLead = useCallback(async (lead: QuickLead): Promise<AddLeadResult | null> => {
    if (!session) {
      console.error('No active session to add lead to')
      return null
    }

    try {
      // Get user/tenant
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

      if (!tenantUser) return null

      // Reverse geocode if address not provided (with retry and fallback)
      let addressData: {
        address: string | null
        city: string | null
        state: string | null
        zip: string | null
        isCoordinateFallback?: boolean
      } = {
        address: lead.address || null,
        city: lead.city || null,
        state: lead.state || null,
        zip: lead.zip || null,
        isCoordinateFallback: false,
      }

      if (!lead.address && lead.lat && lead.lng) {
        console.log('[DrivingSession] Reverse geocoding coordinates with retry...')
        const geocoded = await reverseGeocodeWithRetry(lead.lat, lead.lng)
        console.log('[DrivingSession] Geocoded result:', geocoded)
        addressData = geocoded
      }

      // Calculate quick score and distress signals from tags
      const quickScore = calculateQuickScore(lead.tags)
      const distressSignals = extractDistressSignals(lead.tags)

      // Insert lead with triage_status and scoring
      console.log('[DrivingSession] Inserting lead:', {
        tenant_id: tenantUser.tenant_id,
        lat: lead.lat,
        lng: lead.lng,
        address: addressData.address,
        session_id: session.id,
        triage_status: 'new',
        rank_score: quickScore,
        distress_signals: distressSignals,
      })

      const { data: newLead, error } = await supabase
        .from('dealroom_leads')
        .insert({
          tenant_id: tenantUser.tenant_id,
          created_by: user.id,
          source: 'driving',
          drive_session_id: session.id,
          lat: lead.lat,
          lng: lead.lng,
          address_line1: addressData.address,
          city: addressData.city,
          state: addressData.state,
          zip: addressData.zip,
          notes: lead.notes,  // Use 'notes' not 'capture_notes'
          priority: lead.priority || 'normal',
          status: 'new',
          triage_status: 'new',  // CRITICAL: Set triage status so leads appear in queue
          rank_score: quickScore,  // Initial score based on tags
          distress_signals: distressSignals,  // Distress signals from tags
        })
        .select()
        .single()

      if (error) {
        console.error('[DrivingSession] Lead insert error:', error.message, error.details, error.hint)
        throw error
      }

      console.log('[DrivingSession] Lead saved:', newLead.id)

      // Add tags
      if (lead.tags.length > 0) {
        const tagInserts = lead.tags.map((tagKey) => ({
          lead_id: newLead.id,
          tag_key: tagKey,
          tag_label: tagKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        }))

        await supabase.from('dealroom_lead_tags').insert(tagInserts)
      }

      // Upload photo if provided
      if (lead.photoUri) {
        console.log('[DrivingSession] Uploading lead photo...')
        const storagePath = await uploadLeadPhoto(lead.photoUri, tenantUser.tenant_id, newLead.id)
        if (storagePath) {
          // Save media record to database
          const { error: mediaError } = await supabase
            .from('dealroom_lead_media')
            .insert({
              lead_id: newLead.id,
              kind: 'photo',
              storage_path: storagePath,
              local_uri: lead.photoUri,
            })

          if (mediaError) {
            console.warn('[DrivingSession] Failed to save media record:', mediaError.message)
          } else {
            console.log('[DrivingSession] Media record saved')
          }
        }
      }

      // Queue ATTOM enrichment in background (Reach Workflow Phase 4)
      // This transitions: new → intel_pending → intel_ready (on success)
      try {
        console.log('[DrivingSession] Queueing ATTOM enrichment for lead:', newLead.id)
        const { data: jobId, error: enrichError } = await supabase.rpc('request_intel_enrichment', {
          p_lead_id: newLead.id,
          p_source: 'mobile'
        })
        if (enrichError) {
          console.warn('[DrivingSession] Failed to queue ATTOM enrichment:', enrichError.message)
          // Non-fatal - lead is saved, enrichment can be triggered later
        } else {
          console.log('[DrivingSession] ATTOM enrichment job queued:', jobId)
        }
      } catch (enrichErr) {
        console.warn('[DrivingSession] ATTOM enrichment error:', enrichErr)
        // Non-fatal - lead is saved
      }

      // Update local count
      setLeadsCount((prev) => prev + 1)

      // Update session in storage
      const updatedSession = { ...session, leadCount: leadsCount + 1 }
      setSession(updatedSession)
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updatedSession))

      // Return full result with address info for notifications
      return {
        id: newLead.id,
        address: addressData.address,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
        isCoordinateFallback: addressData.isCoordinateFallback || false,
      }
    } catch (err: any) {
      console.error('[DrivingSession] Error adding lead:', err?.message || err)
      // Return error message for better debugging
      return null
    }
  }, [session, leadsCount])

  // Add a photo to an existing lead
  const addPhotoToLead = useCallback(async (leadId: string, photoUri: string): Promise<boolean> => {
    try {
      console.log('[DrivingSession] Adding photo to lead:', leadId)

      // Get user's tenant
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('[DrivingSession] No user for photo upload')
        return false
      }

      const { data: tenantUser, error: tenantError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

      if (tenantError || !tenantUser?.tenant_id) {
        console.error('[DrivingSession] No tenant for photo upload')
        return false
      }

      // Upload photo to storage
      const storagePath = await uploadLeadPhoto(photoUri, tenantUser.tenant_id, leadId)
      if (!storagePath) {
        console.error('[DrivingSession] Photo upload failed')
        return false
      }

      // Save media record to database
      const { error: mediaError } = await supabase
        .from('dealroom_lead_media')
        .insert({
          lead_id: leadId,
          kind: 'photo',
          storage_path: storagePath,
          local_uri: photoUri,
        })

      if (mediaError) {
        console.error('[DrivingSession] Failed to save media record:', mediaError.message)
        return false
      }

      console.log('[DrivingSession] Photo attached to lead successfully')
      return true
    } catch (err: any) {
      console.error('[DrivingSession] Error adding photo to lead:', err?.message || err)
      return false
    }
  }, [])

  // Update notes and tags on an existing lead
  const updateLeadNotes = useCallback(async (leadId: string, notes: string, tags?: string[]): Promise<boolean> => {
    try {
      console.log('[DrivingSession] Updating notes for lead:', leadId)

      // Update the lead's notes
      const { error: updateError } = await supabase
        .from('dealroom_leads')
        .update({ notes })
        .eq('id', leadId)

      if (updateError) {
        console.error('[DrivingSession] Failed to update lead notes:', updateError.message)
        return false
      }

      // If tags provided, update tags as well
      if (tags && tags.length > 0) {
        // First delete existing tags
        await supabase
          .from('dealroom_lead_tags')
          .delete()
          .eq('lead_id', leadId)

        // Insert new tags
        const tagInserts = tags.map((tagKey) => ({
          lead_id: leadId,
          tag_key: tagKey,
          tag_label: tagKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        }))

        const { error: tagError } = await supabase.from('dealroom_lead_tags').insert(tagInserts)
        if (tagError) {
          console.warn('[DrivingSession] Failed to update tags:', tagError.message)
          // Non-fatal - notes were updated
        }
      }

      console.log('[DrivingSession] Lead notes updated successfully')
      return true
    } catch (err: any) {
      console.error('[DrivingSession] Error updating lead notes:', err?.message || err)
      return false
    }
  }, [])

  return {
    session,
    isActive: session?.status === 'active',
    isPaused: session?.status === 'paused',
    routePoints,
    distanceMiles,
    durationMinutes,
    pointCount,
    leadsCount,
    currentLocation,
    isTracking,
    locationError,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    abandonSession,
    addLead,
    addPhotoToLead,
    updateLeadNotes,
    hasLocationPermission,
    requestLocationPermission,
  }
}

export default useDrivingSession
