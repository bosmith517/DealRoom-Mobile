/**
 * Tasks Screen
 *
 * Displays follow-ups/tasks with filtering, creation, and recurring support.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native'
import { Stack, Link } from 'expo-router'
import { ScreenContainer, Card, Button } from '../src/components'
import { colors, spacing, typography, radii } from '../src/theme'
import {
  getUpcomingFollowups,
  getOverdueFollowups,
  getTodayFollowups,
  getAllFollowups,
  createFollowup,
  completeFollowup,
  snoozeFollowup,
} from '../src/services'
import type { Followup, RecurringPattern } from '../src/types'

type FilterTab = 'all' | 'overdue' | 'today' | 'upcoming'

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// Format time
function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Check if task is overdue
function isOverdue(dueAt: string): boolean {
  return new Date(dueAt) < new Date()
}

// Date preset helpers
function getDatePreset(preset: 'today' | 'tomorrow' | 'nextWeek'): Date {
  const date = new Date()
  date.setHours(9, 0, 0, 0) // Default to 9 AM

  switch (preset) {
    case 'today':
      return date
    case 'tomorrow':
      date.setDate(date.getDate() + 1)
      return date
    case 'nextWeek':
      date.setDate(date.getDate() + 7)
      return date
    default:
      return date
  }
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.toDateString() === tomorrow.toDateString()
}

function isNextWeek(date: Date): boolean {
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  return date.toDateString() === nextWeek.toDateString()
}

// Recurring pattern labels
const RECURRING_LABELS: Record<RecurringPattern, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

// Task type icons
const TASK_TYPE_ICONS: Record<string, string> = {
  task: '✓',
  call: '📞',
  email: '✉️',
  meeting: '📅',
  follow_up: '🔔',
  site_visit: '🏠',
  default: '📌',
}

// Task Card Component
function TaskCard({
  task,
  onComplete,
  onSnooze,
}: {
  task: Followup
  onComplete: (id: string) => void
  onSnooze: (id: string) => void
}) {
  const overdue = task.status !== 'done' && isOverdue(task.due_at)
  const icon = TASK_TYPE_ICONS[task.followup_type] || TASK_TYPE_ICONS.default

  return (
    <Card style={[styles.taskCard, overdue && styles.taskCardOverdue]} padding="md">
      <View style={styles.taskHeader}>
        <View style={styles.taskInfo}>
          <Text style={styles.taskIcon}>{icon}</Text>
          <View style={styles.taskTitleContainer}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.recurring_pattern && task.recurring_pattern !== 'none' && (
              <View style={styles.recurringBadge}>
                <Text style={styles.recurringBadgeText}>
                  🔄 {RECURRING_LABELS[task.recurring_pattern]}
                </Text>
              </View>
            )}
          </View>
        </View>
        {task.status !== 'done' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => onComplete(task.id)}
          >
            <Text style={styles.completeButtonText}>✓</Text>
          </TouchableOpacity>
        )}
      </View>

      {task.description && (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {task.description}
        </Text>
      )}

      <View style={styles.taskFooter}>
        <View style={styles.taskMeta}>
          <Text style={[styles.taskDue, overdue && styles.taskDueOverdue]}>
            {formatDate(task.due_at)} at {formatTime(task.due_at)}
          </Text>
          {task.deal_id && (
            <Link href={`/property/${task.deal_id}`} asChild>
              <TouchableOpacity>
                <Text style={styles.taskLink}>View Deal →</Text>
              </TouchableOpacity>
            </Link>
          )}
          {task.lead_id && !task.deal_id && (
            <Link href={`/lead/${task.lead_id}`} asChild>
              <TouchableOpacity>
                <Text style={styles.taskLink}>View Lead →</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
        {task.status !== 'done' && (
          <TouchableOpacity
            style={styles.snoozeButton}
            onPress={() => onSnooze(task.id)}
          >
            <Text style={styles.snoozeButtonText}>Snooze</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  )
}

// Create Task Modal
function CreateTaskModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (task: Partial<Followup>) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(getDatePreset('tomorrow'))
  const [recurring, setRecurring] = useState<RecurringPattern>('none')
  const [taskType, setTaskType] = useState('task')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title')
      return
    }

    setCreating(true)
    await onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      due_at: dueDate.toISOString(),
      followup_type: taskType,
      recurring_pattern: recurring,
    })
    setCreating(false)

    // Reset form
    setTitle('')
    setDescription('')
    setDueDate(getDatePreset('tomorrow'))
    setRecurring('none')
    setTaskType('task')
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Task</Text>
          <TouchableOpacity onPress={handleCreate} disabled={creating}>
            <Text style={[styles.modalSave, !title.trim() && styles.modalSaveDisabled]}>
              {creating ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.slate[400]}
          />

          <Text style={styles.inputLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add details..."
            placeholderTextColor={colors.slate[400]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Task Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
            {Object.entries(TASK_TYPE_ICONS).filter(([k]) => k !== 'default').map(([type, icon]) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeOption, taskType === type && styles.typeOptionActive]}
                onPress={() => setTaskType(type)}
              >
                <Text style={styles.typeOptionIcon}>{icon}</Text>
                <Text style={[styles.typeOptionLabel, taskType === type && styles.typeOptionLabelActive]}>
                  {type.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.inputLabel}>Due Date</Text>
          <View style={styles.datePresets}>
            <TouchableOpacity
              style={[styles.datePreset, isToday(dueDate) && styles.datePresetActive]}
              onPress={() => setDueDate(getDatePreset('today'))}
            >
              <Text style={[styles.datePresetText, isToday(dueDate) && styles.datePresetTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.datePreset, isTomorrow(dueDate) && styles.datePresetActive]}
              onPress={() => setDueDate(getDatePreset('tomorrow'))}
            >
              <Text style={[styles.datePresetText, isTomorrow(dueDate) && styles.datePresetTextActive]}>
                Tomorrow
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.datePreset, isNextWeek(dueDate) && styles.datePresetActive]}
              onPress={() => setDueDate(getDatePreset('nextWeek'))}
            >
              <Text style={[styles.datePresetText, isNextWeek(dueDate) && styles.datePresetTextActive]}>
                Next Week
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dateDisplay}>
            {formatDate(dueDate.toISOString())} at {formatTime(dueDate.toISOString())}
          </Text>

          <Text style={styles.inputLabel}>Repeat</Text>
          <View style={styles.recurringOptions}>
            {(Object.keys(RECURRING_LABELS) as RecurringPattern[]).map((pattern) => (
              <TouchableOpacity
                key={pattern}
                style={[styles.recurringOption, recurring === pattern && styles.recurringOptionActive]}
                onPress={() => setRecurring(pattern)}
              >
                <Text style={[styles.recurringOptionText, recurring === pattern && styles.recurringOptionTextActive]}>
                  {RECURRING_LABELS[pattern]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      let result: { data: Followup[]; error: Error | null }

      switch (activeTab) {
        case 'overdue':
          result = await getOverdueFollowups()
          break
        case 'today':
          result = await getTodayFollowups()
          break
        case 'upcoming':
          result = await getUpcomingFollowups(50)
          break
        default:
          result = await getAllFollowups({ status: ['open', 'in_progress'], limit: 100 })
      }

      if (result.error) {
        console.error('Error fetching tasks:', result.error)
      } else {
        setTasks(result.data)
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => {
    setLoading(true)
    fetchTasks()
  }, [fetchTasks])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchTasks()
  }, [fetchTasks])

  const handleComplete = useCallback(async (taskId: string) => {
    Alert.alert(
      'Complete Task',
      'Mark this task as done?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            const { error, nextFollowup } = await completeFollowup(taskId)
            if (error) {
              Alert.alert('Error', 'Failed to complete task')
            } else {
              if (nextFollowup) {
                Alert.alert('Task Completed', 'Next recurring task has been created.')
              }
              fetchTasks()
            }
          },
        },
      ]
    )
  }, [fetchTasks])

  const handleSnooze = useCallback(async (taskId: string) => {
    Alert.alert(
      'Snooze Task',
      'Snooze for how long?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '1 Day',
          onPress: async () => {
            const { error } = await snoozeFollowup(taskId, 1)
            if (error) Alert.alert('Error', 'Failed to snooze task')
            else fetchTasks()
          },
        },
        {
          text: '3 Days',
          onPress: async () => {
            const { error } = await snoozeFollowup(taskId, 3)
            if (error) Alert.alert('Error', 'Failed to snooze task')
            else fetchTasks()
          },
        },
        {
          text: '1 Week',
          onPress: async () => {
            const { error } = await snoozeFollowup(taskId, 7)
            if (error) Alert.alert('Error', 'Failed to snooze task')
            else fetchTasks()
          },
        },
      ]
    )
  }, [fetchTasks])

  const handleCreate = useCallback(async (task: Partial<Followup>) => {
    const { error } = await createFollowup(task)
    if (error) {
      Alert.alert('Error', 'Failed to create task')
    } else {
      setShowCreateModal(false)
      fetchTasks()
    }
  }, [fetchTasks])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Tasks',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.headerButtonText}>+ New</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScreenContainer scrollable={false}>
        {/* Filter Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Task List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand[500]}
              />
            }
            contentContainerStyle={styles.taskList}
          >
            {tasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>✓</Text>
                <Text style={styles.emptyStateTitle}>
                  {activeTab === 'overdue' ? 'No overdue tasks' :
                   activeTab === 'today' ? 'No tasks due today' :
                   activeTab === 'upcoming' ? 'No upcoming tasks' :
                   'No tasks'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {activeTab === 'all' ? 'Create a task to get started' : 'You\'re all caught up!'}
                </Text>
                {activeTab === 'all' && (
                  <Button
                    variant="primary"
                    onPress={() => setShowCreateModal(true)}
                    style={styles.createButton}
                  >
                    Create Task
                  </Button>
                )}
              </View>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  onSnooze={handleSnooze}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* Create Task Modal */}
        <CreateTaskModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  tabActive: {
    backgroundColor: colors.brand[50],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  tabTextActive: {
    color: colors.brand[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  taskList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  taskCard: {
    marginBottom: spacing.sm,
  },
  taskCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error[500],
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  taskTitleContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  recurringBadge: {
    backgroundColor: colors.brand[50],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  recurringBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.brand[600],
  },
  completeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  completeButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  taskDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    marginTop: spacing.xs,
    marginLeft: 28,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginLeft: 28,
  },
  taskMeta: {
    flex: 1,
  },
  taskDue: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  taskDueOverdue: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  taskLink: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[500],
    marginTop: 2,
  },
  snoozeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.slate[100],
  },
  snoozeButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateIcon: {
    fontSize: 60,
    color: colors.success[500],
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
  },
  createButton: {
    marginTop: spacing.lg,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  modalSave: {
    fontSize: typography.fontSize.base,
    color: colors.brand[500],
    fontWeight: typography.fontWeight.semibold,
  },
  modalSaveDisabled: {
    color: colors.slate[300],
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    marginTop: spacing.xs,
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
    textTransform: 'capitalize',
  },
  typeOptionLabelActive: {
    color: colors.brand[600],
  },
  datePresets: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  datePreset: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    alignItems: 'center',
  },
  datePresetActive: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  datePresetText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  datePresetTextActive: {
    color: colors.brand[600],
  },
  dateDisplay: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateButton: {
    flex: 2,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  timeButton: {
    flex: 1,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.ink,
  },
  recurringOptions: {
    marginTop: spacing.xs,
  },
  recurringOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.slate[50],
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  recurringOptionActive: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  recurringOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  recurringOptionTextActive: {
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
})
