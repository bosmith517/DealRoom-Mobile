/**
 * Root Layout
 *
 * Provides AuthProvider and navigation setup.
 */

// Polyfills for Supabase compatibility
import 'react-native-url-polyfill/auto'

import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'
import { OfflineProvider } from '../src/contexts/OfflineContext'
import { colors } from '../src/theme'
import { View, ActivityIndicator, StyleSheet } from 'react-native'

// Auth navigation guard
function AuthNavigationGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hasEntitlement } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const seg0 = segments?.[0]
    const inAuthGroup = seg0 === '(auth)'
    const inPortal = seg0 === 'portal'
    const inUpgrade = seg0 === 'upgrade'

    // Portal routes are public - no auth required
    if (inPortal) return

    // Not authenticated - force to login
    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login')
      return
    }

    // Authenticated - check entitlement
    const entitled = hasEntitlement('dealroom')

    if (!entitled) {
      // Not entitled - force to upgrade from anywhere except upgrade
      if (!inUpgrade) router.replace('/upgrade')
      return
    }

    // Entitled - redirect away from auth/upgrade screens
    if (inAuthGroup || inUpgrade) router.replace('/(tabs)')
  }, [isAuthenticated, isLoading, segments, router, hasEntitlement])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    )
  }

  return <>{children}</>
}

// Root layout component
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OfflineProvider>
            <AuthNavigationGuard>
              <StatusBar style="auto" />
              <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.paper },
                animation: 'slide_from_right',
              }}
            >
              {/* Auth screens (guest only) */}
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />

              {/* Main app (authenticated + entitled) */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

              {/* Portal (public) */}
              <Stack.Screen
                name="portal/[token]"
                options={{
                  headerShown: true,
                  title: 'Portal',
                  headerStyle: { backgroundColor: colors.brand[500] },
                  headerTintColor: colors.white,
                }}
              />

              {/* Property detail stack */}
              <Stack.Screen
                name="property/[assetId]"
                options={{
                  headerShown: true,
                  title: 'Property',
                  headerStyle: { backgroundColor: colors.white },
                  headerTintColor: colors.ink,
                }}
              />

              {/* Evaluation stack */}
              <Stack.Screen
                name="evaluation/[sessionId]"
                options={{
                  headerShown: true,
                  title: 'Evaluation',
                  headerStyle: { backgroundColor: colors.white },
                  headerTintColor: colors.ink,
                }}
              />

              {/* Upgrade screen */}
              <Stack.Screen
                name="upgrade"
                options={{
                  headerShown: true,
                  title: 'Upgrade',
                  headerStyle: { backgroundColor: colors.brand[500] },
                  headerTintColor: colors.white,
                }}
              />
            </Stack>
            </AuthNavigationGuard>
          </OfflineProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
})
