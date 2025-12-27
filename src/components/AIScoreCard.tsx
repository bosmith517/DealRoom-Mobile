/**
 * AIScoreCard Component
 *
 * Displays AI job status, score, and cost for a lead or deal.
 * Shows pending/running jobs, completion status, and total AI processing cost.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography, radii } from '../theme'
import { supabase } from '../lib/supabase'
import { triggerAIJobProcessing } from '../services'

// ============================================================================
// Types
// ============================================================================

interface AIJob {
  id: string
  job_type: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  cost_estimate?: number
  result?: Record<string, unknown>
  error_message?: string
  created_at: string
  completed_at?: string
}

interface AIScoreCardProps {
  leadId?: string
  dealId?: string
  showTrigger?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function AIScoreCard({
  leadId,
  dealId,
  showTrigger = true,
}: AIScoreCardProps) {
  const [jobs, setJobs] = useState<AIJob[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      let query = supabase
        .from('dealroom_ai_jobs')
        .select('id, job_type, status, cost_estimate, result, error_message, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (leadId) {
        query = query.eq('subject_id', leadId).eq('subject_type', 'lead')
      } else if (dealId) {
        query = query.eq('subject_id', dealId).eq('subject_type', 'deal')
      } else {
        setJobs([])
        setLoading(false)
        return
      }

      const { data, error } = await query

      if (error) {
        console.warn('Error fetching AI jobs:', error)
      } else {
        setJobs(data || [])
      }
    } catch (err) {
      console.error('Error fetching AI jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId, dealId])

  useEffect(() => {
    fetchJobs()

    // Poll for updates if there are pending/running jobs
    const interval = setInterval(() => {
      if (jobs.some(j => j.status === 'queued' || j.status === 'running')) {
        fetchJobs()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchJobs, jobs])

  const handleTriggerProcessing = useCallback(async () => {
    setTriggering(true)
    try {
      await triggerAIJobProcessing()
      // Refresh jobs after triggering
      setTimeout(fetchJobs, 1000)
    } catch (err) {
      console.error('Error triggering AI processing:', err)
    } finally {
      setTriggering(false)
    }
  }, [fetchJobs])

  // Calculate totals
  const totalCost = jobs.reduce((sum, job) => sum + (job.cost_estimate || 0), 0)
  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const pendingJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length

  // Get AI score from scoring job
  const scoringJob = jobs.find(j => j.job_type === 'score_candidate' && j.status === 'completed')
  const aiScore = scoringJob?.result?.score as number | undefined

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading AI status...</Text>
        </View>
      </View>
    )
  }

  // No jobs yet
  if (jobs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Ionicons name="sparkles-outline" size={18} color={colors.slate[400]} />
          <Text style={styles.headerTitle}>AI Analysis</Text>
        </View>
        <Text style={styles.emptyText}>No AI jobs have been run yet.</Text>
        {showTrigger && (
          <TouchableOpacity
            style={styles.triggerButton}
            onPress={handleTriggerProcessing}
            disabled={triggering}
          >
            {triggering ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="play" size={14} color={colors.white} />
                <Text style={styles.triggerButtonText}>Run AI Analysis</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={18} color={colors.brand[500]} />
        <Text style={styles.headerTitle}>AI Analysis</Text>
        {pendingJobs > 0 && (
          <View style={styles.pendingBadge}>
            <ActivityIndicator size="small" color={colors.warning[600]} />
            <Text style={styles.pendingBadgeText}>{pendingJobs} pending</Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* AI Score */}
        {aiScore !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>AI Score</Text>
            <View style={[
              styles.scoreCircle,
              aiScore >= 70 ? styles.scoreHigh : aiScore >= 40 ? styles.scoreMedium : styles.scoreLow
            ]}>
              <Text style={styles.scoreValue}>{aiScore}</Text>
            </View>
          </View>
        )}

        {/* Jobs Completed */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Jobs</Text>
          <Text style={styles.statValue}>
            {completedJobs}/{jobs.length}
          </Text>
        </View>

        {/* Total Cost */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cost</Text>
          <Text style={styles.statValue}>
            ${totalCost.toFixed(4)}
          </Text>
        </View>
      </View>

      {/* Failed Jobs Warning */}
      {failedJobs > 0 && (
        <View style={styles.warningRow}>
          <Ionicons name="warning" size={14} color={colors.error[600]} />
          <Text style={styles.warningText}>
            {failedJobs} job{failedJobs > 1 ? 's' : ''} failed
          </Text>
        </View>
      )}

      {/* Job List */}
      <View style={styles.jobList}>
        {jobs.slice(0, 5).map((job) => (
          <View key={job.id} style={styles.jobRow}>
            <View style={styles.jobInfo}>
              {job.status === 'queued' && (
                <Ionicons name="time-outline" size={14} color={colors.slate[400]} />
              )}
              {job.status === 'running' && (
                <ActivityIndicator size="small" color={colors.brand[500]} />
              )}
              {job.status === 'completed' && (
                <Ionicons name="checkmark-circle" size={14} color={colors.success[500]} />
              )}
              {job.status === 'failed' && (
                <Ionicons name="close-circle" size={14} color={colors.error[500]} />
              )}
              <Text style={styles.jobType}>
                {formatJobType(job.job_type)}
              </Text>
            </View>
            {job.cost_estimate && job.cost_estimate > 0 && (
              <Text style={styles.jobCost}>${job.cost_estimate.toFixed(4)}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Trigger Button */}
      {showTrigger && pendingJobs > 0 && (
        <TouchableOpacity
          style={styles.triggerButtonSmall}
          onPress={handleTriggerProcessing}
          disabled={triggering}
        >
          {triggering ? (
            <ActivityIndicator size="small" color={colors.brand[500]} />
          ) : (
            <>
              <Ionicons name="refresh" size={14} color={colors.brand[500]} />
              <Text style={styles.triggerButtonSmallText}>Process Queue</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatJobType(type: string): string {
  const labels: Record<string, string> = {
    score_candidate: 'Scoring',
    underwrite_snapshot: 'Underwriting',
    comp_select: 'Comp Selection',
    repair_estimate: 'Repair Estimate',
    outreach_draft: 'Outreach Draft',
    portal_summary: 'Portal Summary',
    intel_enrich: 'Property Intel',
    skip_trace: 'Skip Trace',
    attom_enrich: 'Property Data',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    padding: spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  scoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreHigh: {
    backgroundColor: colors.success[100],
  },
  scoreMedium: {
    backgroundColor: colors.warning[100],
  },
  scoreLow: {
    backgroundColor: colors.slate[100],
  },
  scoreValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
  },
  jobList: {
    gap: spacing.xs,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobType: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  jobCost: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand[500],
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  triggerButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
  triggerButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  triggerButtonSmallText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.medium,
  },
})

export default AIScoreCard
