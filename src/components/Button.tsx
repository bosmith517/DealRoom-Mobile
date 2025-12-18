/**
 * Button Component
 *
 * Primary, outline, and ghost variants matching web design system.
 */

import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native'
import { colors, radii, spacing, typography, components } from '../theme'

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: React.ReactNode
  onPress?: () => void
  /** Button variant */
  variant?: ButtonVariant
  /** Button size */
  size?: ButtonSize
  /** Full width button */
  fullWidth?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Loading state */
  loading?: boolean
  /** Left icon */
  leftIcon?: React.ReactNode
  /** Right icon */
  rightIcon?: React.ReactNode
  /** Custom style */
  style?: StyleProp<ViewStyle>
  /** Custom text style */
  textStyle?: StyleProp<TextStyle>
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        isDisabled && styles[`${variant}_disabled`],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'success' || variant === 'danger'
            ? colors.white
            : colors.brand[500]
          }
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <Text
            style={[
              styles.text,
              styles[`text_${variant}`],
              styles[`text_${size}`],
              isDisabled && styles.textDisabled,
              textStyle,
            ]}
          >
            {children}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  primary: {
    backgroundColor: colors.brand[500],
    borderWidth: 0,
  },
  primary_disabled: {},
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand[500],
  },
  outline_disabled: {
    borderColor: colors.slate[300],
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  ghost_disabled: {},
  success: {
    backgroundColor: colors.success[500],
    borderWidth: 0,
  },
  success_disabled: {},
  danger: {
    backgroundColor: colors.error[500],
    borderWidth: 0,
  },
  danger_disabled: {},

  // Sizes
  size_sm: {
    height: components.button.height.sm,
    paddingHorizontal: components.button.paddingHorizontal.sm,
  },
  size_md: {
    height: components.button.height.md,
    paddingHorizontal: components.button.paddingHorizontal.md,
  },
  size_lg: {
    height: components.button.height.lg,
    paddingHorizontal: components.button.paddingHorizontal.lg,
  },

  // Text
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
  text_primary: {
    color: colors.white,
  },
  text_outline: {
    color: colors.brand[600],
  },
  text_ghost: {
    color: colors.brand[600],
  },
  text_success: {
    color: colors.white,
  },
  text_danger: {
    color: colors.white,
  },
  text_sm: {
    fontSize: typography.fontSize.sm,
  },
  text_md: {
    fontSize: typography.fontSize.base,
  },
  text_lg: {
    fontSize: typography.fontSize.lg,
  },
  textDisabled: {
    color: colors.slate[400],
  },
})

// Icon Button Component
interface IconButtonProps {
  icon: React.ReactNode
  onPress: () => void
  variant?: 'primary' | 'outline' | 'ghost'
  size?: ButtonSize
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  icon,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  style,
}: IconButtonProps) {
  const sizeMap = {
    sm: 36,
    md: 44,
    lg: 52,
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        iconStyles.base,
        iconStyles[variant],
        {
          width: sizeMap[size],
          height: sizeMap[size],
          borderRadius: sizeMap[size] / 2,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  )
}

const iconStyles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.brand[500],
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
})
