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

import { useState, useCallback, useEffect } from 'react'
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
import { DealRoomMap, Button, Card, OfflineBanner, type MapPin } from '../src/components'
import { useDrivingSession, useCamera, type QuickLead } from '../src/hooks'
import { colors, spacing, typography, radii, shadows } from '../src/theme'

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

// Priority options
const PRIORITY_OPTIONS = [
  { key: 'normal', label: 'Normal', color: colors.slate[500] },
  { key: 'high', label: 'High', color: colors.warning[500] },
  { key: 'hot', label: 'Hot! 🔥', color: colors.error[500] },
]

export default function DrivingModeScreen() {
  const router = useRouter()
  const { takePhoto } = useCamera()

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
    hasLocationPermission,
    requestLocationPermission,
  } = useDrivingSession()

  // Lead capture modal
  const [showAddLead, setShowAddLead] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [leadNotes, setLeadNotes] = useState('')
  const [leadPriority, setLeadPriority] = useState<'low' | 'normal' | 'high' | 'hot'>('normal')
  const [leadAddress, setLeadAddress] = useState('')
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null)
  const [isAddingLead, setIsAddingLead] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)

  // Map pins from leads captured this session
  const [leadPins, setLeadPins] = useState<MapPin[]>([])
  const [lastLeadId, setLastLeadId] = useState<string | null>(null)

  // Request permission on mount if needed
  useEffect(() => {
    if (!hasLocationPermission) {
      requestLocationPermission()
    }
  }, [hasLocationPermission, requestLocationPermission])

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

  // Capture photo - if we have a last lead, attach to it
  const handleCapturePhoto = async () => {
    const photo = await takePhoto({ quality: 0.7 })
    if (photo) {
      if (lastLeadId) {
        // Upload photo and attach to the last saved lead
        setCapturedPhotoUri(photo.uri)
        Vibration.vibrate(50)

        // Upload in background
        addPhotoToLead(lastLeadId, photo.uri).then((success) => {
          if (success) {
            Alert.alert('📷 Photo Uploaded', 'Photo attached to your last saved property')
          } else {
            Alert.alert('📷 Photo Saved Locally', 'Upload failed - will retry when online')
          }
        })
      } else {
        setCapturedPhotoUri(photo.uri)
        Alert.alert('📷 Photo Saved', 'Save a property first, then take a photo to attach it')
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

    const leadId = await addLead(quickLead)

    if (leadId) {
      console.log('[Driving] Lead saved with ID:', leadId)
      setLastLeadId(leadId)
      // Add pin to map using the coordinates we just saved
      setLeadPins((prev) => [
        ...prev,
        {
          id: leadId,
          lat,
          lng,
          type: 'lead',
          label: `📍 ${leadsCount + 1}`,
        },
      ])
      // Success feedback - show the actual coordinates saved
      Alert.alert('✓ Saved', `Lead ${leadsCount + 1} saved at ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } else {
      console.error('[Driving] Failed to save lead - check console for error details')
      Alert.alert('Save Failed', 'Could not save lead. Check the console logs for details.')
    }
  }

  // Open add lead modal (for more details)
  const openAddLeadModal = () => {
    setSelectedTags([])
    setLeadNotes('')
    setLeadPriority('normal')
    setLeadAddress('')
    setCapturedPhotoUri(null)
    setShowAddLead(true)
    Vibration.vibrate(50)
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
      }

      const leadId = await addLead(newLead)

      if (leadId) {
        // Add pin to map using the coordinates we just saved
        setLeadPins((prev) => [
          ...prev,
          {
            id: leadId,
            lat,
            lng,
            type: 'lead',
            label: leadAddress || `Lead ${leadsCount + 1}`,
          },
        ])

        Vibration.vibrate([0, 50, 50, 100])
        setShowAddLead(false)
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
        <View style={styles.startContainer}>
          <View style={styles.startContent}>
            <Text style={styles.startIcon}>🚗</Text>
            <Text style={styles.startTitle}>Driving for Dollars</Text>
            <Text style={styles.startSubtitle}>
              Track your route and capture leads while driving through neighborhoods.
            </Text>

            {locationError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{locationError}</Text>
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

            <Text style={styles.startNote}>
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

      <View style={styles.container}>
        {/* Offline Banner */}
        <OfflineBanner />

        {/* Map with route */}
        <View style={styles.mapContainer}>
          <DealRoomMap
            pins={leadPins}
            routePoints={routePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
            showRoute={true}
            showUserLocation={true}
            followUser={true}
            initialCenter={
              currentLocation
                ? [currentLocation.lng, currentLocation.lat]
                : [-87.6298, 41.8781]
            }
            initialZoom={15}
            onLongPress={(coords) => {
              // Long press to add lead at different location
              Alert.alert('Add Lead Here?', `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
            }}
          />

          {/* Stats overlay */}
          <View style={styles.statsOverlay}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{distanceMiles.toFixed(1)}</Text>
              <Text style={styles.statLabel}>miles</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDuration(durationMinutes)}</Text>
              <Text style={styles.statLabel}>time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueHighlight]}>{leadsCount}</Text>
              <Text style={styles.statLabel}>leads</Text>
            </View>
          </View>

          {/* GPS status indicator */}
          {!currentLocation && (
            <View style={styles.gpsIndicator}>
              <Text style={styles.gpsText}>📡 Acquiring GPS...</Text>
            </View>
          )}
        </View>

        {/* Bottom action bar - DRIVING OPTIMIZED */}
        <View style={styles.actionBar}>
          {/* ONE BIG BUTTON - tap to save location */}
          <TouchableOpacity
            style={styles.megaSaveButton}
            onPress={handleQuickSave}
            activeOpacity={0.7}
          >
            <Text style={styles.megaSaveText}>TAP TO SAVE</Text>
            <Text style={styles.megaSaveSubtext}>{leadsCount} saved</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary actions - smaller, below main button */}
        <View style={styles.secondaryBar}>
          <TouchableOpacity style={styles.secondaryButton} onPress={openAddLeadModal}>
            <Text style={styles.secondaryIcon}>📝</Text>
            <Text style={styles.secondaryText}>Add Notes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCapturePhoto}>
            <Text style={styles.secondaryIcon}>📷</Text>
            <Text style={styles.secondaryText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleEndSession}>
            <Text style={styles.secondaryIcon}>🏁</Text>
            <Text style={styles.secondaryText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Add Lead Modal */}
        <Modal
          visible={showAddLead}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddLead(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddLead(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Lead</Text>
              <TouchableOpacity onPress={handleSaveLead} disabled={isAddingLead}>
                <Text style={[styles.modalSave, isAddingLead && styles.modalSaveDisabled]}>
                  {isAddingLead ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Location indicator */}
              <View style={styles.locationIndicator}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                    : 'Getting location...'}
                </Text>
              </View>

              {/* Quick Tags */}
              <Text style={styles.sectionLabel}>Quick Tags</Text>
              <View style={styles.tagsGrid}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.key}
                    style={[
                      styles.tagChip,
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
                        selectedTags.includes(tag.key) && styles.tagChipTextSelected,
                      ]}
                    >
                      {tag.icon} {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority */}
              <Text style={styles.sectionLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.priorityOption,
                      leadPriority === opt.key && {
                        backgroundColor: opt.color,
                        borderColor: opt.color,
                      },
                    ]}
                    onPress={() => setLeadPriority(opt.key as any)}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        leadPriority === opt.key && styles.priorityTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Address (optional) */}
              <Text style={styles.sectionLabel}>Address (optional)</Text>
              <TextInput
                style={styles.addressInput}
                value={leadAddress}
                onChangeText={setLeadAddress}
                placeholder="123 Main St"
                placeholderTextColor={colors.slate[400]}
              />

              {/* Notes */}
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={leadNotes}
                onChangeText={setLeadNotes}
                placeholder="Any quick observations..."
                placeholderTextColor={colors.slate[400]}
                multiline
                numberOfLines={3}
              />

              {/* Photo capture */}
              <Text style={styles.sectionLabel}>Photo</Text>
              {capturedPhotoUri ? (
                <TouchableOpacity style={styles.photoPreview} onPress={handleCapturePhoto}>
                  <Text style={styles.photoPreviewText}>📷 Photo captured • Tap to retake</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.photoButton} onPress={handleCapturePhoto}>
                  <Text style={styles.photoButtonText}>📸 Take Photo</Text>
                </TouchableOpacity>
              )}

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
})
