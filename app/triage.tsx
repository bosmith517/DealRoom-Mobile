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
  ScrollView,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii } from '../src/theme';
import {
  getTriageLeads,
  getTriageChannelCounts,
  handleSwipeAction,
  undoSwipeAction,
  TriageLead,
  TriageChannel,
  TriageChannelCount,
} from '../src/services';
import { useFeatureGate } from '../src/hooks/useFeatureGate';
import { SwipeTutorial, shouldShowTutorial } from '../src/components/SwipeTutorial';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 250;

// Helper to get source display info
const getSourceDisplay = (source?: string): { icon: string; label: string; color: string } => {
  switch (source) {
    case 'driving':
      return { icon: '🚗', label: 'Driving', color: colors.brand[600] };
    case 'list_import':
    case 'list':
      return { icon: '📋', label: 'List', color: '#8B5CF6' };
    case 'distress_alert':
    case 'alert':
      return { icon: '🚨', label: 'Alert', color: '#EF4444' };
    case 'manual':
    default:
      return { icon: '✏️', label: 'Manual', color: colors.slate[500] };
  }
};

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
  onTap: () => void;
}

function SwipeCard({ lead, isFirst, onSwipe, onTap }: SwipeCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const [showDismissReasons, setShowDismissReasons] = useState(false);

  // Use a ref to track the current isFirst value so the PanResponder always has access to it
  const isFirstRef = useRef(isFirst);
  useEffect(() => {
    isFirstRef.current = isFirst;
  }, [isFirst]);

  // Track tap vs swipe
  const gestureStartTime = useRef(0);
  const TAP_THRESHOLD = 10; // Max movement for a tap
  const TAP_DURATION = 200; // Max duration for a tap in ms

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isFirstRef.current,
      onPanResponderGrant: () => {
        gestureStartTime.current = Date.now();
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        const gestureDuration = Date.now() - gestureStartTime.current;
        const absX = Math.abs(gesture.dx);
        const absY = Math.abs(gesture.dy);

        // Check if it's a tap (minimal movement, short duration)
        if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD && gestureDuration < TAP_DURATION) {
          onTap();
          return;
        }

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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
  const sourceInfo = getSourceDisplay((lead as any).source);

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

          {/* Source badge */}
          <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color }]}>
            <Text style={styles.sourceBadgeIcon}>{sourceInfo.icon}</Text>
            <Text style={styles.sourceBadgeText}>{sourceInfo.label}</Text>
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

// Undo state type
interface UndoState {
  lead: TriageLead;
  direction: 'left' | 'right' | 'up' | 'down';
  reason?: string;
  previousState: {
    triage_status: string;
    priority: string;
    dismiss_reason?: string | null;
  };
}

// Constants
const UNDO_TIMEOUT = 5000; // 5 seconds to undo
const PREFETCH_THRESHOLD = 10; // Fetch more when <= 10 leads remain

export default function TriageScreen() {
  const router = useRouter();
  const { canTriage, isLoading: featureLoading } = useFeatureGate();
  const [leads, setLeads] = useState<TriageLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ kept: 0, passed: 0, watched: 0 });
  const [selectedChannel, setSelectedChannel] = useState<TriageChannel>('all');
  const [channelCounts, setChannelCounts] = useState<TriageChannelCount[]>([]);

  // Undo state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pass button dismiss modal state
  const [showPassModal, setShowPassModal] = useState(false);

  // Pre-fetch tracking
  const [isFetching, setIsFetching] = useState(false);
  const totalLeadsRef = useRef(0);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);

  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Feature gate - Swipe Triage requires Starter tier or higher
  useEffect(() => {
    if (!featureLoading && !canTriage) {
      Alert.alert(
        'Feature Not Available',
        'Swipe Triage is not included in your current plan. Contact support for assistance.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [featureLoading, canTriage, router]);

  if (!featureLoading && !canTriage) {
    return null;
  }

  const fetchChannelCounts = useCallback(async () => {
    try {
      const counts = await getTriageChannelCounts();
      setChannelCounts(counts);
    } catch (error) {
      console.error('Error fetching channel counts:', error);
    }
  }, []);

  const fetchLeads = useCallback(async (channel: TriageChannel = selectedChannel, append = false) => {
    if (!append) setLoading(true);
    setIsFetching(true);
    try {
      const data = await getTriageLeads({ limit: 50, channel });
      if (append) {
        // Append new leads, filtering out duplicates
        setLeads((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const newLeads = data.filter((l) => !existingIds.has(l.id));
          return [...prev, ...newLeads];
        });
      } else {
        setLeads(data);
        totalLeadsRef.current = data.length;
      }
    } catch (error) {
      console.error('Error fetching triage leads:', error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [selectedChannel]);

  const handleChannelChange = (channel: TriageChannel) => {
    Haptics.selectionAsync();
    setSelectedChannel(channel);
    setStats({ kept: 0, passed: 0, watched: 0 }); // Reset stats for new channel
    fetchLeads(channel);
  };

  useEffect(() => {
    fetchLeads();
    fetchChannelCounts();

    // Check if we should show the tutorial
    shouldShowTutorial().then((shouldShow) => {
      if (shouldShow) {
        setShowTutorial(true);
      }
    });
  }, []);

  // Pre-fetch when running low on leads
  useEffect(() => {
    if (leads.length > 0 && leads.length <= PREFETCH_THRESHOLD && !isFetching && !loading) {
      console.log(`Pre-fetching more leads (${leads.length} remaining)`);
      fetchLeads(selectedChannel, true);
    }
  }, [leads.length, isFetching, loading, selectedChannel, fetchLeads]);

  // Clear undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // Refresh counts after each swipe
  const refreshCounts = useCallback(() => {
    fetchChannelCounts();
  }, [fetchChannelCounts]);

  // Handle undo action
  const handleUndo = useCallback(async () => {
    if (!undoState) return;

    // Clear the timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Restore the lead to the front of the deck
    setLeads((prev) => [undoState.lead, ...prev]);

    // Revert stats
    setStats((prev) => ({
      kept: prev.kept - (undoState.direction === 'right' || undoState.direction === 'down' ? 1 : 0),
      passed: prev.passed - (undoState.direction === 'left' ? 1 : 0),
      watched: prev.watched - (undoState.direction === 'up' ? 1 : 0),
    }));

    // Restore in database
    try {
      await undoSwipeAction(undoState.lead.id, undoState.previousState);
      refreshCounts();
    } catch (error) {
      console.error('Error undoing swipe:', error);
    }

    setUndoState(null);
  }, [undoState, refreshCounts]);

  const handleSwipe = async (direction: 'left' | 'right' | 'up' | 'down', reason?: string) => {
    if (leads.length === 0) return;

    const currentLead = leads[0];
    setProcessing(true);

    // Store previous state for undo
    const previousState = {
      triage_status: (currentLead as any).triage_status || 'new',
      priority: (currentLead as any).priority || 'normal',
      dismiss_reason: (currentLead as any).dismiss_reason || null,
    };

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

      // Store undo state
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      setUndoState({ lead: currentLead, direction, reason, previousState });

      // Auto-clear undo after timeout
      undoTimerRef.current = setTimeout(() => {
        setUndoState(null);
      }, UNDO_TIMEOUT);

      // Refresh channel counts in background
      refreshCounts();
    } catch (error) {
      console.error('Error handling swipe:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleButtonSwipe = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (leads.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // For left (pass) button, show dismiss reason modal
    if (direction === 'left') {
      setShowPassModal(true);
      return;
    }

    handleSwipe(direction);
  };

  // Handle pass button dismiss reason selection
  const handlePassButtonReason = (reason: string) => {
    setShowPassModal(false);
    handleSwipe('left', reason);
  };

  // Navigate to lead detail
  const handleCardTap = (lead: TriageLead) => {
    Haptics.selectionAsync();
    router.push(`/lead/${lead.id}`);
  };

  // Batch mode handlers
  const toggleBatchMode = () => {
    Haptics.selectionAsync();
    setIsBatchMode(!isBatchMode);
    setSelectedLeadIds(new Set()); // Clear selections when toggling
  };

  const toggleLeadSelection = (leadId: string) => {
    Haptics.selectionAsync();
    setSelectedLeadIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(leadId)) {
        updated.delete(leadId);
      } else {
        updated.add(leadId);
      }
      return updated;
    });
  };

  const selectAllLeads = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLeadIds(new Set(leads.map((l) => l.id)));
  };

  const deselectAllLeads = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLeadIds(new Set());
  };

  const handleBatchAction = async (direction: 'left' | 'right' | 'up' | 'down', reason?: string) => {
    if (selectedLeadIds.size === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessing(true);

    const selectedIds = Array.from(selectedLeadIds);

    try {
      // Process all selected leads
      for (const leadId of selectedIds) {
        await handleSwipeAction(leadId, direction, reason);
      }

      // Update stats based on action
      const count = selectedIds.length;
      setStats((prev) => ({
        kept: prev.kept + (direction === 'right' || direction === 'down' ? count : 0),
        passed: prev.passed + (direction === 'left' ? count : 0),
        watched: prev.watched + (direction === 'up' ? count : 0),
      }));

      // Remove processed leads from deck
      setLeads((prev) => prev.filter((l) => !selectedLeadIds.has(l.id)));

      // Clear selections and exit batch mode
      setSelectedLeadIds(new Set());
      setIsBatchMode(false);

      // Refresh channel counts
      refreshCounts();
    } catch (error) {
      console.error('Error processing batch action:', error);
    } finally {
      setProcessing(false);
    }
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
          <Text style={styles.headerTitle}>{isBatchMode ? 'Batch Mode' : 'Triage'}</Text>
          <Text style={styles.headerSubtitle}>
            {isBatchMode
              ? `${selectedLeadIds.size} of ${leads.length} selected`
              : channelCounts.find(c => c.channel === selectedChannel)?.label || 'All Leads'}
          </Text>
        </View>
        <View style={styles.headerRightButtons}>
          {leads.length > 1 && (
            <Pressable
              onPress={toggleBatchMode}
              style={[styles.batchToggle, isBatchMode && styles.batchToggleActive]}
            >
              <Ionicons
                name={isBatchMode ? 'close' : 'checkbox-outline'}
                size={20}
                color={isBatchMode ? colors.white : colors.ink}
              />
            </Pressable>
          )}
          {!isBatchMode && (
            <Pressable onPress={() => fetchLeads()} style={styles.refreshButton}>
              <Ionicons name="refresh" size={24} color={colors.ink} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Channel Picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.channelStrip}
        contentContainerStyle={styles.channelStripContent}
      >
        {channelCounts.map((channel) => {
          const isSelected = selectedChannel === channel.channel;
          const hasLeads = channel.count > 0;
          return (
            <Pressable
              key={channel.channel}
              style={[
                styles.channelChip,
                isSelected && styles.channelChipSelected,
                !hasLeads && styles.channelChipEmpty,
              ]}
              onPress={() => handleChannelChange(channel.channel)}
              disabled={!hasLeads && channel.channel !== 'all'}
            >
              <Text style={styles.channelIcon}>{channel.icon}</Text>
              <Text
                style={[
                  styles.channelLabel,
                  isSelected && styles.channelLabelSelected,
                  !hasLeads && styles.channelLabelEmpty,
                ]}
              >
                {channel.label}
              </Text>
              <View
                style={[
                  styles.channelCount,
                  isSelected && styles.channelCountSelected,
                ]}
              >
                <Text
                  style={[
                    styles.channelCountText,
                    isSelected && styles.channelCountTextSelected,
                  ]}
                >
                  {channel.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

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

      {/* Card stack or Batch list */}
      <View style={styles.cardStack}>
        {leads.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={selectedChannel === 'driving' ? 'car' :
                    selectedChannel === 'list_import' ? 'document-text' :
                    selectedChannel === 'distress' ? 'alert-circle' :
                    selectedChannel === 'watch_list' ? 'eye' :
                    'checkmark-circle'}
              size={80}
              color={colors.brand[600]}
            />
            <Text style={styles.emptyTitle}>
              {selectedChannel === 'all' ? 'All caught up!' :
               selectedChannel === 'driving' ? 'No driving leads' :
               selectedChannel === 'list_import' ? 'No list imports' :
               selectedChannel === 'distress' ? 'No distress alerts' :
               selectedChannel === 'watch_list' ? 'Watch list empty' :
               'No manual leads'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedChannel === 'all' ? 'No more properties to triage.\nGo drive for more!' :
               selectedChannel === 'driving' ? 'Go out and capture some properties!\nThey\'ll appear here for review.' :
               selectedChannel === 'list_import' ? 'Import a list from the web app\nto populate this channel.' :
               selectedChannel === 'distress' ? 'No distress signals detected.\nCheck back later for alerts.' :
               selectedChannel === 'watch_list' ? 'Swipe up on leads to add\nthem to your watch list.' :
               'Add leads manually from\nthe property search.'}
            </Text>
            {(selectedChannel === 'all' || selectedChannel === 'driving') && (
              <Pressable style={styles.driveButton} onPress={() => router.push('/drive')}>
                <Ionicons name="car" size={20} color="white" />
                <Text style={styles.driveButtonText}>Start Driving</Text>
              </Pressable>
            )}
            {selectedChannel !== 'all' && selectedChannel !== 'driving' && (
              <Pressable
                style={[styles.driveButton, { backgroundColor: colors.slate[600] }]}
                onPress={() => handleChannelChange('all')}
              >
                <Ionicons name="layers" size={20} color="white" />
                <Text style={styles.driveButtonText}>View All Leads</Text>
              </Pressable>
            )}
          </View>
        ) : isBatchMode ? (
          /* Batch selection list */
          <ScrollView style={styles.batchList} showsVerticalScrollIndicator={false}>
            {/* Select All / Deselect All buttons */}
            <View style={styles.batchSelectHeader}>
              <Pressable
                style={styles.batchSelectButton}
                onPress={selectedLeadIds.size === leads.length ? deselectAllLeads : selectAllLeads}
              >
                <Ionicons
                  name={selectedLeadIds.size === leads.length ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.brand[600]}
                />
                <Text style={styles.batchSelectButtonText}>
                  {selectedLeadIds.size === leads.length ? 'Deselect All' : 'Select All'}
                </Text>
              </Pressable>
            </View>

            {leads.map((lead) => {
              const isSelected = selectedLeadIds.has(lead.id);
              const sourceInfo = getSourceDisplay((lead as any).source);
              return (
                <Pressable
                  key={lead.id}
                  style={[styles.batchItem, isSelected && styles.batchItemSelected]}
                  onPress={() => toggleLeadSelection(lead.id)}
                >
                  <View style={styles.batchCheckbox}>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? colors.brand[600] : colors.slate[400]}
                    />
                  </View>
                  <View style={styles.batchItemContent}>
                    <Text style={styles.batchItemAddress} numberOfLines={1}>
                      {lead.address || 'Unknown address'}
                    </Text>
                    <View style={styles.batchItemMeta}>
                      <Text style={styles.batchItemScore}>
                        Score: {Math.round(lead.rank_score || 0)}
                      </Text>
                      <Text style={[styles.batchItemSource, { color: sourceInfo.color }]}>
                        {sourceInfo.icon} {sourceInfo.label}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          leads.slice(0, 3).map((lead, index) => (
            <SwipeCard
              key={lead.id}
              lead={lead}
              isFirst={index === 0}
              onSwipe={handleSwipe}
              onTap={() => handleCardTap(lead)}
            />
          )).reverse()
        )}

        {/* Floating Undo Button */}
        {undoState && (
          <Pressable style={styles.undoButton} onPress={handleUndo}>
            <Ionicons name="arrow-undo" size={20} color="white" />
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        )}

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color="white" />
          </View>
        )}
      </View>

      {/* Bottom action buttons (fallback for non-swipe users) */}
      {leads.length > 0 && !isBatchMode && (
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

      {/* Batch action bar */}
      {isBatchMode && selectedLeadIds.size > 0 && (
        <View style={styles.batchActionBar}>
          <Pressable
            style={[styles.batchActionButton, { backgroundColor: SWIPE_COLORS.left }]}
            onPress={() => handleBatchAction('left', 'batch_dismiss')}
            disabled={processing}
          >
            <Ionicons name="close" size={24} color="white" />
            <Text style={styles.batchActionText}>Pass All</Text>
          </Pressable>

          <Pressable
            style={[styles.batchActionButton, { backgroundColor: SWIPE_COLORS.up }]}
            onPress={() => handleBatchAction('up')}
            disabled={processing}
          >
            <Ionicons name="eye" size={24} color="white" />
            <Text style={styles.batchActionText}>Watch All</Text>
          </Pressable>

          <Pressable
            style={[styles.batchActionButton, { backgroundColor: SWIPE_COLORS.right }]}
            onPress={() => handleBatchAction('right')}
            disabled={processing}
          >
            <Ionicons name="analytics" size={24} color="white" />
            <Text style={styles.batchActionText}>Analyze All</Text>
          </Pressable>
        </View>
      )}

      {/* Pass Button Dismiss Modal */}
      {showPassModal && (
        <View style={styles.passModalOverlay}>
          <View style={styles.passModal}>
            <Text style={styles.passModalTitle}>Why are you passing?</Text>
            {DISMISS_REASONS.map((reason) => (
              <Pressable
                key={reason.id}
                style={styles.passModalOption}
                onPress={() => handlePassButtonReason(reason.id)}
              >
                <Text style={styles.passModalOptionText}>{reason.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.passModalCancel}
              onPress={() => setShowPassModal(false)}
            >
              <Text style={styles.passModalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Progress indicator */}
      {leads.length > 0 && totalLeadsRef.current > 0 && (
        <View style={styles.progressIndicator}>
          <Text style={styles.progressText}>
            {stats.kept + stats.passed + stats.watched} of {totalLeadsRef.current} reviewed
          </Text>
        </View>
      )}

      {/* First-time user tutorial */}
      {showTutorial && (
        <SwipeTutorial onComplete={() => setShowTutorial(false)} />
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
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  batchToggle: {
    padding: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.slate[100],
  },
  batchToggleActive: {
    backgroundColor: colors.brand[600],
  },
  channelStrip: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    maxHeight: 56,
  },
  channelStripContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  channelChipSelected: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  channelChipEmpty: {
    opacity: 0.5,
  },
  channelIcon: {
    fontSize: 16,
  },
  channelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate[700],
  },
  channelLabelSelected: {
    color: 'white',
  },
  channelLabelEmpty: {
    color: colors.slate[400],
  },
  channelCount: {
    backgroundColor: colors.slate[200],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    minWidth: 22,
    alignItems: 'center',
  },
  channelCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  channelCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate[600],
  },
  channelCountTextSelected: {
    color: 'white',
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
    height: '65%',
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
  sourceBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sourceBadgeIcon: {
    fontSize: 12,
  },
  sourceBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  infoSection: {
    flex: 1,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  address: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 20,
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
  // Undo button styles
  undoButton: {
    position: 'absolute',
    bottom: -60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.slate[800],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  undoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Pass modal styles
  passModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  passModal: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    backgroundColor: 'white',
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  passModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  passModalOption: {
    padding: spacing.md,
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  passModalOptionText: {
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  passModalCancel: {
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  passModalCancelText: {
    fontSize: 16,
    color: colors.slate[500],
    textAlign: 'center',
  },
  // Progress indicator styles
  progressIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  progressText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Batch mode styles
  batchList: {
    flex: 1,
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  batchSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  batchSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand[50],
    borderRadius: radii.full,
  },
  batchSelectButtonText: {
    color: colors.brand[600],
    fontSize: 14,
    fontWeight: '600',
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  batchItemSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  batchCheckbox: {
    marginRight: spacing.md,
  },
  batchItemContent: {
    flex: 1,
  },
  batchItemAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
  },
  batchItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  batchItemScore: {
    fontSize: 13,
    color: colors.slate[500],
  },
  batchItemSource: {
    fontSize: 12,
    fontWeight: '500',
  },
  batchActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
  },
  batchActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    minWidth: 100,
  },
  batchActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
