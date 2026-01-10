/**
 * Calendar Day View Screen
 *
 * Shows a day-by-day calendar view with appointments and events.
 * Swipe left/right to navigate between days.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScreenContainer, Card } from '../src/components'
import { colors, spacing, typography, radii, shadows } from '../src/theme'
import { calendarService } from '../src/services'
import type { CalendarEvent } from '../src/services/calendarService'

const SCREEN_WIDTH = Dimensions.get('window').width
const CALENDAR_VIEW_KEY = 'flipmantis_calendar_view'

type CalendarViewMode = 'day' | 'month'

// Day names
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Format date for display
function formatDateHeader(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

// Get week dates centered on a given date
function getWeekDates(centerDate: Date): Date[] {
  const dates: Date[] = []
  const startOfWeek = new Date(centerDate)
  startOfWeek.setDate(centerDate.getDate() - 3) // Show 3 days before and 3 after

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    dates.push(date)
  }
  return dates
}

// Event Card Component
function EventCard({
  event,
  onPress,
}: {
  event: CalendarEvent
  onPress: () => void
}) {
  const icon = calendarService.getEventTypeIcon(event.event_type)
  const color = calendarService.getEventTypeColor(event.event_type)
  const timeStr = calendarService.formatEventTime(event.start_time, event.end_time, event.all_day)
  const recurrenceLabel = event.is_recurring
    ? calendarService.getRecurrenceLabel(event.recurrence_rule)
    : null

  const statusStyles: Record<string, { bg: string; text: string }> = {
    scheduled: { bg: colors.slate[100], text: colors.slate[600] },
    confirmed: { bg: colors.success[100], text: colors.success[700] },
    tentative: { bg: colors.warning[100], text: colors.warning[700] },
    completed: { bg: colors.brand[100], text: colors.brand[700] },
    canceled: { bg: colors.error[100], text: colors.error[700] },
    no_show: { bg: colors.error[100], text: colors.error[700] },
    rescheduled: { bg: colors.warning[100], text: colors.warning[700] },
  }

  const statusStyle = statusStyles[event.status] || statusStyles.scheduled

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.eventStripe, { backgroundColor: color }]} />
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={styles.eventTime}>
            <Text style={styles.eventIcon}>{icon}</Text>
            <Text style={[styles.eventTimeText, { color }]}>{timeStr}</Text>
            {/* Recurring indicator */}
            {event.is_recurring && (
              <View style={styles.recurringBadge}>
                <Text style={styles.recurringIcon}>{calendarService.getRecurrenceIcon()}</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {/* Recurrence label */}
        {recurrenceLabel && (
          <Text style={styles.recurrenceLabel}>
            {calendarService.getRecurrenceIcon()} {recurrenceLabel}
          </Text>
        )}
        {event.location && (
          <Text style={styles.eventLocation} numberOfLines={1}>
            📍 {event.location}
          </Text>
        )}
        {event.description && (
          <Text style={styles.eventDescription} numberOfLines={2}>
            {event.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// Empty Day State
function EmptyDay({ date }: { date: Date }) {
  const isToday = date.toDateString() === new Date().toDateString()
  const isPast = date < new Date() && !isToday

  return (
    <View style={styles.emptyDay}>
      <Text style={styles.emptyDayIcon}>{isPast ? '✓' : '📭'}</Text>
      <Text style={styles.emptyDayText}>
        {isPast ? 'No events this day' : 'No events scheduled'}
      </Text>
      {!isPast && (
        <Text style={styles.emptyDaySubtext}>
          Tap + to add an appointment
        </Text>
      )}
    </View>
  )
}

// Get days in month grid (includes padding days from prev/next months)
function getMonthGridDays(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // First day of the month
  const firstDay = new Date(year, month, 1)
  const startDayOfWeek = firstDay.getDay()

  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Add padding days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i)
    days.push({ date: prevDate, isCurrentMonth: false })
  }

  // Add days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

  // Add padding days from next month to complete the grid (6 rows x 7 days = 42)
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }

  return days
}

// Month Grid Component
function MonthGrid({
  currentDate,
  selectedDate,
  eventDates,
  onSelectDate,
}: {
  currentDate: Date
  selectedDate: Date
  eventDates: Set<string>
  onSelectDate: (date: Date) => void
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = useMemo(() => getMonthGridDays(year, month), [year, month])
  const today = new Date()

  const isToday = (date: Date) => date.toDateString() === today.toDateString()
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString()
  const hasEvents = (date: Date) => eventDates.has(date.toDateString())

  const dayWidth = (SCREEN_WIDTH - spacing.md * 2) / 7

  return (
    <View style={styles.monthGrid}>
      {/* Day headers */}
      <View style={styles.monthDayHeaders}>
        {SHORT_DAYS.map((day) => (
          <View key={day} style={[styles.monthDayHeader, { width: dayWidth }]}>
            <Text style={styles.monthDayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={styles.monthDays}>
        {days.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.monthDayCell,
              { width: dayWidth, height: dayWidth },
              isSelected(day.date) && styles.monthDayCellSelected,
              isToday(day.date) && styles.monthDayCellToday,
            ]}
            onPress={() => onSelectDate(day.date)}
          >
            <Text
              style={[
                styles.monthDayNumber,
                !day.isCurrentMonth && styles.monthDayNumberMuted,
                isSelected(day.date) && styles.monthDayNumberSelected,
                isToday(day.date) && !isSelected(day.date) && styles.monthDayNumberToday,
              ]}
            >
              {day.date.getDate()}
            </Text>
            {hasEvents(day.date) && (
              <View
                style={[
                  styles.eventDot,
                  isSelected(day.date) && styles.eventDotSelected,
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// View Mode Toggle
function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: CalendarViewMode
  onChange: (mode: CalendarViewMode) => void
}) {
  return (
    <View style={styles.viewModeToggle}>
      <TouchableOpacity
        style={[styles.viewModeButton, mode === 'day' && styles.viewModeButtonActive]}
        onPress={() => onChange('day')}
      >
        <Text style={[styles.viewModeText, mode === 'day' && styles.viewModeTextActive]}>
          Day
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewModeButton, mode === 'month' && styles.viewModeButtonActive]}
        onPress={() => onChange('month')}
      >
        <Text style={[styles.viewModeText, mode === 'month' && styles.viewModeTextActive]}>
          Month
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default function CalendarScreen() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('day')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [monthDate, setMonthDate] = useState(new Date())

  const weekDates = getWeekDates(selectedDate)

  // Event dates for month view (for showing dots)
  const eventDates = useMemo(() => {
    const dates = new Set<string>()
    monthEvents.forEach((event) => {
      const eventDate = new Date(event.start_time)
      dates.add(eventDate.toDateString())
    })
    return dates
  }, [monthEvents])

  // Load saved view mode
  useEffect(() => {
    AsyncStorage.getItem(CALENDAR_VIEW_KEY).then((saved) => {
      if (saved === 'month' || saved === 'day') {
        setViewMode(saved)
      }
    })
  }, [])

  // Save view mode when changed
  const handleViewModeChange = async (mode: CalendarViewMode) => {
    setViewMode(mode)
    await AsyncStorage.setItem(CALENDAR_VIEW_KEY, mode)
  }

  // Fetch month events when in month view
  const fetchMonthEvents = useCallback(async (date: Date) => {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      const { data } = await calendarService.getEventsForRange(startOfMonth, endOfMonth)
      setMonthEvents(data || [])
    } catch (err) {
      console.error('Error fetching month events:', err)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'month') {
      fetchMonthEvents(monthDate)
    }
  }, [viewMode, monthDate, fetchMonthEvents])

  // Month navigation
  const goToPreviousMonth = () => {
    const prev = new Date(monthDate)
    prev.setMonth(prev.getMonth() - 1)
    setMonthDate(prev)
  }

  const goToNextMonth = () => {
    const next = new Date(monthDate)
    next.setMonth(next.getMonth() + 1)
    setMonthDate(next)
  }

  // Handle date selection from month view
  const handleMonthDateSelect = (date: Date) => {
    setSelectedDate(date)
    setMonthDate(date)
    setViewMode('day')
    AsyncStorage.setItem(CALENDAR_VIEW_KEY, 'day')
  }

  const fetchEvents = useCallback(async (date: Date) => {
    setLoading(true)
    try {
      const { data, error } = await calendarService.getEventsForDay(date)
      if (error) {
        console.error('Error fetching events:', error)
      } else {
        setEvents(data || [])
      }
    } catch (err) {
      console.error('Calendar fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents(selectedDate)
  }, [selectedDate, fetchEvents])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchEvents(selectedDate)
  }, [selectedDate, fetchEvents])

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    setSelectedDate(prev)
  }

  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
  }

  const handleEventPress = (event: CalendarEvent) => {
    // Navigate based on linked entity
    if (event.deal_id) {
      router.push(`/property/${event.deal_id}`)
    } else if (event.lead_id) {
      router.push(`/lead/${event.lead_id}`)
    } else if (event.contact_id) {
      router.push(`/contact/${event.contact_id}`)
    }
    // TODO: Open event detail modal
  }

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString()

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Calendar',
          headerShown: true,
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
          headerRight: () => (
            <TouchableOpacity
              onPress={goToToday}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScreenContainer scrollable={false} padding={false}>
        {/* View Mode Toggle */}
        <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />

        {viewMode === 'month' ? (
          <>
            {/* Month Header */}
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthNavButton}>
                <Text style={styles.monthNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthHeaderText}>
                {MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavButton}>
                <Text style={styles.monthNavText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Month Grid */}
            <MonthGrid
              currentDate={monthDate}
              selectedDate={selectedDate}
              eventDates={eventDates}
              onSelectDate={handleMonthDateSelect}
            />

            {/* Selected Date Events Summary */}
            <View style={styles.monthEventsSummary}>
              <Text style={styles.monthEventsTitle}>
                Tap a date to view events
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Week Strip */}
            <View style={styles.weekStrip}>
          <TouchableOpacity onPress={goToPreviousDay} style={styles.weekNavButton}>
            <Text style={styles.weekNavText}>‹</Text>
          </TouchableOpacity>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekDays}
          >
            {weekDates.map((date) => (
              <TouchableOpacity
                key={date.toISOString()}
                style={[
                  styles.dayButton,
                  isSelected(date) && styles.dayButtonSelected,
                  isToday(date) && styles.dayButtonToday,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dayName,
                    isSelected(date) && styles.dayNameSelected,
                  ]}
                >
                  {SHORT_DAYS[date.getDay()]}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected(date) && styles.dayNumberSelected,
                    isToday(date) && !isSelected(date) && styles.dayNumberToday,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={goToNextDay} style={styles.weekNavButton}>
            <Text style={styles.weekNavText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Date Header */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{formatDateHeader(selectedDate)}</Text>
          <Text style={styles.eventCount}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Events List */}
        <ScrollView
          style={styles.eventsList}
          contentContainerStyle={styles.eventsListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brand[500]} />
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          ) : events.length === 0 ? (
            <EmptyDay date={selectedDate} />
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event)}
              />
            ))
          )}
        </ScrollView>
          </>
        )}

        {/* Add Event FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            // TODO: Navigate to add event screen
            console.log('Add event for date:', selectedDate.toISOString())
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  todayButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  // View Mode Toggle
  viewModeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  viewModeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginHorizontal: spacing.xs,
  },
  viewModeButtonActive: {
    backgroundColor: colors.brand[500],
  },
  viewModeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  viewModeTextActive: {
    color: colors.white,
  },
  // Month Header
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  monthNavButton: {
    padding: spacing.sm,
  },
  monthNavText: {
    fontSize: 28,
    color: colors.slate[400],
  },
  monthHeaderText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  // Month Grid
  monthGrid: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  monthDayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  monthDayHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  monthDayHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  monthDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  monthDayCellSelected: {
    backgroundColor: colors.brand[500],
  },
  monthDayCellToday: {
    borderWidth: 2,
    borderColor: colors.brand[300],
  },
  monthDayNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  monthDayNumberMuted: {
    color: colors.slate[300],
  },
  monthDayNumberSelected: {
    color: colors.white,
  },
  monthDayNumberToday: {
    color: colors.brand[600],
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[500],
    marginTop: 2,
  },
  eventDotSelected: {
    backgroundColor: colors.white,
  },
  monthEventsSummary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  monthEventsTitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  weekNavButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  weekNavText: {
    fontSize: 24,
    color: colors.slate[400],
    fontWeight: typography.fontWeight.normal,
  },
  weekDays: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayButton: {
    width: 48,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  dayButtonSelected: {
    backgroundColor: colors.brand[500],
  },
  dayButtonToday: {
    borderWidth: 2,
    borderColor: colors.brand[300],
  },
  dayName: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  dayNameSelected: {
    color: colors.white,
  },
  dayNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayNumberToday: {
    color: colors.brand[600],
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.slate[50],
  },
  dateHeaderText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  eventCount: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  eventsList: {
    flex: 1,
  },
  eventsListContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.soft,
  },
  eventStripe: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eventTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventIcon: {
    fontSize: 14,
  },
  eventTimeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  eventTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  eventLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  eventDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  recurringBadge: {
    marginLeft: spacing.xs,
  },
  recurringIcon: {
    fontSize: 14,
  },
  recurrenceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyDayIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyDayText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyDaySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.white,
    fontWeight: typography.fontWeight.normal,
  },
})
