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
} from 'react-native'
import { ScreenContainer, Card, Button, OfflineBanner } from '../../src/components'
import { useEvaluationSession, type PhotoCapture } from '../../src/hooks'
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
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const router = useRouter()
  const isOnline = useIsOnline()
  const [opportunityId] = useState(sessionId || 'test-opportunity')

  const evaluation = useEvaluationSession(opportunityId, 'flip')

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

  // Auto-start session on mount
  useEffect(() => {
    if (state.status === 'idle') {
      // For now, just set status to active without API call
      // In production, would call startSession()
    }
  }, [state.status])

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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Evaluation',
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
            onPress={() => {
              Alert.alert(
                'Voice Note',
                'Voice notes coming soon!',
                [{ text: 'OK' }]
              )
            }}
          >
            🎤 Voice Note
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
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
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
})
