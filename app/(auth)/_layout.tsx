/**
 * Auth Layout
 *
 * Layout for authentication screens (login, signup, etc.)
 */

import { Stack } from 'expo-router'
import { colors } from '../../src/theme'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  )
}
