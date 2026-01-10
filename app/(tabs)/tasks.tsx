/**
 * Tasks Tab Screen
 *
 * Shows all followups and tasks organized by urgency.
 * Sections: Overdue (red), Today (blue), Upcoming (gray)
 * Swipe actions: Complete, Snooze
 *
 * Enhanced with:
 * - Better empty state with CTA
 * - Hidden empty sections when no tasks
 * - FAB for creating tasks
 * - Onboarding hint for new users
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Image,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { ScreenContainer } from '../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../src/theme'
import { followupService, type Followup } from '../../src/services'

// Task type icons
const TASK_TYPE_ICONS: Record<string, string> = {
  call: '📞',
  email: '✉️',
  meeting: '📅',
  site_visit: '🏠',
  document: '📄',
  follow_up: '🔔',
  task: '✓',
  other: '📌',
}

// Entity type labels and icons
const ENTITY_TYPE_INFO: Record<string, { label: string; icon: string }> = {
  deal: { label: 'Deal', icon: '🏠' },
  lead: { label: 'Lead', icon: '🎯' },
  contact: { label: 'Contact', icon: '👤' },
  property: { label: 'Property', icon: '📍' },
}

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  urgent: colors.error[500],
  high: colors.warning[500],
  medium: colors.brand[500],
  low: colors.slate[400],
}

// Priority sort order (lower = higher priority)
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Sort tasks by priority (urgent → high → medium → low)
function sortByPriority(tasks: Followup[]): Followup[] {
  return [...tasks].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority] ?? 3
    const priorityB = PRIORITY_ORDER[b.priority] ?? 3
    if (priorityA !== priorityB) return priorityA - priorityB
    // Secondary sort by due date
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date)
    }
    return 0
  })
}

// Section types
type SectionType = 'overdue' | 'today' | 'upcoming'

interface TaskSection {
  title: string
  type: SectionType
  data: Followup[]
  color: string
  emptyMessage: string
}

// Quick snooze options (no Alert)
const SNOOZE_OPTIONS = [
  { label: '1 Hour', value: '1h', icon: '⏰' },
  { label: '3 Hours', value: '3h', icon: '⏰' },
  { label: 'Tomorrow 9 AM', value: 'tomorrow', icon: '📅' },
  { label: 'Next Week', value: 'nextWeek', icon: '📆' },
] as const

// Custom snooze date options (for custom picker)
const CUSTOM_SNOOZE_DAYS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 Days', days: 2 },
  { label: 'In 3 Days', days: 3 },
  { label: 'In 5 Days', days: 5 },
  { label: 'In 1 Week', days: 7 },
  { label: 'In 2 Weeks', days: 14 },
]

const CUSTOM_SNOOZE_TIMES = [
  { label: '8:00 AM', hour: 8 },
  { label: '9:00 AM', hour: 9 },
  { label: '10:00 AM', hour: 10 },
  { label: '12:00 PM', hour: 12 },
  { label: '2:00 PM', hour: 14 },
  { label: '5:00 PM', hour: 17 },
]

// Task type options for creation
const TASK_TYPES = [
  { key: 'call', label: 'Call', icon: '📞' },
  { key: 'email', label: 'Email', icon: '✉️' },
  { key: 'meeting', label: 'Meeting', icon: '📅' },
  { key: 'site_visit', label: 'Site Visit', icon: '🏠' },
  { key: 'follow_up', label: 'Follow-up', icon: '🔔' },
  { key: 'task', label: 'Task', icon: '✓' },
]

// Due date presets
const DUE_DATE_PRESETS = [
  { label: 'Today', getDueDate: () => new Date() },
  { label: 'Tomorrow', getDueDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
  { label: 'Next Week', getDueDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
]

export default function TasksScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sections, setSections] = useState<TaskSection[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map())

  // Snooze picker state
  const [snoozePickerVisible, setSnoozePickerVisible] = useState(false)
  const [snoozeTask, setSnoozeTask] = useState<Followup | null>(null)
  const [showCustomSnooze, setShowCustomSnooze] = useState(false)
  const [customSnoozeDays, setCustomSnoozeDays] = useState(1)
  const [customSnoozeHour, setCustomSnoozeHour] = useState(9)

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Create task modal state
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskType, setNewTaskType] = useState('task')
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date>(new Date())
  const [newTaskDuePreset, setNewTaskDuePreset] = useState('Today')
  const [creating, setCreating] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error } = await followupService.getGroupedFollowups()

      if (error) {
        console.error('[Tasks] Error fetching tasks:', error)
        return
      }

      if (data) {
        // Sort each section by priority (urgent → high → medium → low)
        const sortedOverdue = sortByPriority(data.overdue)
        const sortedToday = sortByPriority(data.today)
        const sortedUpcoming = sortByPriority(data.upcoming)

        const newSections: TaskSection[] = [
          {
            title: `Overdue (${sortedOverdue.length})`,
            type: 'overdue',
            data: sortedOverdue,
            color: colors.error[500],
            emptyMessage: 'No overdue tasks',
          },
          {
            title: `Today (${sortedToday.length})`,
            type: 'today',
            data: sortedToday,
            color: colors.info[500],
            emptyMessage: 'Nothing due today',
          },
          {
            title: `Upcoming (${sortedUpcoming.length})`,
            type: 'upcoming',
            data: sortedUpcoming,
            color: colors.slate[500],
            emptyMessage: 'No upcoming tasks',
          },
        ]

        setSections(newSections)
        setTotalCount(sortedOverdue.length + sortedToday.length + sortedUpcoming.length)
      }
    } catch (err) {
      console.error('[Tasks] Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchTasks()
  }, [fetchTasks])

  const handleComplete = useCallback(async (task: Followup) => {
    // Close swipeable
    swipeableRefs.current.get(task.id)?.close()

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      const { error } = await followupService.complete(task.id)
      if (error) {
        Alert.alert('Error', 'Failed to complete task')
        return
      }
      // Refresh list
      fetchTasks()
    } catch (err) {
      console.error('[Tasks] Complete error:', err)
      Alert.alert('Error', 'Something went wrong')
    }
  }, [fetchTasks])

  const handleSnoozePress = useCallback((task: Followup) => {
    // Close swipeable
    swipeableRefs.current.get(task.id)?.close()
    // Show inline snooze picker instead of Alert
    setSnoozeTask(task)
    setSnoozePickerVisible(true)
  }, [])

  const handleSnoozeSelect = async (duration: '1h' | '3h' | 'tomorrow' | 'nextWeek') => {
    if (!snoozeTask) return

    setSnoozePickerVisible(false)
    setShowCustomSnooze(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      const { error } = await followupService.snooze(snoozeTask.id, duration)
      if (error) {
        Alert.alert('Error', 'Failed to snooze task')
        return
      }
      fetchTasks()
    } catch (err) {
      console.error('[Tasks] Snooze error:', err)
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSnoozeTask(null)
    }
  }

  // Handle custom snooze with specific date/time
  const handleCustomSnooze = async () => {
    if (!snoozeTask) return

    setSnoozePickerVisible(false)
    setShowCustomSnooze(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      // Calculate the new due date
      const newDate = new Date()
      newDate.setDate(newDate.getDate() + customSnoozeDays)
      const dueDate = newDate.toISOString().split('T')[0]
      const dueTime = `${customSnoozeHour.toString().padStart(2, '0')}:00`

      const { error } = await followupService.snoozeToDate(snoozeTask.id, dueDate, dueTime)
      if (error) {
        Alert.alert('Error', 'Failed to snooze task')
        return
      }
      fetchTasks()
    } catch (err) {
      console.error('[Tasks] Custom snooze error:', err)
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setSnoozeTask(null)
      setCustomSnoozeDays(1)
      setCustomSnoozeHour(9)
    }
  }

  const handleTaskPress = (task: Followup) => {
    // In selection mode, toggle selection instead of navigating
    if (selectionMode) {
      toggleTaskSelection(task.id)
      return
    }

    // Navigate to the linked entity
    if (task.entity_type === 'lead') {
      router.push(`/lead/${task.entity_id}`)
    } else if (task.entity_type === 'deal') {
      router.push(`/deal/${task.entity_id}`)
    } else if (task.entity_type === 'contact') {
      router.push(`/contact/${task.entity_id}`)
    } else if (task.entity_type === 'property') {
      router.push(`/property/${task.entity_id}`)
    }
  }

  // Long press to enter selection mode
  const handleTaskLongPress = useCallback((task: Followup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectionMode(true)
    setSelectedIds(new Set([task.id]))
  }, [])

  // Toggle task selection
  const toggleTaskSelection = useCallback((taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      // Exit selection mode if nothing selected
      if (next.size === 0) {
        setSelectionMode(false)
      }
      return next
    })
  }, [])

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // Batch complete selected tasks
  const handleBatchComplete = useCallback(async () => {
    if (selectedIds.size === 0) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    try {
      // Complete all selected tasks
      const promises = Array.from(selectedIds).map((id) =>
        followupService.complete(id)
      )
      const results = await Promise.all(promises)
      const errors = results.filter((r) => r.error)

      if (errors.length > 0) {
        Alert.alert('Warning', `${errors.length} task(s) failed to complete`)
      }

      // Exit selection mode and refresh
      exitSelectionMode()
      fetchTasks()
    } catch (err) {
      console.error('[Tasks] Batch complete error:', err)
      Alert.alert('Error', 'Something went wrong')
    }
  }, [selectedIds, exitSelectionMode, fetchTasks])

  // Select all visible tasks
  const handleSelectAll = useCallback(() => {
    const allIds = new Set<string>()
    sections.forEach((section) => {
      section.data.forEach((task) => allIds.add(task.id))
    })
    setSelectedIds(allIds)
  }, [sections])

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title')
      return
    }

    setCreating(true)
    try {
      const { error } = await followupService.create({
        title: newTaskTitle.trim(),
        task_type: newTaskType,
        due_date: newTaskDueDate.toISOString().split('T')[0],
        due_time: '09:00',
        priority: 'medium',
      })

      if (error) {
        Alert.alert('Error', 'Failed to create task')
        return
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setCreateModalVisible(false)
      setNewTaskTitle('')
      setNewTaskType('task')
      setNewTaskDuePreset('Today')
      setNewTaskDueDate(new Date())
      fetchTasks()
    } catch (err) {
      console.error('[Tasks] Create error:', err)
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return 'No due date'

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    let dateStr: string
    if (dueDate === today) {
      dateStr = 'Today'
    } else if (dueDate === tomorrow) {
      dateStr = 'Tomorrow'
    } else {
      const date = new Date(dueDate + 'T00:00:00')
      dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (dueTime) {
      const [hours, minutes] = dueTime.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      dateStr += ` at ${hour12}:${minutes} ${ampm}`
    }

    return dateStr
  }

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    task: Followup
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
    })

    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.snoozeAction]}
          onPress={() => handleSnoozePress(task)}
        >
          <Text style={styles.swipeActionIcon}>⏰</Text>
          <Text style={styles.swipeActionText}>Snooze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.completeAction]}
          onPress={() => handleComplete(task)}
        >
          <Text style={styles.swipeActionIcon}>✓</Text>
          <Text style={styles.swipeActionText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderTask = ({ item, section }: { item: Followup; section: TaskSection }) => {
    const icon = TASK_TYPE_ICONS[item.task_type] || '📌'
    const priorityColor = PRIORITY_COLORS[item.priority] || colors.slate[400]
    const isOverdue = section.type === 'overdue'
    const isSelected = selectedIds.has(item.id)

    const taskCard = (
      <TouchableOpacity
        style={[
          styles.taskCard,
          isOverdue && styles.taskCardOverdue,
          selectionMode && isSelected && styles.taskCardSelected,
        ]}
        onPress={() => handleTaskPress(item)}
        onLongPress={() => handleTaskLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkboxIcon}>✓</Text>}
            </View>
          </View>
        )}

        <View style={styles.taskIconContainer}>
          <Text style={styles.taskIcon}>{icon}</Text>
        </View>

        <View style={styles.taskContent}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.description && (
            <Text style={styles.taskDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <View style={styles.taskMeta}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.taskMetaText, isOverdue && styles.taskMetaTextOverdue]}>
              {formatDueDate(item.due_date, item.due_time)}
            </Text>
            {item.entity_type && (
              <>
                <Text style={styles.taskDivider}>•</Text>
                <View style={styles.entityBadge}>
                  <Text style={styles.entityBadgeIcon}>
                    {ENTITY_TYPE_INFO[item.entity_type]?.icon || '📌'}
                  </Text>
                  <Text style={styles.entityBadgeText}>
                    {ENTITY_TYPE_INFO[item.entity_type]?.label || item.entity_type}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {!selectionMode && (
          <View style={styles.taskChevron}>
            <Text style={styles.chevronIcon}>›</Text>
          </View>
        )}
      </TouchableOpacity>
    )

    // Disable swipe when in selection mode
    if (selectionMode) {
      return taskCard
    }

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref)
        }}
        renderRightActions={(progress) => renderRightActions(progress, item)}
        rightThreshold={40}
        overshootRight={false}
      >
        {taskCard}
      </Swipeable>
    )
  }

  const renderSectionHeader = ({ section }: { section: TaskSection }) => {
    // Hide section header if section is empty
    if (section.data.length === 0) return null

    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIndicator, { backgroundColor: section.color }]} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    )
  }

  // Don't render footer for empty sections - we hide them entirely
  const renderSectionFooter = ({ section }: { section: TaskSection }) => {
    return null
  }

  // Filter out empty sections when displaying
  const visibleSections = sections.filter(s => s.data.length > 0)

  // Full empty state when no tasks at all
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/mantis-mascot.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
      <Text style={styles.emptyText}>
        No tasks or follow-ups pending. Create a task to stay organized.
      </Text>
      <TouchableOpacity
        style={styles.emptyCreateButton}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.emptyCreateButtonText}>+ Create Task</Text>
      </TouchableOpacity>
      <View style={styles.emptyHint}>
        <Text style={styles.emptyHintIcon}>💡</Text>
        <Text style={styles.emptyHintText}>
          Tasks are created automatically when you schedule follow-ups on deals and leads.
        </Text>
      </View>
    </View>
  )

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Tasks</Text>
            <Text style={styles.subtitle}>
              {totalCount === 0
                ? 'Nothing pending'
                : `${totalCount} task${totalCount === 1 ? '' : 's'} pending`}
            </Text>
          </View>
          {/* Header create button */}
          <TouchableOpacity
            style={styles.headerCreateButton}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerCreateButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Stats - only show when there are tasks */}
      {totalCount > 0 && (
        <View style={styles.statsRow}>
          {sections.map((section) => (
            <View
              key={section.type}
              style={[
                styles.statBadge,
                section.data.length > 0 && styles.statBadgeActive,
              ]}
            >
              <View style={[styles.statDot, { backgroundColor: section.color }]} />
              <Text style={[
                styles.statCount,
                section.data.length === 0 && styles.statCountEmpty,
              ]}>
                {section.data.length}
              </Text>
              <Text style={styles.statLabel}>
                {section.type === 'overdue' ? 'Late' : section.type === 'today' ? 'Today' : 'Soon'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Task List or Empty State */}
      {totalCount === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      ) : (
        <SectionList
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Batch Action Bar - shown in selection mode */}
      {selectionMode && (
        <View style={styles.batchBar}>
          <TouchableOpacity style={styles.batchBarCancel} onPress={exitSelectionMode}>
            <Text style={styles.batchBarCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.batchBarCount}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity
              style={styles.batchBarSelectAll}
              onPress={handleSelectAll}
            >
              <Text style={styles.batchBarSelectAllText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.batchBarComplete,
                selectedIds.size === 0 && styles.batchBarCompleteDisabled,
              ]}
              onPress={handleBatchComplete}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.batchBarCompleteIcon}>✓</Text>
              <Text style={styles.batchBarCompleteText}>Complete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* FAB - Floating Action Button (hidden in selection mode) */}
      {totalCount > 0 && !selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            setCreateModalVisible(true)
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Snooze Picker Modal */}
      <Modal
        visible={snoozePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSnoozePickerVisible(false)
          setShowCustomSnooze(false)
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setSnoozePickerVisible(false)
            setShowCustomSnooze(false)
          }}
        >
          <View style={styles.snoozePickerContainer}>
            {!showCustomSnooze ? (
              <>
                <Text style={styles.snoozePickerTitle}>Snooze until...</Text>
                {SNOOZE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.snoozeOption}
                    onPress={() => handleSnoozeSelect(option.value)}
                  >
                    <Text style={styles.snoozeOptionIcon}>{option.icon}</Text>
                    <Text style={styles.snoozeOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.snoozeCustomButton}
                  onPress={() => setShowCustomSnooze(true)}
                >
                  <Text style={styles.snoozeCustomIcon}>📆</Text>
                  <Text style={styles.snoozeCustomText}>Pick Date & Time</Text>
                  <Text style={styles.snoozeCustomArrow}>→</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.snoozeCancelButton}
                  onPress={() => setSnoozePickerVisible(false)}
                >
                  <Text style={styles.snoozeCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.customSnoozeHeader}>
                  <TouchableOpacity onPress={() => setShowCustomSnooze(false)}>
                    <Text style={styles.customSnoozeBack}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.snoozePickerTitle}>Pick Date & Time</Text>
                  <View style={{ width: 50 }} />
                </View>

                <Text style={styles.customSnoozeLabel}>When?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customSnoozeRow}>
                  {CUSTOM_SNOOZE_DAYS.map((opt) => (
                    <TouchableOpacity
                      key={opt.days}
                      style={[
                        styles.customSnoozeChip,
                        customSnoozeDays === opt.days && styles.customSnoozeChipActive,
                      ]}
                      onPress={() => setCustomSnoozeDays(opt.days)}
                    >
                      <Text style={[
                        styles.customSnoozeChipText,
                        customSnoozeDays === opt.days && styles.customSnoozeChipTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.customSnoozeLabel}>At what time?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customSnoozeRow}>
                  {CUSTOM_SNOOZE_TIMES.map((opt) => (
                    <TouchableOpacity
                      key={opt.hour}
                      style={[
                        styles.customSnoozeChip,
                        customSnoozeHour === opt.hour && styles.customSnoozeChipActive,
                      ]}
                      onPress={() => setCustomSnoozeHour(opt.hour)}
                    >
                      <Text style={[
                        styles.customSnoozeChipText,
                        customSnoozeHour === opt.hour && styles.customSnoozeChipTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.customSnoozeConfirm}
                  onPress={handleCustomSnooze}
                >
                  <Text style={styles.customSnoozeConfirmText}>
                    Snooze until {CUSTOM_SNOOZE_DAYS.find(d => d.days === customSnoozeDays)?.label} at {CUSTOM_SNOOZE_TIMES.find(t => t.hour === customSnoozeHour)?.label}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.createModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.createModalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.createModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.createModalTitle}>New Task</Text>
            <TouchableOpacity
              onPress={handleCreateTask}
              disabled={creating || !newTaskTitle.trim()}
            >
              <Text style={[
                styles.createModalSave,
                (!newTaskTitle.trim() || creating) && styles.createModalSaveDisabled,
              ]}>
                {creating ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.createModalContent}>
            {/* Title Input */}
            <Text style={styles.inputLabel}>What needs to be done?</Text>
            <TextInput
              style={styles.textInput}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="e.g., Call seller about offer"
              placeholderTextColor={colors.slate[400]}
              autoFocus
            />

            {/* Task Type */}
            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeSelector}
            >
              {TASK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeOption,
                    newTaskType === type.key && styles.typeOptionActive,
                  ]}
                  onPress={() => setNewTaskType(type.key)}
                >
                  <Text style={styles.typeOptionIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeOptionLabel,
                    newTaskType === type.key && styles.typeOptionLabelActive,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Due Date */}
            <Text style={styles.inputLabel}>When is it due?</Text>
            <View style={styles.dueDatePresets}>
              {DUE_DATE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.dueDatePreset,
                    newTaskDuePreset === preset.label && styles.dueDatePresetActive,
                  ]}
                  onPress={() => {
                    setNewTaskDuePreset(preset.label)
                    setNewTaskDueDate(preset.getDueDate())
                  }}
                >
                  <Text style={[
                    styles.dueDatePresetText,
                    newTaskDuePreset === preset.label && styles.dueDatePresetTextActive,
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Templates */}
            <Text style={styles.inputLabel}>Quick Templates</Text>
            <View style={styles.templates}>
              {[
                { title: 'Follow up with seller', type: 'call' },
                { title: 'Send offer email', type: 'email' },
                { title: 'Schedule property visit', type: 'site_visit' },
                { title: 'Pull comps for analysis', type: 'task' },
              ].map((template, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.templateButton}
                  onPress={() => {
                    setNewTaskTitle(template.title)
                    setNewTaskType(template.type)
                  }}
                >
                  <Text style={styles.templateIcon}>
                    {TASK_TYPE_ICONS[template.type]}
                  </Text>
                  <Text style={styles.templateText}>{template.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  headerCreateButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  headerCreateButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  statBadgeActive: {
    backgroundColor: colors.white,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statCount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  statCountEmpty: {
    color: colors.slate[400],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + 80, // Extra space for FAB
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  taskCardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
  },
  taskCardSelected: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[300],
  },
  checkboxContainer: {
    marginRight: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.slate[300],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxSelected: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  checkboxIcon: {
    fontSize: 14,
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  taskIcon: {
    fontSize: 18,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  taskDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  taskMetaText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  taskMetaTextOverdue: {
    color: colors.error[500],
    fontWeight: typography.fontWeight.medium,
  },
  taskDivider: {
    marginHorizontal: spacing.xs,
    color: colors.slate[300],
  },
  entityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  entityBadgeIcon: {
    fontSize: 10,
    marginRight: 3,
  },
  entityBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  taskChevron: {
    paddingLeft: spacing.sm,
  },
  chevronIcon: {
    fontSize: 24,
    color: colors.slate[300],
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  snoozeAction: {
    backgroundColor: colors.warning[500],
  },
  completeAction: {
    backgroundColor: colors.success[500],
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  swipeActionIcon: {
    fontSize: 20,
    color: colors.white,
    marginBottom: 2,
  },
  swipeActionText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  // Empty state styles
  emptyScrollContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  emptyImage: {
    width: 140,
    height: 140,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyCreateButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  emptyCreateButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyHint: {
    flexDirection: 'row',
    backgroundColor: colors.brand[50],
    padding: spacing.md,
    borderRadius: radii.lg,
    maxWidth: 320,
  },
  emptyHintIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  emptyHintText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.brand[700],
    lineHeight: 20,
  },
  // FAB styles
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    fontWeight: typography.fontWeight.light,
    marginTop: -2,
  },
  // Snooze picker styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  snoozePickerContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  snoozePickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  snoozeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  snoozeOptionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  snoozeOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  snoozeCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brand[50],
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.md,
  },
  snoozeCustomIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  snoozeCustomText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  snoozeCustomArrow: {
    fontSize: 16,
    color: colors.brand[400],
  },
  snoozeCancelButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  snoozeCancelText: {
    fontSize: typography.fontSize.base,
    color: colors.error[500],
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
  },
  // Custom snooze picker styles
  customSnoozeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  customSnoozeBack: {
    fontSize: typography.fontSize.base,
    color: colors.brand[600],
  },
  customSnoozeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
  },
  customSnoozeRow: {
    paddingHorizontal: spacing.md,
  },
  customSnoozeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
    marginRight: spacing.sm,
  },
  customSnoozeChipActive: {
    backgroundColor: colors.brand[500],
  },
  customSnoozeChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    fontWeight: typography.fontWeight.medium,
  },
  customSnoozeChipTextActive: {
    color: colors.white,
  },
  customSnoozeConfirm: {
    backgroundColor: colors.brand[500],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  customSnoozeConfirmText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  // Create modal styles
  createModalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  createModalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  createModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  createModalSave: {
    fontSize: typography.fontSize.base,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold,
  },
  createModalSaveDisabled: {
    color: colors.slate[300],
  },
  createModalContent: {
    flex: 1,
    padding: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  typeSelector: {
    flexDirection: 'row',
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.slate[50],
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  typeOptionActive: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  typeOptionIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  typeOptionLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  typeOptionLabelActive: {
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  dueDatePresets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dueDatePreset: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    alignItems: 'center',
  },
  dueDatePresetActive: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  dueDatePresetText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  dueDatePresetTextActive: {
    color: colors.brand[600],
  },
  templates: {
    gap: spacing.sm,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  templateIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  templateText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
  },
  // Batch action bar styles
  batchBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    ...shadows.large,
  },
  batchBarCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  batchBarCancelText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  batchBarCount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  batchBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  batchBarSelectAll: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  batchBarSelectAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  batchBarComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  batchBarCompleteDisabled: {
    backgroundColor: colors.slate[300],
  },
  batchBarCompleteIcon: {
    fontSize: 16,
    color: colors.white,
  },
  batchBarCompleteText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
})
