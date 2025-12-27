/**
 * Evaluation Screen
 *
 * Guided photo capture with prompts for field evaluations.
 * This is the mobile signature feature.
 */

import { useEffect, useState } from 'react'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { ScreenContainer, Card, Button, OfflineBanner } from '../../src/components'
import { useEvaluationSession, useVoiceNote, formatDuration, type PhotoCapture } from '../../src/hooks'
import { useIsOnline } from '../../src/contexts/OfflineContext'
import { colors, spacing, typography, radii } from '../../src/theme'

// Photo Prompt Card
function PhotoPromptCard({
  photo,
  onCapture,
  onPick,
  onRetake,
  onDelete,
  isCapturing,
}: {
  photo: PhotoCapture
  onCapture: () => void
  onPick: () => void
  onRetake: () => void
  onDelete: () => void
  isCapturing: boolean
}) {
  const hasCaptured = photo.localUri || photo.capturedAt
  const isUploading = photo.isUploading

  return (
    <Card
      style={[styles.promptCard, hasCaptured && styles.promptCardCaptured]}
      padding="md"
    >
      <View style={styles.promptHeader}>
        <View style={styles.promptTitleRow}>
          <Text style={styles.promptIcon}>
            {isUploading ? '⏳' : hasCaptured ? '✅' : '📷'}
          </Text>
          <View style={styles.promptText}>
            <Text style={styles.promptLabel}>{photo.label}</Text>
            {photo.required && !hasCaptured && (
              <Text style={styles.promptRequired}>Required</Text>
            )}
            {photo.uploadError && (
              <Text style={styles.promptError}>{photo.uploadError}</Text>
            )}
          </View>
        </View>

        {isUploading && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color={colors.brand[500]} />
            <Text style={styles.uploadProgressText}>
              {photo.uploadProgress || 0}%
            </Text>
          </View>
        )}
      </View>

      {/* Photo Preview */}
      {photo.localUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo.localUri }} style={styles.preview} />
        </View>
      )}

      {/* Actions */}
      <View style={styles.promptActions}>
        {!hasCaptured ? (
          <>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={onCapture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Text style={styles.captureButtonIcon}>📸</Text>
                  <Text style={styles.captureButtonText}>Take Photo</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickButton}
              onPress={onPick}
              disabled={isCapturing}
            >
              <Text style={styles.pickButtonText}>Choose from Library</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.capturedActions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={onRetake}
              disabled={isCapturing || isUploading}
            >
              <Text style={styles.retakeButtonText}>🔄 Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  'Delete Photo',
                  'Are you sure you want to delete this photo?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete },
                  ]
                )
              }}
              disabled={isUploading}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Card>
  )
}

export default function EvaluationScreen() {
  const { sessionId, strategy: strategyParam } = useLocalSearchParams<{
    sessionId: string
    strategy?: string
  }>()
  const router = useRouter()
  const isOnline = useIsOnline()
  const [hasStarted, setHasStarted] = useState(false)

  // Determine strategy from param or default to flip
  const strategy = (strategyParam as 'flip' | 'brrrr' | 'wholesale') || 'flip'
  const dealId = sessionId || ''

  const evaluation = useEvaluationSession(dealId, strategy)

  const {
    state,
    capturedCount,
    requiredCount,
    requiredCapturedCount,
    isReadyToComplete,
    hasUnsyncedPhotos,
    isCapturing,
    capturePhoto,
    pickPhoto,
    retakePhoto,
    deletePhoto,
    completeSession,
    startSession,
  } = evaluation

  // Voice notes
  const voiceNote = useVoiceNote()
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  // Auto-start session on mount
  useEffect(() => {
    if (state.status === 'idle' && !hasStarted && dealId) {
      setHasStarted(true)
      // Start session - will create a session record or use local mode if offline
      if (isOnline) {
        startSession().catch((err) => {
          console.warn('Failed to start session, continuing in local mode:', err)
        })
      }
    }
  }, [state.status, hasStarted, dealId, isOnline, startSession])

  const handleComplete = async () => {
    if (hasUnsyncedPhotos && !isOnline) {
      Alert.alert(
        'Photos Not Synced',
        'Some photos have not been uploaded yet. They will sync when you reconnect. Complete anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: async () => {
              const success = await completeSession()
              if (success) {
                router.back()
              }
            },
          },
        ]
      )
      return
    }

    const success = await completeSession()
    if (success) {
      Alert.alert('Success', 'Evaluation completed successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ])
    }
  }

  // Strategy labels for display
  const strategyLabels: Record<string, string> = {
    flip: 'Flip',
    brrrr: 'BRRRR',
    wholesale: 'Wholesale',
    hold: 'Buy & Hold',
  }

  // Loading state
  if (state.status === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: 'Evaluation', headerShown: true }} />
        <ScreenContainer>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Starting evaluation session...</Text>
          </View>
        </ScreenContainer>
      </>
    )
  }

  // Error state
  if (state.status === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: 'Evaluation', headerShown: true }} />
        <ScreenContainer>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Session Error</Text>
            <Text style={styles.errorText}>{state.error || 'Could not start session'}</Text>
            <Button variant="primary" onPress={() => router.back()}>
              Go Back
            </Button>
          </View>
        </ScreenContainer>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `${strategyLabels[strategy] || 'Property'} Evaluation`,
          headerShown: true,
        }}
      />
      <ScreenContainer scrollable={false} padding={false}>
        {/* Offline Banner */}
        <OfflineBanner />

        {/* Progress Header */}
        <View style={styles.progressHeader}>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressValue}>{capturedCount}</Text>
              <Text style={styles.progressLabel}>Captured</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStat}>
              <Text style={styles.progressValue}>
                {requiredCapturedCount}/{requiredCount}
              </Text>
              <Text style={styles.progressLabel}>Required</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    requiredCount > 0
                      ? (requiredCapturedCount / requiredCount) * 100
                      : 0
                  }%`,
                },
              ]}
            />
          </View>

          {!isOnline && (
            <Text style={styles.offlineNote}>
              📡 Working offline - photos will sync when connected
            </Text>
          )}
        </View>

        {/* Photo Prompts List */}
        <FlatList
          data={state.photos}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <PhotoPromptCard
              photo={item}
              onCapture={() => capturePhoto(item.key)}
              onPick={() => pickPhoto(item.key)}
              onRetake={() => retakePhoto(item.key)}
              onDelete={() => deletePhoto(item.key)}
              isCapturing={isCapturing}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Button
            variant="outline"
            style={styles.footerButton}
            onPress={() => setShowVoiceModal(true)}
          >
            🎤 Voice Note {voiceNote.recordings.length > 0 && `(${voiceNote.recordings.length})`}
          </Button>
          <Button
            variant="primary"
            style={styles.footerButtonPrimary}
            disabled={!isReadyToComplete}
            onPress={handleComplete}
          >
            {state.status === 'completing' ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              'Complete Evaluation'
            )}
          </Button>
        </View>

        {/* Voice Note Modal */}
        <Modal
          visible={showVoiceModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowVoiceModal(false)}
        >
          <View style={styles.voiceModalContainer}>
            <View style={styles.voiceModalHeader}>
              <Text style={styles.voiceModalTitle}>Voice Notes</Text>
              <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
                <Text style={styles.voiceModalClose}>Done</Text>
              </TouchableOpacity>
            </View>

            {!voiceNote.isAvailable ? (
              <View style={styles.voiceNotAvailable}>
                <Text style={styles.voiceNotAvailableIcon}>🎤</Text>
                <Text style={styles.voiceNotAvailableText}>
                  Voice notes require expo-av
                </Text>
                <Text style={styles.voiceNotAvailableSubtext}>
                  Run: npx expo install expo-av
                </Text>
              </View>
            ) : (
              <>
                {/* Recording Controls */}
                <View style={styles.voiceRecordingSection}>
                  {voiceNote.isRecording ? (
                    <View style={styles.voiceRecordingActive}>
                      <View style={styles.voiceRecordingIndicator}>
                        <View style={styles.voiceRecordingDot} />
                        <Text style={styles.voiceRecordingTime}>
                          {formatDuration(voiceNote.durationMs)}
                        </Text>
                      </View>
                      <View style={styles.voiceRecordingButtons}>
                        {voiceNote.isPaused ? (
                          <TouchableOpacity
                            style={styles.voiceControlButton}
                            onPress={voiceNote.resumeRecording}
                          >
                            <Text style={styles.voiceControlIcon}>▶️</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.voiceControlButton}
                            onPress={voiceNote.pauseRecording}
                          >
                            <Text style={styles.voiceControlIcon}>⏸️</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.voiceControlButton, styles.voiceStopButton]}
                          onPress={voiceNote.stopRecording}
                        >
                          <Text style={styles.voiceControlIcon}>⏹️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.voiceControlButton}
                          onPress={voiceNote.cancelRecording}
                        >
                          <Text style={styles.voiceControlIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.voiceStartButton}
                      onPress={voiceNote.startRecording}
                    >
                      <Text style={styles.voiceStartIcon}>🎙️</Text>
                      <Text style={styles.voiceStartText}>Tap to Record</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Recordings List */}
                <ScrollView style={styles.voiceRecordingsList}>
                  <Text style={styles.voiceRecordingsTitle}>
                    Recordings ({voiceNote.recordings.length})
                  </Text>
                  {voiceNote.recordings.length === 0 ? (
                    <Text style={styles.voiceNoRecordings}>
                      No voice notes yet. Tap the microphone to start.
                    </Text>
                  ) : (
                    voiceNote.recordings.map((recording) => (
                      <View key={recording.id} style={styles.voiceRecordingItem}>
                        <View style={styles.voiceRecordingInfo}>
                          <Text style={styles.voiceRecordingDuration}>
                            {formatDuration(recording.durationMs)}
                          </Text>
                          <Text style={styles.voiceRecordingDate}>
                            {new Date(recording.createdAt).toLocaleTimeString()}
                          </Text>
                        </View>
                        <View style={styles.voiceRecordingActions}>
                          {voiceNote.playingUri === recording.uri ? (
                            <TouchableOpacity
                              style={styles.voicePlayButton}
                              onPress={voiceNote.stopPlayback}
                            >
                              <Text style={styles.voicePlayIcon}>⏹️</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.voicePlayButton}
                              onPress={() => voiceNote.playRecording(recording.uri)}
                            >
                              <Text style={styles.voicePlayIcon}>▶️</Text>
                            </TouchableOpacity>
                          )}
                          {/* Transcribe Button */}
                          <TouchableOpacity
                            style={[
                              styles.voiceTranscribeButton,
                              recording.isTranscribing && styles.voiceTranscribeButtonActive,
                            ]}
                            onPress={() => voiceNote.transcribeRecording(recording.id)}
                            disabled={recording.isTranscribing || !!recording.transcript}
                          >
                            {recording.isTranscribing ? (
                              <ActivityIndicator size="small" color={colors.brand[500]} />
                            ) : (
                              <Text style={styles.voiceTranscribeIcon}>
                                {recording.transcript ? '✓' : '📝'}
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.voiceDeleteButton}
                            onPress={() => voiceNote.deleteRecording(recording.id)}
                          >
                            <Text style={styles.voiceDeleteIcon}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                        {/* Transcript Display */}
                        {recording.transcript && (
                          <View style={styles.voiceTranscriptContainer}>
                            <Text style={styles.voiceTranscriptLabel}>Transcript:</Text>
                            <Text style={styles.voiceTranscriptText}>{recording.transcript}</Text>
                          </View>
                        )}
                        {recording.transcriptError && (
                          <Text style={styles.voiceTranscriptError}>{recording.transcriptError}</Text>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </Modal>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  progressHeader: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  progressStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  progressValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[600],
  },
  progressLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  progressDivider: {
    width: 1,
    backgroundColor: colors.slate[200],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.slate[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand[500],
    borderRadius: 4,
  },
  offlineNote: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 140,
  },
  promptCard: {
    marginBottom: spacing.md,
  },
  promptCardCaptured: {
    borderColor: colors.success[200],
    backgroundColor: colors.success[50],
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  promptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  promptIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  promptText: {
    flex: 1,
  },
  promptLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  promptRequired: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: 2,
  },
  promptError: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: 2,
  },
  uploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadProgressText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
  },
  previewContainer: {
    marginVertical: spacing.sm,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  promptActions: {
    marginTop: spacing.sm,
  },
  captureButton: {
    backgroundColor: colors.brand[500],
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  captureButtonIcon: {
    fontSize: 18,
  },
  captureButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  pickButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  pickButtonText: {
    color: colors.brand[600],
    fontSize: typography.fontSize.sm,
  },
  capturedActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: colors.slate[100],
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: colors.slate[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  footerButtonPrimary: {
    flex: 2,
  },

  // Voice Note Modal Styles
  voiceModalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  voiceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  voiceModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  voiceModalClose: {
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  voiceNotAvailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  voiceNotAvailableIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  voiceNotAvailableText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  voiceNotAvailableSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    fontFamily: 'monospace',
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  voiceRecordingSection: {
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  voiceStartButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceStartIcon: {
    fontSize: 48,
  },
  voiceStartText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  voiceRecordingActive: {
    alignItems: 'center',
  },
  voiceRecordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  voiceRecordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error[500],
    marginRight: spacing.sm,
  },
  voiceRecordingTime: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  voiceRecordingButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  voiceControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceStopButton: {
    backgroundColor: colors.error[100],
  },
  voiceControlIcon: {
    fontSize: 24,
  },
  voiceRecordingsList: {
    flex: 1,
    padding: spacing.md,
  },
  voiceRecordingsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  voiceNoRecordings: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  voiceRecordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  voiceRecordingInfo: {
    flex: 1,
  },
  voiceRecordingDuration: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  voiceRecordingDate: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  voiceRecordingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  voicePlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayIcon: {
    fontSize: 18,
  },
  voiceDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceDeleteIcon: {
    fontSize: 18,
  },
  // Transcription styles
  voiceTranscribeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTranscribeButtonActive: {
    backgroundColor: colors.brand[100],
  },
  voiceTranscribeIcon: {
    fontSize: 18,
  },
  voiceTranscriptContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand[400],
  },
  voiceTranscriptLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  voiceTranscriptText: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },
  voiceTranscriptError: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
  },
})
