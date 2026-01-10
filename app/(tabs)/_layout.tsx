/**
 * Tabs Layout
 *
 * Bottom tab navigator for main app screens.
 * Includes a prominent "Driving" FAB in the center.
 * Shows OfflineBanner when offline or syncing.
 * Shows InvestorOnboarding modal for new users.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { View, StyleSheet, Text, TouchableOpacity, Platform, Modal, Pressable, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Linking from 'expo-linking'
import { colors, components, typography, shadows, spacing, radii } from '../../src/theme'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { MarketAlertBanner } from '../../src/components/MarketAlertBanner'
import { InvestorOnboarding } from '../../src/components/InvestorOnboarding'
import { aiService } from '../../src/services/aiService'
import { followupService } from '../../src/services/followupService'
import { getLeads, getDeals } from '../../src/services'

// Tab icon component with optional badge
function TabIcon({
  focused,
  icon,
  label,
  badgeCount,
}: {
  focused: boolean
  icon: string
  label: string
  badgeCount?: number
}) {
  return (
    <View style={styles.tabIconContainer}>
      <View style={styles.iconWrapper}>
        <Text
          style={[
            styles.tabIcon,
            { color: focused ? colors.brand[500] : colors.slate[400] },
          ]}
        >
          {icon}
        </Text>
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.brand[500] : colors.slate[400] },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  )
}

// FAB Menu Option type
interface FABMenuOption {
  icon: string
  label: string
  route: string
}

const FAB_MENU_OPTIONS: FABMenuOption[] = [
  { icon: '🚗', label: 'Drive', route: '/driving' },
  { icon: '📍', label: 'Quick Lead', route: '/lead/new' },
  { icon: '🏠', label: 'New Deal', route: '/property/new' },
]

// Driving FAB component with long-press menu
function DrivingFAB() {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0)).current

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/driving')
  }, [router])

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setShowMenu(true)
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start()
  }, [scaleAnim])

  const handleMenuOption = useCallback((option: FABMenuOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowMenu(false)
    scaleAnim.setValue(0)
    router.push(option.route as any)
  }, [router, scaleAnim])

  const handleCloseMenu = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMenu(false))
  }, [scaleAnim])

  return (
    <View style={styles.fabContainer}>
      {/* Menu backdrop */}
      {showMenu && (
        <Pressable style={styles.fabMenuBackdrop} onPress={handleCloseMenu} />
      )}

      {/* Menu options */}
      {showMenu && (
        <Animated.View
          style={[
            styles.fabMenu,
            {
              transform: [{ scale: scaleAnim }],
              opacity: scaleAnim,
            },
          ]}
        >
          {FAB_MENU_OPTIONS.map((option, idx) => (
            <TouchableOpacity
              key={option.route}
              style={[
                styles.fabMenuItem,
                idx === 0 && styles.fabMenuItemFirst,
              ]}
              onPress={() => handleMenuOption(option)}
              activeOpacity={0.7}
            >
              <Text style={styles.fabMenuIcon}>{option.icon}</Text>
              <Text style={styles.fabMenuLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Main FAB button */}
      <TouchableOpacity
        style={[styles.drivingFab, showMenu && styles.drivingFabActive]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        <Text style={styles.drivingFabIcon}>{showMenu ? '✕' : '🚗'}</Text>
        <Text style={styles.drivingFabLabel}>{showMenu ? 'Close' : 'Drive'}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [overdueCount, setOverdueCount] = useState(0)
  const [hotLeadsCount, setHotLeadsCount] = useState(0)
  const [criticalDealsCount, setCriticalDealsCount] = useState(0)

  // Fetch overdue task count
  const fetchOverdueCount = useCallback(async () => {
    try {
      const { data } = await followupService.getGroupedFollowups()
      if (data) {
        setOverdueCount(data.overdue.length)
      }
    } catch (err) {
      console.warn('[TabsLayout] Error fetching overdue count:', err)
    }
  }, [])

  // Fetch hot leads count (leads from last 24 hours)
  const fetchHotLeadsCount = useCallback(async () => {
    try {
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data } = await getLeads({
        createdAfter: twentyFourHoursAgo.toISOString(),
        limit: 100,
      })
      setHotLeadsCount(data?.length || 0)
    } catch (err) {
      console.warn('[TabsLayout] Error fetching hot leads count:', err)
    }
  }, [])

  // Fetch critical deals count (deals past threshold days)
  const fetchCriticalDealsCount = useCallback(async () => {
    try {
      const { data } = await getDeals({ status: 'active' })
      if (data) {
        // Count deals that are past their stage threshold
        const STAGE_THRESHOLDS: Record<string, number> = {
          lead: 7,
          prospect: 14,
          underwriting: 10,
          offer_submitted: 7,
          under_contract: 30,
        }
        const criticalCount = data.filter((deal) => {
          const threshold = STAGE_THRESHOLDS[deal.stage] || 14
          const daysInStage = deal.days_in_stage || 0
          return daysInStage > threshold
        }).length
        setCriticalDealsCount(criticalCount)
      }
    } catch (err) {
      console.warn('[TabsLayout] Error fetching critical deals count:', err)
    }
  }, [])

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path } = Linking.parse(event.url)
      if (path) {
        // Navigate to the appropriate screen based on deep link
        if (path.startsWith('lead/')) {
          router.push(`/${path}` as any)
        } else if (path.startsWith('property/')) {
          router.push(`/${path}` as any)
        } else if (path === 'alerts') {
          router.push('/alerts')
        } else if (path === 'tasks') {
          router.push('/(tabs)/tasks')
        } else if (path === 'pipeline') {
          router.push('/(tabs)/pipeline')
        }
      }
    }

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    })

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink)
    return () => subscription.remove()
  }, [router])

  // Check if user needs onboarding on mount and fetch all badge counts
  useEffect(() => {
    checkOnboardingStatus()
    fetchOverdueCount()
    fetchHotLeadsCount()
    fetchCriticalDealsCount()

    // Refresh badge counts every 5 minutes
    const interval = setInterval(() => {
      fetchOverdueCount()
      fetchHotLeadsCount()
      fetchCriticalDealsCount()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchOverdueCount, fetchHotLeadsCount, fetchCriticalDealsCount])

  // Tab press handler with haptic feedback
  const handleTabPress = useCallback(() => {
    Haptics.selectionAsync()
  }, [])

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const isComplete = await aiService.isOnboardingComplete()
      if (!isComplete) {
        setShowOnboarding(true)
      }
    } catch (err) {
      console.warn('[TabsLayout] Error checking onboarding status:', err)
    } finally {
      setOnboardingChecked(true)
    }
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
  }, [])

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false)
  }, [])

  return (
    <View style={styles.container}>
      {/* Investor Onboarding Modal */}
      <Modal
        visible={showOnboarding && onboardingChecked}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <InvestorOnboarding
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </Modal>

      {/* Banners at top with safe area padding */}
      <View style={{ paddingTop: insets.top }}>
        <OfflineBanner />
        <MarketAlertBanner />
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.brand[500],
          tabBarInactiveTintColor: colors.slate[400],
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="📊" label="Dashboard" />
            ),
          }}
          listeners={{
            tabPress: handleTabPress,
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'Leads',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="📍"
                label="Leads"
                badgeCount={hotLeadsCount}
              />
            ),
          }}
          listeners={{
            tabPress: handleTabPress,
          }}
        />
        {/* Placeholder for center FAB */}
        <Tabs.Screen
          name="driving-placeholder"
          options={{
            title: 'Drive',
            tabBarButton: () => <DrivingFAB />,
          }}
          listeners={{
            tabPress: (e) => {
              // Prevent default behavior
              e.preventDefault()
            },
          }}
        />
        <Tabs.Screen
          name="pipeline"
          options={{
            title: 'Pipeline',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="📋"
                label="Pipeline"
                badgeCount={criticalDealsCount}
              />
            ),
          }}
          listeners={{
            tabPress: handleTabPress,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="✅"
                label="Tasks"
                badgeCount={overdueCount}
              />
            ),
          }}
          listeners={{
            tabPress: handleTabPress,
          }}
        />
        {/* Hidden tabs - these files exist but shouldn't show in tab bar */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hide from tab bar - accessed via Dashboard header
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            href: null, // Hide from tab bar - search is on Dashboard
          }}
        />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    height: components.tabBar.height,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    maxWidth: 80,
  },
  iconWrapper: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: components.tabBar.iconSize,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error[500],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  fabContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  fabMenuBackdrop: {
    position: 'absolute',
    bottom: 70,
    left: -150,
    right: -150,
    height: 300,
    backgroundColor: 'transparent',
  },
  fabMenu: {
    position: 'absolute',
    bottom: 75,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    minWidth: 140,
    ...shadows.large,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  fabMenuItemFirst: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  fabMenuIcon: {
    fontSize: 18,
  },
  fabMenuLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  drivingFab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    ...shadows.large,
  },
  drivingFabActive: {
    backgroundColor: colors.slate[600],
  },
  drivingFabIcon: {
    fontSize: 24,
  },
  drivingFabLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginTop: 2,
  },
})
