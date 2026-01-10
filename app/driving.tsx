/**
 * Driving Mode Screen
 *
 * One-hand, car-friendly UX for Driving for Dollars.
 * - Large "Add Lead" button
 * - Route tracking with live map
 * - Quick distress tags
 * - Voice/photo capture
 * - Offline-first
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Vibration,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { FlipMantisMap, Button, Card, OfflineBanner, type MapPin } from '../src/components'

// Dynamic imports for native modules to prevent crashes if they fail to load
let Accelerometer: any = null
let accelerometerAvailable = false
try {
  const sensors = require('expo-sensors')
  Accelerometer = sensors.Accelerometer
  accelerometerAvailable = true
} catch (e) {
  console.warn('[Driving] expo-sensors not available:', e)
}

let Audio: any = null
let audioAvailable = false
try {
  const av = require('expo-av')
  Audio = av.Audio
  audioAvailable = true
} catch (e) {
  console.warn('[Driving] expo-av not available:', e)
}
import { useDrivingSession, useCamera, useVoiceNote, formatDuration as formatVoiceDuration, type QuickLead, type AddLeadResult } from '../src/hooks'
import { colors as staticColors, spacing, typography, radii, shadows } from '../src/theme'
import { useTheme } from '../src/contexts/ThemeContext'

// Distress/opportunity tags for quick capture
const QUICK_TAGS = [
  { key: 'vacant', label: 'Vacant', icon: '🏚️', color: '#ef4444' },
  { key: 'boarded', label: 'Boarded', icon: '🚫', color: '#dc2626' },
  { key: 'overgrown', label: 'Overgrown', icon: '🌿', color: '#16a34a' },
  { key: 'mail_pileup', label: 'Mail Piling', icon: '📬', color: '#eab308' },
  { key: 'for_rent', label: 'For Rent', icon: '🏠', color: '#3b82f6' },
  { key: 'fsbo', label: 'FSBO', icon: '💰', color: '#8b5cf6' },
  { key: 'code_violation', label: 'Code Violation', icon: '⚠️', color: '#f97316' },
  { key: 'good_bones', label: 'Good Bones', icon: '🦴', color: '#22c55e' },
]

// Priority options (colors applied dynamically in component)
const PRIORITY_OPTIONS = [
  { key: 'normal', label: 'Normal', colorKey: 'slate' as const },
  { key: 'high', label: 'High', colorKey: 'warning' as const },
  { key: 'hot', label: 'Hot! 🔥', colorKey: 'error' as const },
]

export default function DrivingModeScreen() {
  const router = useRouter()
  const { colors, isDarkMode } = useTheme()
  const { takePhoto } = useCamera({ quality: 0.7 })

  // Voice note hook
  const {
    isAvailable: voiceAvailable,
    isRecording: isRecordingVoice,
    durationMs: voiceDurationMs,
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
  } = useVoiceNote()

  // Driving session hook
  const {
    session,
    isActive,
    isPaused,
    routePoints,
    distanceMiles,
    durationMinutes,
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
  } = useDrivingSession()

  // Lead capture modal
  const [showAddLead, setShowAddLead] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [isEditingNotes, setIsEditingNotes] = useState(false) // true when editing last lead
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [leadNotes, setLeadNotes] = useState('')
  const [leadPriority, setLeadPriority] = useState<'low' | 'normal' | 'high' | 'hot'>('normal')
  const [leadAddress, setLeadAddress] = useState('')
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null)
  const [capturedVoiceUri, setCapturedVoiceUri] = useState<string | null>(null)
  const [isAddingLead, setIsAddingLead] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Map pins from leads captured this session
  const [leadPins, setLeadPins] = useState<MapPin[]>([])
  const [lastLeadId, setLastLeadId] = useState<string | null>(null)
  const [lastLeadAddress, setLastLeadAddress] = useState<string | null>(null)

  // Shake detection state
  const [shakeEnabled, setShakeEnabled] = useState(true)
  const lastShakeTime = useRef(0)
  const shakeThreshold = 2.5 // Acceleration magnitude threshold for shake
  const shakeCooldown = 2000 // 2 second cooldown between shake saves
  const handleQuickSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Audio feedback
  const successSoundRef = useRef<any>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Request permission on mount if needed
  useEffect(() => {
    if (!hasLocationPermission) {
      requestLocationPermission()
    }
  }, [hasLocationPermission, requestLocationPermission])

  // Audio feedback - play success sound
  const playSuccessSound = useCallback(async () => {
    if (!audioEnabled || !audioAvailable || !Audio) return

    try {
      // Unload previous sound if exists
      if (successSoundRef.current) {
        await successSoundRef.current.unloadAsync()
      }

      // Create and play a simple success tone using the system sound
      const { sound } = await Audio.Sound.createAsync(
        // Use a bundled asset or generate a simple beep
        { uri: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3' },
        { shouldPlay: true, volume: 0.5 }
      )
      successSoundRef.current = sound

      // Unload after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('isLoaded' in status && status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync()
        }
      })
    } catch (error) {
      console.log('[Driving] Audio playback not available:', error)
    }
  }, [audioEnabled])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (successSoundRef.current) {
        successSoundRef.current.unloadAsync()
      }
    }
  }, [])

  // Shake detection for hands-free save
  useEffect(() => {
    if (!isActive || !shakeEnabled || !accelerometerAvailable || !Accelerometer) return

    let subscription: { remove: () => void } | null = null

    const setupShakeDetection = async () => {
      try {
        // Check if accelerometer is available
        const isAvailable = await Accelerometer.isAvailableAsync()
        if (!isAvailable) {
          console.log('[Driving] Accelerometer not available')
          return
        }

        // Set update interval (100ms for responsive shake detection)
        Accelerometer.setUpdateInterval(100)

        // Subscribe to accelerometer updates
        subscription = Accelerometer.addListener((data) => {
          const { x, y, z } = data
          // Calculate total acceleration magnitude (excluding gravity ~1g)
          const magnitude = Math.sqrt(x * x + y * y + z * z)

          // Detect shake (magnitude significantly above 1g)
          if (magnitude > shakeThreshold) {
            const now = Date.now()
            if (now - lastShakeTime.current > shakeCooldown) {
              lastShakeTime.current = now
              console.log('[Driving] Shake detected! Saving lead...')
              // Use ref to get latest handler and avoid stale closure
              handleQuickSaveRef.current()
            }
          }
        })
      } catch (error) {
        console.log('[Driving] Error setting up shake detection:', error)
      }
    }

    setupShakeDetection()

    return () => {
      if (subscription) {
        subscription.remove()
      }
    }
  }, [isActive, shakeEnabled])

  // Handle start session
  const handleStartSession = async () => {
    if (!hasLocationPermission) {
      const granted = await requestLocationPermission()
      if (!granted) {
        Alert.alert('Location Required', 'Enable location to track your driving route.')
        return
      }
    }

    setIsStartingSession(true)
    try {
      const success = await startSession()
      if (success) {
        Vibration.vibrate(100)
      } else {
        Alert.alert('Failed to Start', 'Could not start driving session. Please try again.')
      }
    } catch (error) {
      console.error('Error starting session:', error)
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setIsStartingSession(false)
    }
  }

  // Handle end session
  const handleEndSession = async () => {
    Alert.alert(
      'End Session?',
      `You captured ${leadsCount} leads over ${distanceMiles.toFixed(1)} miles.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          onPress: async () => {
            const completed = await endSession()
            if (completed) {
              Alert.alert(
                'Session Complete! 🎉',
                `${completed.leadCount} leads • ${completed.distanceMiles?.toFixed(1) || 0} miles • ${completed.durationMinutes || 0} minutes`,
                [{ text: 'OK', onPress: () => router.back() }]
              )
            }
          },
        },
      ]
    )
  }

  // Handle abandon session
  const handleAbandonSession = () => {
    Alert.alert(
      'Abandon Session?',
      'Route data and any unsaved leads will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            await abandonSession()
            router.back()
          },
        },
      ]
    )
  }

  // Toggle tag selection
  const toggleTag = (key: string) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    )
  }

  // Capture photo - automatically saves a new lead with the photo attached
  // This is equivalent to TAP TO SAVE but includes the photo
  const handleCapturePhoto = async () => {
    if (!session) {
      Vibration.vibrate([0, 100, 50, 100])
      Alert.alert('No Active Session', 'Please start a driving session first.')
      return
    }

    const photo = await takePhoto()
    if (photo) {
      // Immediate vibration feedback
      Vibration.vibrate([0, 50, 30, 50])
      setCapturedPhotoUri(photo.uri)

      // Get FRESH GPS coordinates directly from expo-location
      let lat: number
      let lng: number

      try {
        console.log('[Driving Photo] Fetching fresh GPS coordinates...')
        const freshLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        lat = freshLocation.coords.latitude
        lng = freshLocation.coords.longitude
        console.log('[Driving Photo] Fresh GPS:', lat, lng)
      } catch (gpsError) {
        console.warn('[Driving Photo] Fresh GPS failed, using fallbacks...', gpsError)
        try {
          const lastKnown = await Location.getLastKnownPositionAsync()
          if (lastKnown) {
            lat = lastKnown.coords.latitude
            lng = lastKnown.coords.longitude
          } else if (currentLocation) {
            lat = currentLocation.lat
            lng = currentLocation.lng
          } else {
            Vibration.vibrate([0, 100, 50, 100])
            Alert.alert('GPS Error', 'Could not get your location. Please wait for GPS signal.')
            return
          }
        } catch (fallbackError) {
          if (currentLocation) {
            lat = currentLocation.lat
            lng = currentLocation.lng
          } else {
            Vibration.vibrate([0, 100, 50, 100])
            Alert.alert('GPS Error', 'Could not get your location. Please wait for GPS signal.')
            return
          }
        }
      }

      // Save lead with photo attached
      const quickLead: QuickLead = {
        lat,
        lng,
        tags: ['to_analyze'],
        priority: 'normal',
        photoUri: photo.uri,
      }

      console.log('[Driving Photo] Saving lead with photo at:', lat, lng)

      const result = await addLead(quickLead)

      if (result) {
        console.log('[Driving Photo] Lead saved with ID:', result.id)
        setLastLeadId(result.id)
        // Store the address for the notes modal
        const locationDisplay = result.address && !result.isCoordinateFallback
          ? result.address + (result.city ? `, ${result.city}` : '')
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        setLastLeadAddress(locationDisplay)

        // Add pin to map
        setLeadPins((prev) => [
          ...prev,
          {
            id: result.id,
            lat,
            lng,
            type: 'lead',
            label: result.address && !result.isCoordinateFallback ? result.address : `📷 ${leadsCount + 1}`,
          },
        ])

        // Audio feedback
        playSuccessSound()
        // Success feedback with address
        Alert.alert('📷 Photo Lead Saved', `Lead ${leadsCount + 1} saved with photo at ${locationDisplay}`)
      } else {
        console.error('[Driving Photo] Failed to save lead')
        Alert.alert('Save Failed', 'Could not save lead with photo. Please try again.')
      }
    }
  }

  // Quick save - one tap, no form
  // IMPORTANT: Get FRESH GPS coordinates directly from expo-location at save time
  // This fixes the bug where all leads got the same stale coordinates from React state
  const handleQuickSave = async () => {
    if (!session) {
      Vibration.vibrate([0, 100, 50, 100])
      Alert.alert('No Active Session', 'Please start a driving session first.')
      return
    }

    // Immediate vibration feedback
    Vibration.vibrate([0, 50, 30, 50]) // Success pattern

    // Get FRESH GPS coordinates directly from expo-location
    // Don't rely on currentLocation state - it may be stale due to React closure issues
    let lat: number
    let lng: number

    try {
      console.log('[Driving] Fetching fresh GPS coordinates...')
      const freshLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      lat = freshLocation.coords.latitude
      lng = freshLocation.coords.longitude
      console.log('[Driving] Fresh GPS:', lat, lng, 'accuracy:', freshLocation.coords.accuracy, 'm')
    } catch (gpsError) {
      console.warn('[Driving] Fresh GPS failed, trying fallback...', gpsError)

      // Fallback 1: Try last known position
      try {
        const lastKnown = await Location.getLastKnownPositionAsync()
        if (lastKnown) {
          lat = lastKnown.coords.latitude
          lng = lastKnown.coords.longitude
          console.log('[Driving] Using last known GPS:', lat, lng)
        } else if (currentLocation) {
          // Fallback 2: Use tracked state as last resort
          lat = currentLocation.lat
          lng = currentLocation.lng
          console.warn('[Driving] Using tracked state (may be stale):', lat, lng)
        } else {
          Vibration.vibrate([0, 100, 50, 100])
          Alert.alert('GPS Error', 'Could not get your location. Please wait for GPS signal.')
          return
        }
      } catch (fallbackError) {
        if (currentLocation) {
          lat = currentLocation.lat
          lng = currentLocation.lng
          console.warn('[Driving] All GPS methods failed, using state:', lat, lng)
        } else {
          Vibration.vibrate([0, 100, 50, 100])
          Alert.alert('GPS Error', 'Could not get your location. Please wait for GPS signal.')
          return
        }
      }
    }

    const quickLead: QuickLead = {
      lat,
      lng,
      tags: ['to_analyze'],
      priority: 'normal',
    }

    console.log('[Driving] Saving lead at:', lat, lng)

    const result = await addLead(quickLead)

    if (result) {
      console.log('[Driving] Lead saved with ID:', result.id)
      setLastLeadId(result.id)
      // Store the address for the notes modal
      const locationDisplay = result.address && !result.isCoordinateFallback
        ? result.address + (result.city ? `, ${result.city}` : '')
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setLastLeadAddress(locationDisplay)
      // Add pin to map using the coordinates we just saved
      setLeadPins((prev) => [
        ...prev,
        {
          id: result.id,
          lat,
          lng,
          type: 'lead',
          label: result.address && !result.isCoordinateFallback ? result.address : `📍 ${leadsCount + 1}`,
        },
      ])
      // Audio feedback
      playSuccessSound()
      // Success feedback - show the address or coordinates as fallback
      Alert.alert('✓ Saved', `Lead ${leadsCount + 1} saved at ${locationDisplay}`)
    } else {
      console.error('[Driving] Failed to save lead - check console for error details')
      Alert.alert('Save Failed', 'Could not save lead. Check the console logs for details.')
    }
  }

  // Keep ref updated for shake detection
  useEffect(() => {
    handleQuickSaveRef.current = handleQuickSave
  })

  // Open add lead modal (for more details)
  const openAddLeadModal = () => {
    setIsEditingNotes(false)
    setSelectedTags([])
    setLeadNotes('')
    setLeadPriority('normal')
    setLeadAddress('')
    setCapturedPhotoUri(null)
    setCapturedVoiceUri(null)
    setShowAddLead(true)
    Vibration.vibrate(50)
  }

  // Handle voice recording toggle
  const handleVoiceToggle = async () => {
    if (!voiceAvailable) {
      Alert.alert('Not Available', 'Voice notes require expo-av to be installed.')
      return
    }
    if (isRecordingVoice) {
      const recording = await stopVoiceRecording()
      if (recording) {
        setCapturedVoiceUri(recording.uri)
        Vibration.vibrate(50)
      }
    } else {
      const started = await startVoiceRecording()
      if (started) {
        Vibration.vibrate(50)
      }
    }
  }

  // Open notes modal for editing last lead or create new
  const handleAddNotes = () => {
    if (lastLeadId) {
      // Edit notes on the last saved lead
      setIsEditingNotes(true)
      setSelectedTags([])
      setLeadNotes('')
      setShowNotesModal(true)
      Vibration.vibrate(50)
    } else {
      // No lead saved yet, show alert
      Alert.alert(
        'No Lead Saved',
        'Save a property first using TAP TO SAVE, then add notes to it.',
        [
          { text: 'OK' },
          { text: 'Add New Lead', onPress: openAddLeadModal }
        ]
      )
    }
  }

  // Save notes to the last lead
  const handleSaveNotesToLastLead = async () => {
    if (!lastLeadId) {
      Alert.alert('Error', 'No lead to add notes to')
      return
    }

    setIsSavingNotes(true)
    try {
      const success = await updateLeadNotes(
        lastLeadId,
        leadNotes,
        selectedTags.length > 0 ? selectedTags : undefined
      )

      if (success) {
        Vibration.vibrate([0, 50, 50, 100])
        setShowNotesModal(false)
        setLeadNotes('')
        setSelectedTags([])
        Alert.alert('✓ Notes Saved', `Notes added to ${lastLeadAddress || 'last lead'}`)
      } else {
        Alert.alert('Error', 'Failed to save notes. Please try again.')
      }
    } catch (err) {
      console.error('Error saving notes:', err)
      Alert.alert('Error', 'Failed to save notes')
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Save lead (from modal with notes/tags)
  // Also uses fresh GPS coordinates to avoid stale state issues
  const handleSaveLead = async () => {
    setIsAddingLead(true)

    // Get FRESH GPS coordinates
    let lat: number
    let lng: number

    try {
      console.log('[Driving Modal] Fetching fresh GPS coordinates...')
      const freshLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      lat = freshLocation.coords.latitude
      lng = freshLocation.coords.longitude
      console.log('[Driving Modal] Fresh GPS:', lat, lng)
    } catch (gpsError) {
      console.warn('[Driving Modal] Fresh GPS failed, trying fallback...', gpsError)
      if (currentLocation) {
        lat = currentLocation.lat
        lng = currentLocation.lng
        console.warn('[Driving Modal] Using tracked state:', lat, lng)
      } else {
        Alert.alert('Location Required', 'Waiting for GPS fix...')
        setIsAddingLead(false)
        return
      }
    }

    try {
      const newLead: QuickLead = {
        lat,
        lng,
        address: leadAddress || undefined,
        tags: selectedTags,
        notes: leadNotes || undefined,
        priority: leadPriority,
        photoUri: capturedPhotoUri || undefined,
        voiceUri: capturedVoiceUri || undefined,
      }

      const result = await addLead(newLead)

      if (result) {
        setLastLeadId(result.id)
        // Store the address for the notes modal
        const locationDisplay = leadAddress || (result.address && !result.isCoordinateFallback
          ? result.address + (result.city ? `, ${result.city}` : '')
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        setLastLeadAddress(locationDisplay)

        // Add pin to map using the coordinates we just saved
        setLeadPins((prev) => [
          ...prev,
          {
            id: result.id,
            lat,
            lng,
            type: 'lead',
            label: leadAddress || result.address || `Lead ${leadsCount + 1}`,
          },
        ])

        Vibration.vibrate([0, 50, 50, 100])
        setShowAddLead(false)

        // Audio feedback
        playSuccessSound()
        // Show confirmation with address
        Alert.alert('✓ Lead Saved', `Saved at ${locationDisplay}`)
      } else {
        Alert.alert('Error', 'Failed to save lead')
      }
    } catch (err) {
      console.error('Error saving lead:', err)
      Alert.alert('Error', 'Failed to save lead')
    } finally {
      setIsAddingLead(false)
    }
  }

  // Format duration
  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Not started yet - show start screen
  if (!isActive && !isPaused) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Driving for Dollars',
            headerShown: true,
          }}
        />
        <View style={[styles.startContainer, { backgroundColor: colors.paper }]}>
          <View style={styles.startContent}>
            <Text style={styles.startIcon}>🚗</Text>
            <Text style={[styles.startTitle, { color: colors.ink }]}>Driving for Dollars</Text>
            <Text style={[styles.startSubtitle, { color: colors.slate[500] }]}>
              Track your route and capture leads while driving through neighborhoods.
            </Text>

            {locationError && (
              <View style={[styles.errorBanner, { backgroundColor: colors.error[50] }]}>
                <Text style={[styles.errorText, { color: colors.error[700] }]}>{locationError}</Text>
              </View>
            )}

            <Button
              variant="primary"
              size="lg"
              onPress={handleStartSession}
              style={styles.startButton}
              disabled={isStartingSession}
            >
              {isStartingSession ? (
                <View style={styles.startButtonContent}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.startButtonLoadingText}>Acquiring GPS...</Text>
                </View>
              ) : (
                'Start Driving Session'
              )}
            </Button>

            <Text style={[styles.startNote, { color: colors.slate[400] }]}>
              {isStartingSession
                ? '⏳ This may take a few seconds for GPS lock'
                : '📍 Location tracking required for route recording'}
            </Text>
          </View>
        </View>
      </>
    )
  }

  // Active session UI
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Driving',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={handleEndSession} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>End</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.paper }]}>
        {/* Offline Banner */}
        <OfflineBanner />

        {/* Map with route */}
        <View style={styles.mapContainer}>
          <FlipMantisMap
            key={currentLocation ? 'map-with-location' : 'map-no-location'}
            pins={leadPins}
            routePoints={routePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
            showRoute={true}
            showUserLocation={true}
            followUser={!!currentLocation}
            initialCenter={
              currentLocation
                ? [currentLocation.lng, currentLocation.lat]
                : [-87.6298, 41.8781]
            }
            initialZoom={currentLocation ? 16 : 15}
            onLongPress={(coords: { lat: number; lng: number }) => {
              // Long press to add lead at different location
              Alert.alert('Add Lead Here?', `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
            }}
          />

          {/* Stats overlay */}
          <View style={[styles.statsOverlay, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.ink }]}>{distanceMiles.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: colors.slate[500] }]}>miles</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.slate[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.ink }]}>
                {currentLocation?.speed != null ? Math.round(currentLocation.speed * 2.237) : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.slate[500] }]}>mph</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.slate[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.ink }]}>{formatDuration(durationMinutes)}</Text>
              <Text style={[styles.statLabel, { color: colors.slate[500] }]}>time</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.slate[200] }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueHighlight, { color: colors.brand[600] }]}>{leadsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.slate[500] }]}>leads</Text>
            </View>
          </View>

          {/* GPS status indicator */}
          {!currentLocation && (
            <View style={[styles.gpsIndicator, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
              <Text style={[styles.gpsText, { color: colors.slate[600] }]}>📡 Acquiring GPS...</Text>
            </View>
          )}
        </View>

        {/* Bottom action bar - DRIVING OPTIMIZED */}
        <View style={[styles.actionBar, { backgroundColor: colors.white, borderTopColor: colors.slate[100] }]}>
          {/* ONE BIG BUTTON - tap to save location */}
          <TouchableOpacity
            style={[styles.megaSaveButton, { backgroundColor: colors.brand[500] }]}
            onPress={handleQuickSave}
            activeOpacity={0.7}
          >
            <Text style={styles.megaSaveText}>TAP TO SAVE</Text>
            <Text style={[styles.megaSaveSubtext, { color: colors.brand[100] }]}>{leadsCount} saved</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary actions - smaller, below main button */}
        <View style={[styles.secondaryBar, { backgroundColor: colors.white }]}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddNotes}>
            <Text style={styles.secondaryIcon}>📝</Text>
            <Text style={[styles.secondaryText, { color: colors.slate[600] }]}>Notes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCapturePhoto}>
            <Text style={styles.secondaryIcon}>📷</Text>
            <Text style={[styles.secondaryText, { color: colors.slate[600] }]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, !shakeEnabled && styles.secondaryButtonDisabled]}
            onPress={() => setShakeEnabled(!shakeEnabled)}
          >
            <Text style={styles.secondaryIcon}>{shakeEnabled ? '📳' : '📴'}</Text>
            <Text style={[styles.secondaryText, { color: shakeEnabled ? colors.brand[600] : colors.slate[400] }]}>Shake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, !audioEnabled && styles.secondaryButtonDisabled]}
            onPress={() => setAudioEnabled(!audioEnabled)}
          >
            <Text style={styles.secondaryIcon}>{audioEnabled ? '🔊' : '🔇'}</Text>
            <Text style={[styles.secondaryText, { color: audioEnabled ? colors.brand[600] : colors.slate[400] }]}>Sound</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleEndSession}>
            <Text style={styles.secondaryIcon}>🏁</Text>
            <Text style={[styles.secondaryText, { color: colors.slate[600] }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Add Lead Modal */}
        <Modal
          visible={showAddLead}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddLead(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.paper }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.white, borderBottomColor: colors.slate[100] }]}>
              <TouchableOpacity onPress={() => setShowAddLead(false)}>
                <Text style={[styles.modalCancel, { color: colors.slate[500] }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>Add Lead</Text>
              <TouchableOpacity onPress={handleSaveLead} disabled={isAddingLead}>
                <Text style={[styles.modalSave, { color: colors.brand[500] }, isAddingLead && { color: colors.slate[300] }]}>
                  {isAddingLead ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Location indicator */}
              <View style={[styles.locationIndicator, { backgroundColor: isDarkMode ? colors.brand[900] : colors.brand[50] }]}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={[styles.locationText, { color: isDarkMode ? colors.brand[200] : colors.brand[700] }]}>
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                    : 'Getting location...'}
                </Text>
              </View>

              {/* Quick Tags */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Quick Tags</Text>
              <View style={styles.tagsGrid}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.key}
                    style={[
                      styles.tagChip,
                      { borderColor: colors.slate[200], backgroundColor: colors.white },
                      selectedTags.includes(tag.key) && {
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                      },
                    ]}
                    onPress={() => toggleTag(tag.key)}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: colors.slate[700] },
                        selectedTags.includes(tag.key) && styles.tagChipTextSelected,
                      ]}
                    >
                      {tag.icon} {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((opt) => {
                  const optColor = opt.colorKey === 'slate' ? colors.slate[500] :
                                   opt.colorKey === 'warning' ? colors.warning[500] : colors.error[500]
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.priorityOption,
                        { borderColor: colors.slate[200], backgroundColor: colors.white },
                        leadPriority === opt.key && {
                          backgroundColor: optColor,
                          borderColor: optColor,
                        },
                      ]}
                      onPress={() => setLeadPriority(opt.key as any)}
                    >
                      <Text
                        style={[
                          styles.priorityText,
                          { color: colors.slate[600] },
                          leadPriority === opt.key && styles.priorityTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Address (optional) */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Address (optional)</Text>
              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.white, borderColor: colors.slate[200], color: colors.ink }]}
                value={leadAddress}
                onChangeText={setLeadAddress}
                placeholder="123 Main St"
                placeholderTextColor={colors.slate[400]}
              />

              {/* Notes */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Notes</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.white, borderColor: colors.slate[200], color: colors.ink }]}
                value={leadNotes}
                onChangeText={setLeadNotes}
                placeholder="Any quick observations..."
                placeholderTextColor={colors.slate[400]}
                multiline
                numberOfLines={3}
              />

              {/* Voice Note */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Voice Note</Text>
              {voiceAvailable ? (
                <View>
                  <TouchableOpacity
                    style={[
                      styles.voiceButton,
                      { backgroundColor: colors.slate[100], borderColor: colors.slate[200] },
                      isRecordingVoice && { backgroundColor: colors.error[100], borderColor: colors.error[300] }
                    ]}
                    onPress={handleVoiceToggle}
                  >
                    <Text style={[styles.voiceButtonText, { color: colors.slate[700] }]}>
                      {isRecordingVoice
                        ? `⏹️ Recording... ${formatVoiceDuration(voiceDurationMs)}`
                        : capturedVoiceUri
                        ? '🎤 Re-record Voice Note'
                        : '🎤 Record Voice Note'}
                    </Text>
                  </TouchableOpacity>
                  {capturedVoiceUri && !isRecordingVoice && (
                    <View style={[styles.voicePreview, { backgroundColor: colors.success[50] }]}>
                      <Text style={[styles.voicePreviewText, { color: colors.success[700] }]}>🎙️ Voice note recorded</Text>
                      <TouchableOpacity onPress={() => setCapturedVoiceUri(null)}>
                        <Text style={[styles.voiceDeleteText, { color: colors.error[500] }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={[styles.voiceUnavailableText, { color: colors.slate[400] }]}>Voice notes require expo-av</Text>
              )}

              {/* Photo capture */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Photo</Text>
              {capturedPhotoUri ? (
                <TouchableOpacity style={[styles.photoPreview, { backgroundColor: colors.success[50], borderColor: colors.success[200] }]} onPress={handleCapturePhoto}>
                  <Text style={[styles.photoPreviewText, { color: colors.success[700] }]}>📷 Photo captured • Tap to retake</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.photoButton, { backgroundColor: colors.slate[100], borderColor: colors.slate[200] }]} onPress={handleCapturePhoto}>
                  <Text style={[styles.photoButtonText, { color: colors.slate[600] }]}>📸 Take Photo</Text>
                </TouchableOpacity>
              )}

              {/* Spacer for bottom padding */}
              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Quick Notes Modal - for editing last saved lead */}
        <Modal
          visible={showNotesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNotesModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.paper }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.white, borderBottomColor: colors.slate[100] }]}>
              <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                <Text style={[styles.modalCancel, { color: colors.slate[500] }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>Add Notes</Text>
              <TouchableOpacity onPress={handleSaveNotesToLastLead} disabled={isSavingNotes}>
                <Text style={[styles.modalSave, { color: colors.brand[500] }, isSavingNotes && { color: colors.slate[300] }]}>
                  {isSavingNotes ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Location indicator */}
              <View style={[styles.locationIndicator, { backgroundColor: isDarkMode ? colors.brand[900] : colors.brand[50] }]}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={[styles.locationText, { color: isDarkMode ? colors.brand[200] : colors.brand[700] }]}>
                  Adding notes to: {lastLeadAddress || 'Last saved lead'}
                </Text>
              </View>

              {/* Quick Tags */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Quick Tags</Text>
              <View style={styles.tagsGrid}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.key}
                    style={[
                      styles.tagChip,
                      { borderColor: colors.slate[200], backgroundColor: colors.white },
                      selectedTags.includes(tag.key) && {
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                      },
                    ]}
                    onPress={() => toggleTag(tag.key)}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: colors.slate[700] },
                        selectedTags.includes(tag.key) && styles.tagChipTextSelected,
                      ]}
                    >
                      {tag.icon} {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={[styles.sectionLabel, { color: colors.ink }]}>Notes</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.white, borderColor: colors.slate[200], color: colors.ink }]}
                value={leadNotes}
                onChangeText={setLeadNotes}
                placeholder="Any observations about this property..."
                placeholderTextColor={colors.slate[400]}
                multiline
                numberOfLines={5}
                autoFocus
              />

              {/* Spacer for bottom padding */}
              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[100],
  },
  startContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  startContent: {
    alignItems: 'center',
  },
  startIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  startTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  startSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorBanner: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorText: {
    color: colors.error[700],
    textAlign: 'center',
  },
  startButton: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  startButtonLoadingText: {
    color: 'white',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  startNote: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    textAlign: 'center',
  },
  headerButton: {
    paddingHorizontal: spacing.md,
  },
  headerButtonText: {
    color: colors.error[500],
    fontWeight: typography.fontWeight.semibold,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  statsOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.medium,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  statValueHighlight: {
    color: colors.brand[600],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.slate[200],
    marginHorizontal: spacing.sm,
  },
  gpsIndicator: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  gpsText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  actionBar: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    alignItems: 'center',
  },
  megaSaveButton: {
    backgroundColor: colors.brand[500],
    width: '100%',
    height: 100,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  megaSaveText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  megaSaveSubtext: {
    color: colors.brand[100],
    fontSize: typography.fontSize.sm,
    marginTop: 4,
  },
  secondaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
    justifyContent: 'space-around',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  secondaryText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  sideButton: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  sideButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  sideButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    backgroundColor: colors.white,
  },
  modalCancel: {
    color: colors.slate[500],
    fontSize: typography.fontSize.base,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  modalSave: {
    color: colors.brand[500],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modalSaveDisabled: {
    color: colors.slate[300],
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  locationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[50],
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[700],
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  tagChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
  },
  tagChipTextSelected: {
    color: colors.white,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  priorityTextSelected: {
    color: colors.white,
  },
  addressInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  notesInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderStyle: 'dashed',
  },
  photoButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  photoPreview: {
    backgroundColor: colors.success[50],
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  photoPreviewText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  // Voice note styles
  voiceButton: {
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  voiceButtonRecording: {
    backgroundColor: colors.error[100],
    borderColor: colors.error[300],
  },
  voiceButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[700],
  },
  voicePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  voicePreviewText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  voiceDeleteText: {
    color: colors.error[500],
    fontSize: typography.fontSize.sm,
  },
  voiceUnavailableText: {
    color: colors.slate[400],
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
})
