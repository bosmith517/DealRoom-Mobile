/**
 * Analyze Queue Screen
 *
 * Properties that have been swiped-right and are awaiting deeper underwriting.
 * - Shows queued properties grouped by priority
 * - One-tap "Run Analysis" to pull ATTOM + comps + generate snapshot
 * - Convert to Deal when ready
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../src/theme';
import { SkipTraceButton } from '../src/components';
import {
  getAnalyzeQueue,
  runQuickAnalysis,
  convertLeadToDeal,
  AnalyzeQueueItem,
  AnalysisSnapshot,
} from '../src/services';

// Priority sections
const PRIORITY_SECTIONS = [
  { key: 'hot', label: 'Hot', icon: 'flame', color: '#EF4444' },
  { key: 'high', label: 'High Priority', icon: 'arrow-up-circle', color: '#F59E0B' },
  { key: 'normal', label: 'Review', icon: 'document-text', color: '#3B82F6' },
  { key: 'low', label: 'Low Priority', icon: 'time', color: colors.slate[400] },
] as const;

interface QueueCardProps {
  item: AnalyzeQueueItem;
  onAnalyze: () => void;
  onConvert: () => void;
  onView: () => void;
  analyzing: boolean;
}

function QueueCard({ item, onAnalyze, onConvert, onView, analyzing }: QueueCardProps) {
  const lead = item.lead;
  const snapshot = item.snapshot;
  const hasSnapshot = snapshot && Object.keys(snapshot.snapshot || {}).length > 0;

  return (
    <Pressable style={styles.card} onPress={onView}>
      <View style={styles.cardRow}>
        {/* Photo thumbnail */}
        <View style={styles.thumbnail}>
          {lead?.photo_url ? (
            <Image source={{ uri: lead.photo_url }} style={styles.thumbnailImage} />
          ) : (
            <Ionicons name="home" size={24} color={colors.slate[400]} />
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {lead?.address || 'Unknown address'}
          </Text>
          <Text style={styles.cardCity}>
            {lead?.city ? `${lead.city}, ${lead.state}` : 'Location unknown'}
          </Text>

          {/* Tags */}
          <View style={styles.tagsRow}>
            {(lead?.tags || []).slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.miniTag}>
                <Text style={styles.miniTagText}>{tag.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>

          {/* Status indicators */}
          <View style={styles.statusRow}>
            {/* Litigator warning */}
            {(lead as any)?.is_litigator && (
              <View style={[styles.statusBadge, styles.litigatorBadge]}>
                <Ionicons name="warning" size={14} color="#DC2626" />
                <Text style={[styles.statusText, { color: '#DC2626' }]}>Litigator</Text>
              </View>
            )}
            {item.status === 'fetching' && (
              <View style={styles.statusBadge}>
                <ActivityIndicator size="small" color={colors.brand[600]} />
                <Text style={styles.statusText}>Analyzing...</Text>
              </View>
            )}
            {item.status === 'ready' && hasSnapshot && (
              <View style={[styles.statusBadge, { backgroundColor: colors.brand[100] }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.brand[600]} />
                <Text style={[styles.statusText, { color: colors.brand[700] }]}>Ready</Text>
              </View>
            )}
            {item.status === 'failed' && (
              <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={14} color="#DC2626" />
                <Text style={[styles.statusText, { color: '#DC2626' }]}>Failed</Text>
              </View>
            )}
            {/* Skip trace indicator */}
            {(lead as any)?.skip_traced_at && (
              <View style={[styles.statusBadge, { backgroundColor: colors.success[100] }]}>
                <Ionicons name="person-circle" size={14} color={colors.success[600]} />
                <Text style={[styles.statusText, { color: colors.success[700] }]}>Traced</Text>
              </View>
            )}
          </View>
        </View>

        {/* Score badge */}
        <View style={[styles.scoreBadge, {
          backgroundColor: (lead?.rank_score || 0) >= 70 ? '#EF4444' :
            (lead?.rank_score || 0) >= 40 ? '#F59E0B' :
              colors.brand[600]
        }]}>
          <Text style={styles.scoreText}>{Math.round(lead?.rank_score || 0)}</Text>
        </View>
      </View>

      {/* Quick snapshot preview if available */}
      {hasSnapshot && snapshot?.snapshot && (
        <View style={styles.snapshotPreview}>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>ARV</Text>
              <Text style={styles.snapshotValue}>
                ${formatNumber(snapshot.snapshot.arv_low || 0)}-${formatNumber(snapshot.snapshot.arv_high || 0)}
              </Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Equity</Text>
              <Text style={styles.snapshotValue}>
                {snapshot.snapshot.equity_percent ? `${snapshot.snapshot.equity_percent}%` : 'N/A'}
              </Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>MAO</Text>
              <Text style={styles.snapshotValue}>
                ${formatNumber(snapshot.snapshot.mao_flip || snapshot.snapshot.mao_wholesale || 0)}
              </Text>
            </View>
          </View>

          {/* AI Summary */}
          {snapshot.ai_summary && (
            <Text style={styles.aiSummary} numberOfLines={2}>
              {snapshot.ai_summary}
            </Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.cardActions}>
        {item.status === 'queued' && (
          <Pressable
            style={[styles.actionBtn, styles.analyzeBtn]}
            onPress={onAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="analytics" size={16} color="white" />
                <Text style={styles.actionBtnText}>Run Analysis</Text>
              </>
            )}
          </Pressable>
        )}

        {(item.status === 'ready' || hasSnapshot) && (
          <Pressable style={[styles.actionBtn, styles.convertBtn]} onPress={onConvert}>
            <Ionicons name="add-circle" size={16} color="white" />
            <Text style={styles.actionBtnText}>Make Deal</Text>
          </Pressable>
        )}

        {item.status === 'failed' && (
          <Pressable
            style={[styles.actionBtn, styles.retryBtn]}
            onPress={onAnalyze}
            disabled={analyzing}
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.actionBtnText}>Retry</Text>
          </Pressable>
        )}

        {/* Skip trace button - show if not yet traced */}
        {lead?.id && !(lead as any)?.skip_traced_at && (
          <View style={styles.skipTraceAction}>
            <SkipTraceButton
              leadId={lead.id}
              variant="icon"
            />
          </View>
        )}

        <Pressable style={[styles.actionBtn, styles.skipBtn]} onPress={onView}>
          <Ionicons name="eye" size={16} color={colors.slate[600]} />
          <Text style={[styles.actionBtnText, { color: colors.slate[600] }]}>View</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${Math.round(num / 1000)}k`;
  return num.toString();
}

export default function AnalyzeQueueScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<AnalyzeQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getAnalyzeQueue();
      setQueue(data);
    } catch (error) {
      console.error('Error fetching analyze queue:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleAnalyze = async (item: AnalyzeQueueItem) => {
    if (!item.lead_id) return;

    setAnalyzingId(item.id);
    try {
      await runQuickAnalysis(item.lead_id);
      // Refresh to get updated snapshot
      await fetchQueue();
    } catch (error) {
      console.error('Error running analysis:', error);
      Alert.alert('Analysis Failed', 'Could not complete the analysis. Please try again.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleConvert = async (item: AnalyzeQueueItem) => {
    if (!item.lead_id) return;

    Alert.alert(
      'Convert to Deal',
      'This will create a new deal from this lead and add it to your pipeline.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Deal',
          onPress: async () => {
            try {
              const deal = await convertLeadToDeal(item.lead_id!);
              if (deal?.id) {
                router.push(`/property/${deal.id}`);
              }
            } catch (error) {
              console.error('Error converting lead:', error);
              Alert.alert('Error', 'Could not create deal. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleView = (item: AnalyzeQueueItem) => {
    if (item.lead_id) {
      router.push(`/lead/${item.lead_id}`);
    }
  };

  const handleAnalyzeAll = async () => {
    const queuedItems = queue.filter((i) => i.status === 'queued' && i.lead_id);
    if (queuedItems.length === 0) return;

    Alert.alert(
      'Batch Analysis',
      `This will analyze ${queuedItems.length} properties. This may take a few minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Analysis',
          onPress: async () => {
            setBatchAnalyzing(true);
            setBatchProgress({ current: 0, total: queuedItems.length });

            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < queuedItems.length; i++) {
              const item = queuedItems[i];
              setBatchProgress({ current: i + 1, total: queuedItems.length });
              setAnalyzingId(item.id);

              try {
                await runQuickAnalysis(item.lead_id!);
                successCount++;
              } catch (error) {
                console.error(`Analysis failed for ${item.lead_id}:`, error);
                failCount++;
              }

              // Small delay between analyses to avoid overwhelming the API
              if (i < queuedItems.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }

            setAnalyzingId(null);
            setBatchAnalyzing(false);
            setBatchProgress({ current: 0, total: 0 });

            // Refresh the queue
            await fetchQueue();

            // Show results
            if (failCount === 0) {
              Alert.alert('Analysis Complete', `Successfully analyzed ${successCount} properties.`);
            } else {
              Alert.alert(
                'Analysis Complete',
                `Analyzed ${successCount} properties.\n${failCount} failed and can be retried.`
              );
            }
          },
        },
      ]
    );
  };

  // Group by priority
  const groupedQueue = PRIORITY_SECTIONS.map((section) => ({
    ...section,
    items: queue.filter((item) => item.priority === section.key),
  })).filter((section) => section.items.length > 0);

  const totalQueued = queue.filter((i) => i.status === 'queued').length;
  const totalReady = queue.filter((i) => i.status === 'ready').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Loading queue...</Text>
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
          <Text style={styles.headerTitle}>Analyze Queue</Text>
          <Text style={styles.headerSubtitle}>
            {totalQueued} to analyze • {totalReady} ready
          </Text>
        </View>
        <Pressable onPress={fetchQueue} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {/* Batch actions */}
      {totalQueued > 0 && (
        <View style={styles.batchActions}>
          <Pressable
            style={[styles.batchBtn, batchAnalyzing && styles.batchBtnDisabled]}
            onPress={handleAnalyzeAll}
            disabled={batchAnalyzing}
          >
            {batchAnalyzing ? (
              <>
                <ActivityIndicator size="small" color={colors.brand[600]} />
                <Text style={styles.batchBtnText}>
                  Analyzing {batchProgress.current}/{batchProgress.total}...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={18} color={colors.brand[600]} />
                <Text style={styles.batchBtnText}>Analyze All ({totalQueued})</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchQueue} />
        }
      >
        {groupedQueue.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color={colors.slate[300]} />
            <Text style={styles.emptyTitle}>Queue is empty</Text>
            <Text style={styles.emptySubtitle}>
              Swipe right on properties in Triage to add them here
            </Text>
            <Pressable
              style={styles.triageBtn}
              onPress={() => router.push('/triage')}
            >
              <Ionicons name="layers" size={20} color="white" />
              <Text style={styles.triageBtnText}>Go to Triage</Text>
            </Pressable>
          </View>
        ) : (
          groupedQueue.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={section.icon as any}
                  size={18}
                  color={section.color}
                />
                <Text style={[styles.sectionTitle, { color: section.color }]}>
                  {section.label}
                </Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{section.items.length}</Text>
                </View>
              </View>

              {section.items.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onAnalyze={() => handleAnalyze(item)}
                  onConvert={() => handleConvert(item)}
                  onView={() => handleView(item)}
                  analyzing={analyzingId === item.id}
                />
              ))}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  batchActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand[50],
    borderRadius: radii.md,
  },
  batchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand[700],
  },
  batchBtnDisabled: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    backgroundColor: colors.slate[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate[600],
  },
  card: {
    backgroundColor: 'white',
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    backgroundColor: colors.slate[100],
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  cardCity: {
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.xs,
  },
  miniTag: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniTagText: {
    fontSize: 10,
    color: colors.slate[600],
    textTransform: 'capitalize',
  },
  statusRow: {
    marginTop: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: colors.slate[600],
    fontWeight: '500',
  },
  scoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  scoreText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  snapshotPreview: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.md,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snapshotItem: {
    alignItems: 'center',
    flex: 1,
  },
  snapshotLabel: {
    fontSize: 10,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  snapshotValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  aiSummary: {
    fontSize: 12,
    color: colors.slate[600],
    marginTop: spacing.sm,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  analyzeBtn: {
    backgroundColor: colors.brand[600],
  },
  convertBtn: {
    backgroundColor: '#10B981',
  },
  retryBtn: {
    backgroundColor: '#F59E0B',
  },
  skipBtn: {
    backgroundColor: colors.slate[100],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  triageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xl,
  },
  triageBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  litigatorBadge: {
    backgroundColor: '#FEE2E2',
    marginRight: spacing.xs,
  },
  skipTraceAction: {
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.slate[100],
  },
});
