/**
 * Tabs Layout
 *
 * Bottom tab navigator for main app screens.
 * Includes a prominent "Driving" FAB in the center.
 * Shows OfflineBanner when offline or syncing.
 */

import { Tabs, useRouter } from 'expo-router'
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, components, typography, shadows } from '../../src/theme'
import { OfflineBanner } from '../../src/components/OfflineBanner'

// Tab icon component
function TabIcon({
  focused,
  icon,
  label,
}: {
  focused: boolean
  icon: string
  label: string
}) {
  return (
    <View style={styles.tabIconContainer}>
      <Text
        style={[
          styles.tabIcon,
          { color: focused ? colors.brand[500] : colors.slate[400] },
        ]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.brand[500] : colors.slate[400] },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

// Driving FAB component
function DrivingFAB() {
  const router = useRouter()

  return (
    <TouchableOpacity
      style={styles.drivingFab}
      onPress={() => router.push('/driving')}
      activeOpacity={0.8}
    >
      <Text style={styles.drivingFabIcon}>🚗</Text>
      <Text style={styles.drivingFabLabel}>Drive</Text>
    </TouchableOpacity>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      {/* Offline banner at top with safe area padding */}
      <View style={{ paddingTop: insets.top }}>
        <OfflineBanner />
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
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'Leads',
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="📍" label="Leads" />
            ),
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
              <TabIcon focused={focused} icon="📋" label="Pipeline" />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="👤" label="Profile" />
            ),
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
  },
  tabIcon: {
    fontSize: components.tabBar.iconSize,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
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
