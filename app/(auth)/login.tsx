/**
 * Login Screen
 *
 * Email/password authentication.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, Pressable, Linking, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { CenteredContainer, Card, Button, Input } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'

// FlipMantis logo
const LOGO = require('../../assets/emblem-transparent.png')

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {}

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return

    setIsLoading(true)
    try {
      const { error } = await signIn(email, password)

      if (error) {
        Alert.alert('Login Failed', error.message || 'Invalid email or password')
      }
      // Navigation is handled by AuthNavigationGuard in root layout
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first.')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'dealroom://reset-password',
      })

      if (error) {
        Alert.alert('Error', error.message)
      } else {
        Alert.alert(
          'Check Your Email',
          'If an account exists with this email, you will receive a password reset link.'
        )
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.')
    }
  }

  const handleContactSales = () => {
    Linking.openURL('mailto:support@tradeworksflow.com?subject=FlipMantis%20Access%20Request')
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <CenteredContainer>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logoText}>FlipMantis</Text>
          <Text style={styles.tagline}>Real Estate Deal Management</Text>
        </View>

        {/* Login Form */}
        <Card style={styles.formCard} padding="lg">
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>
            Sign in to continue to your deals
          </Text>

          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            error={errors.password}
          />

          <Button
            fullWidth
            loading={isLoading}
            onPress={handleLogin}
            style={styles.loginButton}
          >
            Sign In
          </Button>

          <Pressable onPress={handleForgotPassword}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </Pressable>
        </Card>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <Pressable onPress={handleContactSales}>
            <Text style={styles.signUpLink}>Contact Sales</Text>
          </Pressable>
        </View>
      </CenteredContainer>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  tagline: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
  },
  formTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
  forgotPassword: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    textAlign: 'center',
    marginTop: spacing.md,
  },
  signUpContainer: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  signUpText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  signUpLink: {
    fontSize: typography.fontSize.sm,
    color: colors.brand[600],
    fontWeight: typography.fontWeight.medium,
  },
})
