/**
 * Portal Screen
 *
 * Public access portal via token. No authentication required.
 * Provides read-only or limited-write access to deal information.
 */

import { useLocalSearchParams } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Dimensions,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { supabase } from '../../src/contexts/AuthContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface PortalData {
  isValid: boolean
  stakeholderName?: string
  stakeholderType?: string
  dealId?: string
  property?: {
    id: string
    address: string
    city: string
    state: string
    zip?: string
    bedrooms?: number
    bathrooms?: number
    sqft?: number
    year_built?: number
  }
  deal?: {
    id: string
    name: string
    stage: string
    exit_strategy?: string
    purchase_price?: number
    arv?: number
  }
  capabilities: {
    view_overview?: boolean
    view_photos?: boolean
    upload_photos?: boolean
    comment?: boolean
  }
}

interface PortalPhoto {
  id: string
  storage_path: string
  caption?: string
  created_at: string
}

interface PortalComment {
  id: string
  author_name: string
  content: string
  created_at: string
}

type PortalView = 'home' | 'overview' | 'photos' | 'upload' | 'comments'

// Photo Gallery Component
function PhotoGallery({
  photos,
  onSelect,
}: {
  photos: PortalPhoto[]
  onSelect: (photo: PortalPhoto) => void
}) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

  if (photos.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>📷</Text>
        <Text style={styles.emptyStateText}>No photos yet</Text>
        <Text style={styles.emptyStateSubtext}>Photos will appear here</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={photos}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.photoGrid}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.photoThumb}
          onPress={() => onSelect(item)}
        >
          <Image
            source={{
              uri: `${supabaseUrl}/storage/v1/object/public/dealroom-media/${item.storage_path}`,
            }}
            style={styles.photoThumbImage}
          />
          {item.caption && (
            <Text style={styles.photoCaption} numberOfLines={1}>
              {item.caption}
            </Text>
          )}
        </TouchableOpacity>
      )}
    />
  )
}

// Comments List Component
function CommentsList({
  comments,
  onAddComment,
  canComment,
}: {
  comments: PortalComment[]
  onAddComment: (content: string) => void
  canComment: boolean
}) {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setIsSubmitting(true)
    await onAddComment(newComment.trim())
    setNewComment('')
    setIsSubmitting(false)
  }

  return (
    <View style={styles.commentsContainer}>
      {/* Comment Input */}
      {canComment && (
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.commentSubmitButton,
              (!newComment.trim() || isSubmitting) && styles.commentSubmitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.commentSubmitText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>💬</Text>
          <Text style={styles.emptyStateText}>No comments yet</Text>
          {canComment && (
            <Text style={styles.emptyStateSubtext}>Be the first to comment</Text>
          )}
        </View>
      ) : (
        <ScrollView style={styles.commentsList}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{comment.author_name}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.commentContent}>{comment.content}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

export default function PortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [portalData, setPortalData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<PortalView>('home')
  const [photos, setPhotos] = useState<PortalPhoto[]>([])
  const [comments, setComments] = useState<PortalComment[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<PortalPhoto | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Invalid portal link')
        setIsLoading(false)
        return
      }

      try {
        // Call the validate_portal_token_v2 RPC
        const { data, error: rpcError } = await supabase.rpc(
          'validate_portal_token_v2',
          { p_token: token }
        )

        if (rpcError) throw rpcError

        if (data && data.is_valid) {
          setPortalData({
            isValid: true,
            stakeholderName: data.stakeholder_name,
            stakeholderType: data.stakeholder_type,
            dealId: data.deal_id,
            property: data.property,
            deal: data.deal,
            capabilities: data.capabilities || {},
          })
        } else {
          setError('This portal link is invalid or has expired')
        }
      } catch (err) {
        console.error('Portal validation error:', err)
        setError('Unable to validate portal access')
      } finally {
        setIsLoading(false)
      }
    }

    validateToken()
  }, [token])

  // Fetch photos when viewing photos
  const fetchPhotos = useCallback(async () => {
    if (!portalData?.dealId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('dealroom_media')
        .select('id, storage_path, caption, created_at')
        .eq('deal_id', portalData.dealId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setPhotos(data || [])
    } catch (err) {
      console.error('Error fetching photos:', err)
    }
  }, [portalData?.dealId])

  // Fetch comments when viewing comments
  const fetchComments = useCallback(async () => {
    if (!portalData?.dealId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('dealroom_portal_comments')
        .select('id, author_name, content, created_at')
        .eq('deal_id', portalData.dealId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setComments(data || [])
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }, [portalData?.dealId])

  useEffect(() => {
    if (currentView === 'photos' && portalData?.capabilities.view_photos) {
      fetchPhotos()
    } else if (currentView === 'comments') {
      fetchComments()
    }
  }, [currentView, portalData?.capabilities.view_photos, fetchPhotos, fetchComments])

  // Handle photo upload
  const handleUploadPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.[0]) return

      setIsUploading(true)

      const asset = result.assets[0]
      const fileName = `portal_${Date.now()}.jpg`
      const filePath = `deals/${portalData?.dealId}/${fileName}`

      // Upload to Supabase Storage
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('dealroom-media')
        .upload(filePath, blob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      // Create media record
      await supabase.from('dealroom_media').insert({
        deal_id: portalData?.dealId,
        storage_path: filePath,
        kind: 'portal_upload',
        uploaded_by_name: portalData?.stakeholderName || 'Portal User',
      })

      Alert.alert('Success', 'Photo uploaded successfully!')
      fetchPhotos()
    } catch (err) {
      console.error('Upload error:', err)
      Alert.alert('Error', 'Failed to upload photo')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle comment submission
  const handleAddComment = async (content: string) => {
    if (!portalData?.dealId) return

    try {
      await supabase.from('dealroom_portal_comments').insert({
        deal_id: portalData.dealId,
        author_name: portalData.stakeholderName || 'Portal User',
        content,
        portal_token: token,
      })

      fetchComments()
    } catch (err) {
      console.error('Error adding comment:', err)
      Alert.alert('Error', 'Failed to add comment')
    }
  }

  // Format currency
  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    return `$${value.toLocaleString()}`
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Validating access...</Text>
        </View>
      </ScreenContainer>
    )
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ScreenContainer>
    )
  }

  // Render back button for sub-views
  const renderBackButton = () => (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => setCurrentView('home')}
    >
      <Text style={styles.backButtonText}>← Back</Text>
    </TouchableOpacity>
  )

  // Render Overview View
  if (currentView === 'overview') {
    return (
      <ScreenContainer>
        {renderBackButton()}
        <Text style={styles.viewTitle}>Property Overview</Text>

        {/* Property Details */}
        <Card style={styles.detailsCard} padding="md">
          <Text style={styles.detailsTitle}>Property Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>
              {portalData?.property?.address}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>City/State</Text>
            <Text style={styles.detailValue}>
              {portalData?.property?.city}, {portalData?.property?.state}{' '}
              {portalData?.property?.zip}
            </Text>
          </View>
          {portalData?.property?.bedrooms && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bedrooms</Text>
              <Text style={styles.detailValue}>{portalData.property.bedrooms}</Text>
            </View>
          )}
          {portalData?.property?.bathrooms && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bathrooms</Text>
              <Text style={styles.detailValue}>{portalData.property.bathrooms}</Text>
            </View>
          )}
          {portalData?.property?.sqft && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Square Feet</Text>
              <Text style={styles.detailValue}>
                {portalData.property.sqft.toLocaleString()}
              </Text>
            </View>
          )}
          {portalData?.property?.year_built && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Year Built</Text>
              <Text style={styles.detailValue}>{portalData.property.year_built}</Text>
            </View>
          )}
        </Card>

        {/* Deal Info */}
        {portalData?.deal && (
          <Card style={styles.detailsCard} padding="md">
            <Text style={styles.detailsTitle}>Deal Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.stageBadge}>
                <Text style={styles.stageBadgeText}>
                  {portalData.deal.stage?.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            {portalData.deal.exit_strategy && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Strategy</Text>
                <Text style={styles.detailValue}>
                  {portalData.deal.exit_strategy.toUpperCase()}
                </Text>
              </View>
            )}
            {portalData.deal.purchase_price && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchase Price</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(portalData.deal.purchase_price)}
                </Text>
              </View>
            )}
            {portalData.deal.arv && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ARV</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(portalData.deal.arv)}
                </Text>
              </View>
            )}
          </Card>
        )}
      </ScreenContainer>
    )
  }

  // Render Photos View
  if (currentView === 'photos') {
    return (
      <ScreenContainer scrollable={false}>
        {renderBackButton()}
        <Text style={styles.viewTitle}>Photos</Text>
        <PhotoGallery photos={photos} onSelect={setSelectedPhoto} />

        {/* Photo Modal */}
        <Modal
          visible={!!selectedPhoto}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPhoto(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedPhoto(null)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            {selectedPhoto && (
              <Image
                source={{
                  uri: `${supabaseUrl}/storage/v1/object/public/dealroom-media/${selectedPhoto.storage_path}`,
                }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </ScreenContainer>
    )
  }

  // Render Upload View
  if (currentView === 'upload') {
    return (
      <ScreenContainer>
        {renderBackButton()}
        <Text style={styles.viewTitle}>Upload Photos</Text>

        <View style={styles.uploadContainer}>
          <Text style={styles.uploadIcon}>📤</Text>
          <Text style={styles.uploadText}>
            Upload photos to share with the team
          </Text>
          <Button
            variant="primary"
            onPress={handleUploadPhoto}
            disabled={isUploading}
            style={styles.uploadButton}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              'Choose Photo'
            )}
          </Button>
        </View>

        {photos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Uploads</Text>
            <PhotoGallery photos={photos} onSelect={setSelectedPhoto} />
          </>
        )}
      </ScreenContainer>
    )
  }

  // Render Comments View
  if (currentView === 'comments') {
    return (
      <ScreenContainer scrollable={false}>
        {renderBackButton()}
        <Text style={styles.viewTitle}>Comments</Text>
        <CommentsList
          comments={comments}
          onAddComment={handleAddComment}
          canComment={!!portalData?.capabilities.comment}
        />
      </ScreenContainer>
    )
  }

  // Home View (default)
  return (
    <ScreenContainer>
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome,</Text>
        <Text style={styles.stakeholderName}>
          {portalData?.stakeholderName || 'Guest'}
        </Text>
        {portalData?.stakeholderType && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {portalData.stakeholderType.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Property Info */}
      {portalData?.property && (
        <Card style={styles.propertyCard} padding="md">
          <Text style={styles.propertyLabel}>Property</Text>
          <Text style={styles.propertyAddress}>
            {portalData.property.address}
          </Text>
          <Text style={styles.propertyCity}>
            {portalData.property.city}, {portalData.property.state}
          </Text>
        </Card>
      )}

      {/* Available Actions */}
      <Text style={styles.sectionTitle}>Available Actions</Text>
      <View style={styles.actionsGrid}>
        {portalData?.capabilities.view_overview && (
          <TouchableOpacity onPress={() => setCurrentView('overview')}>
            <Card style={styles.actionCard} padding="md">
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>View Overview</Text>
            </Card>
          </TouchableOpacity>
        )}
        {portalData?.capabilities.view_photos && (
          <TouchableOpacity onPress={() => setCurrentView('photos')}>
            <Card style={styles.actionCard} padding="md">
              <Text style={styles.actionIcon}>📸</Text>
              <Text style={styles.actionLabel}>View Photos</Text>
            </Card>
          </TouchableOpacity>
        )}
        {portalData?.capabilities.upload_photos && (
          <TouchableOpacity onPress={() => setCurrentView('upload')}>
            <Card style={styles.actionCard} padding="md">
              <Text style={styles.actionIcon}>📤</Text>
              <Text style={styles.actionLabel}>Upload Photos</Text>
            </Card>
          </TouchableOpacity>
        )}
        {portalData?.capabilities.comment && (
          <TouchableOpacity onPress={() => setCurrentView('comments')}>
            <Card style={styles.actionCard} padding="md">
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionLabel}>Comments</Text>
            </Card>
          </TouchableOpacity>
        )}
      </View>

      {/* Info Card */}
      <Card padding="lg" style={styles.infoCard}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>ℹ️</Text>
          <Text style={styles.emptyStateText}>Portal Access</Text>
          <Text style={styles.emptyStateSubtext}>
            Select an action above to view or contribute to this deal.
          </Text>
        </View>
      </Card>
    </ScreenContainer>
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
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  welcomeText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  stakeholderName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[700],
    textTransform: 'capitalize',
  },
  propertyCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand[500],
  },
  propertyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  propertyAddress: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  propertyCity: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: (SCREEN_WIDTH - spacing.md * 3) / 2,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  infoCard: {
    marginTop: spacing.md,
  },

  // Back button
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  viewTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },

  // Details view
  detailsCard: {
    marginBottom: spacing.md,
  },
  detailsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[50],
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    flex: 1,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    flex: 2,
    textAlign: 'right',
  },
  stageBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  stageBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.brand[700],
    textTransform: 'capitalize',
  },

  // Photo gallery
  photoGrid: {
    paddingBottom: spacing.xl,
  },
  photoThumb: {
    width: (SCREEN_WIDTH - spacing.md * 3) / 2,
    margin: spacing.xs,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.slate[100],
  },
  photoThumbImage: {
    width: '100%',
    aspectRatio: 1,
  },
  photoCaption: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    padding: spacing.xs,
    backgroundColor: colors.white,
  },

  // Photo modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: spacing.md,
  },
  modalCloseText: {
    fontSize: 28,
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  modalImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },

  // Upload view
  uploadContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.slate[50],
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  uploadIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  uploadText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  uploadButton: {
    minWidth: 160,
  },

  // Comments
  commentsContainer: {
    flex: 1,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
  },
  commentSubmitButton: {
    backgroundColor: colors.brand[500],
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSubmitDisabled: {
    backgroundColor: colors.slate[300],
  },
  commentSubmitText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  commentsList: {
    flex: 1,
    padding: spacing.md,
  },
  commentItem: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  commentAuthor: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  commentDate: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  commentContent: {
    fontSize: typography.fontSize.base,
    color: colors.slate[700],
    lineHeight: 22,
  },
})
