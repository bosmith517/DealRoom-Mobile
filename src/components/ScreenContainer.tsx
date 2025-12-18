/**
 * ScreenContainer Component
 *
 * Safe area + scroll wrapper for screens.
 * Provides consistent padding and background.
 */

import React from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'

interface ScreenContainerProps {
  children: React.ReactNode
  /** Container style */
  style?: StyleProp<ViewStyle>
  /** Content container style */
  contentContainerStyle?: StyleProp<ViewStyle>
  /** Use scroll view */
  scrollable?: boolean
  /** Background color */
  backgroundColor?: string
  /** Horizontal padding */
  padding?: boolean
  /** Safe area edges to respect */
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
  /** Enable keyboard avoiding */
  keyboardAvoiding?: boolean
  /** Pull to refresh */
  onRefresh?: () => void
  /** Refresh loading state */
  refreshing?: boolean
  /** Header component (rendered above scroll content) */
  header?: React.ReactNode
  /** Footer component (rendered below scroll content) */
  footer?: React.ReactNode
}

export function ScreenContainer({
  children,
  style,
  contentContainerStyle,
  scrollable = true,
  backgroundColor = colors.paper,
  padding = true,
  edges = ['top', 'bottom'],
  keyboardAvoiding = true,
  onRefresh,
  refreshing = false,
  header,
  footer,
}: ScreenContainerProps) {
  const content = (
    <>
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            padding && styles.padding,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand[500]}
                colors={[colors.brand[500]]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            padding && styles.padding,
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
      )}
      {footer}
    </>
  )

  const containerContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  )

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }, style]}
      edges={edges}
    >
      {containerContent}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
  padding: {
    paddingHorizontal: spacing.md,
  },
})

// Simple View Container (no scroll, no safe area)
interface ViewContainerProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  backgroundColor?: string
  padding?: boolean
}

export function ViewContainer({
  children,
  style,
  backgroundColor = colors.paper,
  padding = true,
}: ViewContainerProps) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        padding && styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  )
}

// Centered Container (for login screens, empty states)
interface CenteredContainerProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  backgroundColor?: string
}

export function CenteredContainer({
  children,
  style,
  backgroundColor = colors.paper,
}: CenteredContainerProps) {
  return (
    <SafeAreaView
      style={[centeredStyles.container, { backgroundColor }, style]}
      edges={['top', 'bottom']}
    >
      <View style={centeredStyles.content}>{children}</View>
    </SafeAreaView>
  )
}

const centeredStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
})
