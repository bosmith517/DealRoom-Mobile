/**
 * Tabs Layout
 *
 * Bottom tab navigator for main app screens.
 */

import { Tabs } from 'expo-router'
import { View, StyleSheet, Text } from 'react-native'
import { colors, components, typography } from '../../src/theme'

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

export default function TabsLayout() {
  return (
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
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🔍" label="Search" />
          ),
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
  )
}

const styles = StyleSheet.create({
  tabBar: {
    height: components.tabBar.height,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingBottom: 20,
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
})
