/**
 * Card Component
 *
 * Rounded container with shadow, matching web design system.
 */

import React from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { colors, radii, shadows, spacing } from '../theme'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Padding size: 'sm' | 'md' | 'lg' */
  padding?: 'sm' | 'md' | 'lg' | 'none'
  /** Shadow intensity */
  shadow?: 'none' | 'soft' | 'softMd' | 'softLg'
  /** Border radius size */
  radius?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Card({
  children,
  style,
  padding = 'md',
  shadow = 'soft',
  radius = 'xl',
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        shadows[shadow],
        { borderRadius: radii[radius] },
        padding !== 'none' && { padding: paddingMap[padding] },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const paddingMap = {
  sm: spacing.sm + 4, // 12
  md: spacing.md,     // 16
  lg: spacing.lg,     // 24
}

// Card Header
interface CardHeaderProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Add bottom border */
  bordered?: boolean
}

export function CardHeader({ children, style, bordered = false }: CardHeaderProps) {
  return (
    <View
      style={[
        styles.header,
        bordered && styles.headerBordered,
        style,
      ]}
    >
      {children}
    </View>
  )
}

// Card Body
interface CardBodyProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function CardBody({ children, style }: CardBodyProps) {
  return <View style={[styles.body, style]}>{children}</View>
}

// Card Footer
interface CardFooterProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Add top border */
  bordered?: boolean
}

export function CardFooter({ children, style, bordered = false }: CardFooterProps) {
  return (
    <View
      style={[
        styles.footer,
        bordered && styles.footerBordered,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.5)', // slate-100/50
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerBordered: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    marginBottom: spacing.md,
  },
  body: {},
  footer: {
    marginTop: spacing.sm,
  },
  footerBordered: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    marginTop: spacing.md,
  },
})
