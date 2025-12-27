/**
 * Swipe Triage Screen - "Tinder for Properties"
 *
 * Swipe gestures:
 * - Right = Queue for Analysis
 * - Left = Dismiss
 * - Up = Watch (high priority + 14-day follow-up)
 * - Down = Outreach Queue (hot priority + skip trace task)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Image,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  Vibration,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../src/theme';
import { getTriageLeads, handleSwipeAction, TriageLead } from '../src/services';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 250;

// Swipe action colors
const SWIPE_COLORS = {
  right: '#10B981', // Green - Queue for Analysis
  left: '#EF4444', // Red - Dismiss
  up: '#F59E0B', // Orange - Watch
  down: '#3B82F6', // Blue - Outreach
};

// Dismiss reasons
const DISMISS_REASONS = [
  { id: 'not_area', label: 'Not my area' },
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_distressed', label: 'Not distressed' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'other', label: 'Other' },
];

interface SwipeCardProps {
  lead: TriageLead;
  isFirst: boolean;
  onSwipe: (direction: 'left' | 'right' | 'up' | 'down', reason?: string) => void;
  onDismissReasonRequired: () => void;
}

function SwipeCard({ lead, isFirst, onSwipe, onDismissReasonRequired }: SwipeCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const [showDismissReasons, setShowDismissReasons] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isFirst,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        // Determine swipe direction
        const absX = Math.abs(gesture.dx);
        const absY = Math.abs(gesture.dy);

        if (absX > absY && absX > SWIPE_THRESHOLD) {
          // Horizontal swipe
          const direction = gesture.dx > 0 ? 'right' : 'left';
          if (direction === 'left') {
            // Show dismiss reasons
            setShowDismissReasons(true);
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          } else {
            swipeOut(direction);
          }
        } else if (absY > absX && absY > SWIPE_THRESHOLD) {
          // Vertical swipe
          const direction = gesture.dy > 0 ? 'down' : 'up';
          swipeOut(direction);
        } else {
          // Reset position
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const swipeOut = (direction: 'left' | 'right' | 'up' | 'down', reason?: string) => {
    const x = direction === 'left' ? -SCREEN_WIDTH * 1.5 : direction === 'right' ? SCREEN_WIDTH * 1.5 : 0;
    const y = direction === 'up' ? -SCREEN_HEIGHT : direction === 'down' ? SCREEN_HEIGHT : 0;

    Vibration.vibrate([0, 30]);

    Animated.timing(position, {
      toValue: { x, y },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: false,
    }).start(() => {
      onSwipe(direction, reason);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const handleDismissReason = (reason: string) => {
    setShowDismissReasons(false);
    swipeOut('left', reason);
  };

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const cardStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate },
    ],
  };

  // Overlay opacity based on swipe direction
  const rightOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.8],
    extrapolate: 'clamp',
  });

  const leftOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.8, 0],
    extrapolate: 'clamp',
  });

  const upOpacity = position.y.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.8, 0],
    extrapolate: 'clamp',
  });

  const downOpacity = position.y.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.8],
    extrapolate: 'clamp',
  });

  const distressScore = lead.rank_score || 0;
  const distressReasons = lead.distress_signals || [];

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...(isFirst ? panResponder.panHandlers : {})}
    >
      {/* Swipe direction overlays */}
      <Animated.View style={[styles.overlay, styles.overlayRight, { opacity: rightOpacity }]}>
        <Text style={styles.overlayText}>ANALYZE</Text>
        <Ionicons name="analytics" size={40} color="white" />
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.overlayLeft, { opacity: leftOpacity }]}>
        <Text style={styles.overlayText}>PASS</Text>
        <Ionicons name="close-circle" size={40} color="white" />
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.overlayUp, { opacity: upOpacity }]}>
        <Ionicons name="eye" size={40} color="white" />
        <Text style={styles.overlayText}>WATCH</Text>
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.overlayDown, { opacity: downOpacity }]}>
        <Ionicons name="call" size={40} color="white" />
        <Text style={styles.overlayText}>CONTACT</Text>
      </Animated.View>

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Photo */}
        <View style={styles.photoContainer}>
          {lead.photo_url ? (
            <Image source={{ uri: lead.photo_url }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="home" size={60} color={colors.slate[400]} />
            </View>
          )}

          {/* Distress score badge */}
          <View style={[styles.scoreBadge, {
            backgroundColor: distressScore >= 70 ? '#EF4444' :
              distressScore >= 40 ? '#F59E0B' :
                '#10B981'
          }]}>
            <Text style={styles.scoreText}>{Math.round(distressScore)}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.address} numberOfLines={2}>
            {lead.address || 'Address unknown'}
          </Text>

          {lead.city && (
            <Text style={styles.city}>{lead.city}, {lead.state}</Text>
          )}

          {/* Tags */}
          <View style={styles.tagsRow}>
            {(lead.tags || []).slice(0, 4).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>

          {/* Distress reasons */}
          {distressReasons.length > 0 && (
            <View style={styles.distressBox}>
              <Text style={styles.distressLabel}>Why this surfaced:</Text>
              <Text style={styles.distressReasons}>
                {distressReasons.slice(0, 3).map((r: string) => r.replace('_', ' ')).join(' • ')}
              </Text>
            </View>
          )}

          {/* Notes preview */}
          {lead.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {lead.notes}
            </Text>
          )}

          {/* Captured time */}
          <Text style={styles.timestamp}>
            Captured {formatTimeAgo(lead.created_at)}
          </Text>
        </View>
      </View>

      {/* Dismiss reasons modal */}
      {showDismissReasons && (
        <View style={styles.dismissModal}>
          <Text style={styles.dismissTitle}>Why are you passing?</Text>
          {DISMISS_REASONS.map((reason) => (
            <Pressable
              key={reason.id}
              style={styles.dismissOption}
              onPress={() => handleDismissReason(reason.id)}
            >
              <Text style={styles.dismissOptionText}>{reason.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.dismissCancel}
            onPress={() => {
              setShowDismissReasons(false);
              Animated.spring(position, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
              }).start();
            }}
          >
            <Text style={styles.dismissCancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function TriageScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<TriageLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ kept: 0, passed: 0, watched: 0 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTriageLeads({ limit: 50 });
      setLeads(data);
    } catch (error) {
      console.error('Error fetching triage leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSwipe = async (direction: 'left' | 'right' | 'up' | 'down', reason?: string) => {
    if (leads.length === 0) return;

    const currentLead = leads[0];
    setProcessing(true);

    try {
      await handleSwipeAction(currentLead.id, direction, reason);

      // Update stats
      setStats((prev) => ({
        kept: prev.kept + (direction === 'right' || direction === 'down' ? 1 : 0),
        passed: prev.passed + (direction === 'left' ? 1 : 0),
        watched: prev.watched + (direction === 'up' ? 1 : 0),
      }));

      // Remove card from deck
      setLeads((prev) => prev.slice(1));
    } catch (error) {
      console.error('Error handling swipe:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleButtonSwipe = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (leads.length === 0) return;
    handleSwipe(direction);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Loading properties...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Triage</Text>
          <Text style={styles.headerSubtitle}>{leads.length} properties</Text>
        </View>
        <Pressable onPress={fetchLeads} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.kept}</Text>
          <Text style={styles.statLabel}>Kept</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.passed}</Text>
          <Text style={styles.statLabel}>Passed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.watched}</Text>
          <Text style={styles.statLabel}>Watching</Text>
        </View>
      </View>

      {/* Swipe hints */}
      <View style={styles.hintsContainer}>
        <View style={styles.hintRow}>
          <View style={[styles.hint, { backgroundColor: SWIPE_COLORS.up + '20' }]}>
            <Ionicons name="arrow-up" size={16} color={SWIPE_COLORS.up} />
            <Text style={[styles.hintText, { color: SWIPE_COLORS.up }]}>Watch</Text>
          </View>
        </View>
        <View style={styles.hintRowMiddle}>
          <View style={[styles.hint, { backgroundColor: SWIPE_COLORS.left + '20' }]}>
            <Ionicons name="arrow-back" size={16} color={SWIPE_COLORS.left} />
            <Text style={[styles.hintText, { color: SWIPE_COLORS.left }]}>Pass</Text>
          </View>
          <View style={[styles.hint, { backgroundColor: SWIPE_COLORS.right + '20' }]}>
            <Text style={[styles.hintText, { color: SWIPE_COLORS.right }]}>Analyze</Text>
            <Ionicons name="arrow-forward" size={16} color={SWIPE_COLORS.right} />
          </View>
        </View>
        <View style={styles.hintRow}>
          <View style={[styles.hint, { backgroundColor: SWIPE_COLORS.down + '20' }]}>
            <Ionicons name="arrow-down" size={16} color={SWIPE_COLORS.down} />
            <Text style={[styles.hintText, { color: SWIPE_COLORS.down }]}>Contact</Text>
          </View>
        </View>
      </View>

      {/* Card stack */}
      <View style={styles.cardStack}>
        {leads.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={80} color={colors.brand[600]} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No more properties to triage.{'\n'}Go drive for more!
            </Text>
            <Pressable style={styles.driveButton} onPress={() => router.push('/drive')}>
              <Ionicons name="car" size={20} color="white" />
              <Text style={styles.driveButtonText}>Start Driving</Text>
            </Pressable>
          </View>
        ) : (
          leads.slice(0, 3).map((lead, index) => (
            <SwipeCard
              key={lead.id}
              lead={lead}
              isFirst={index === 0}
              onSwipe={handleSwipe}
              onDismissReasonRequired={() => { }}
            />
          )).reverse()
        )}

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color="white" />
          </View>
        )}
      </View>

      {/* Bottom action buttons (fallback for non-swipe users) */}
      {leads.length > 0 && (
        <View style={styles.actionBar}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: SWIPE_COLORS.left }]}
            onPress={() => handleButtonSwipe('left')}
          >
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.actionButtonSmall, { backgroundColor: SWIPE_COLORS.up }]}
            onPress={() => handleButtonSwipe('up')}
          >
            <Ionicons name="eye" size={22} color="white" />
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.actionButtonSmall, { backgroundColor: SWIPE_COLORS.down }]}
            onPress={() => handleButtonSwipe('down')}
          >
            <Ionicons name="call" size={22} color="white" />
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: SWIPE_COLORS.right }]}
            onPress={() => handleButtonSwipe('right')}
          >
            <Ionicons name="analytics" size={28} color="white" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.slate[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  backButton: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.slate[500],
  },
  refreshButton: {
    padding: spacing.xs,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate[500],
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.slate[200],
  },
  hintsContainer: {
    paddingVertical: spacing.xs,
    gap: 4,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  hintRowMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardStack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - spacing.md * 2,
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: 'white',
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlayRight: {
    backgroundColor: SWIPE_COLORS.right,
  },
  overlayLeft: {
    backgroundColor: SWIPE_COLORS.left,
  },
  overlayUp: {
    backgroundColor: SWIPE_COLORS.up,
  },
  overlayDown: {
    backgroundColor: SWIPE_COLORS.down,
  },
  overlayText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },
  photoContainer: {
    height: '50%',
    backgroundColor: colors.slate[200],
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  scoreText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  infoSection: {
    flex: 1,
    padding: spacing.md,
  },
  address: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 24,
  },
  city: {
    fontSize: 14,
    color: colors.slate[500],
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: {
    fontSize: 12,
    color: colors.brand[700],
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  distressBox: {
    backgroundColor: colors.slate[50],
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  distressLabel: {
    fontSize: 11,
    color: colors.slate[500],
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distressReasons: {
    fontSize: 13,
    color: colors.ink,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  notes: {
    fontSize: 13,
    color: colors.slate[600],
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 12,
    color: colors.slate[400],
    marginTop: 'auto',
  },
  dismissModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: spacing.lg,
    justifyContent: 'center',
    zIndex: 100,
  },
  dismissTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dismissOption: {
    padding: spacing.md,
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  dismissOptionText: {
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  dismissCancel: {
    padding: spacing.md,
    marginTop: spacing.md,
  },
  dismissCancelText: {
    fontSize: 16,
    color: colors.slate[500],
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  driveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xl,
  },
  driveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.lg,
  },
});
