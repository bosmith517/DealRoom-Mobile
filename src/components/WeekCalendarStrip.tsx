/**
 * WeekCalendarStrip
 *
 * 7-day horizontal calendar preview showing:
 * - Day indicators (S M T W T F S)
 * - Current day highlighted
 * - Dot indicators for days with events
 * - Tappable to navigate to calendar
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, typography, radii, shadows } from '../theme'
import { calendarService, type CalendarEvent } from '../services/calendarService'

interface DayInfo {
  date: Date
  dayLabel: string
  dayNumber: number
  isToday: boolean
  eventCount: number
}

interface WeekCalendarStripProps {
  onDayPress?: (date: Date) => void
}

export function WeekCalendarStrip({ onDayPress }: WeekCalendarStripProps) {
  const router = useRouter()
  const [days, setDays] = useState<DayInfo[]>([])
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    generateWeekDays()
    loadWeekEvents()
  }, [])

  const generateWeekDays = () => {
    const today = new Date()
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const weekDays: DayInfo[] = []

    // Start from today, show 7 days forward
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)

      weekDays.push({
        date,
        dayLabel: dayLabels[date.getDay()],
        dayNumber: date.getDate(),
        isToday: i === 0,
        eventCount: 0, // Will be updated after loading events
      })
    }

    setDays(weekDays)
  }

  const loadWeekEvents = async () => {
    const today = new Date()
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)

    const { data, error } = await calendarService.getEventsInRange(
      today.toISOString(),
      weekEnd.toISOString()
    )

    if (!error && data) {
      setWeekEvents(data)
      updateEventCounts(data)
    }
  }

  const updateEventCounts = (events: CalendarEvent[]) => {
    setDays((prevDays) =>
      prevDays.map((day) => {
        const dayStart = new Date(day.date)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day.date)
        dayEnd.setHours(23, 59, 59, 999)

        const eventCount = events.filter((event) => {
          const eventDate = new Date(event.start_time)
          return eventDate >= dayStart && eventDate <= dayEnd
        }).length

        return { ...day, eventCount }
      })
    )
  }

  const handleDayPress = (day: DayInfo) => {
    if (onDayPress) {
      onDayPress(day.date)
    } else {
      // Default: navigate to calendar
      router.push('/calendar')
    }
  }

  const handleViewAll = () => {
    router.push('/calendar')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>This Week</Text>
        <TouchableOpacity onPress={handleViewAll}>
          <Text style={styles.viewAll}>View Calendar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.daysRow}>
        {days.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.dayCell, day.isToday && styles.dayCellToday]}
            onPress={() => handleDayPress(day)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
              {day.dayLabel}
            </Text>
            <Text style={[styles.dayNumber, day.isToday && styles.dayNumberToday]}>
              {day.dayNumber}
            </Text>
            <View style={styles.dotsContainer}>
              {day.eventCount > 0 && (
                <View
                  style={[
                    styles.eventDot,
                    day.eventCount > 1 && styles.eventDotMultiple,
                    day.isToday && styles.eventDotToday,
                  ]}
                />
              )}
              {day.eventCount > 2 && (
                <View style={[styles.eventDot, styles.eventDotSecond]} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  viewAll: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  dayCellToday: {
    backgroundColor: colors.brand[500],
  },
  dayLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  dayLabelToday: {
    color: colors.white,
    opacity: 0.8,
  },
  dayNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  dayNumberToday: {
    color: colors.white,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    height: 6,
    gap: 2,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[500],
  },
  eventDotMultiple: {
    backgroundColor: colors.success[500],
  },
  eventDotToday: {
    backgroundColor: colors.white,
  },
  eventDotSecond: {
    backgroundColor: colors.warning[500],
  },
})

export default WeekCalendarStrip
