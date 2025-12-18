/**
 * Input Component
 *
 * Text input with label and error state, matching web design system.
 */

import React, { useState } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
  TouchableOpacity,
} from 'react-native'
import { colors, radii, spacing, typography, components } from '../theme'

type InputSize = 'sm' | 'md' | 'lg'

interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Input label */
  label?: string
  /** Error message */
  error?: string
  /** Helper text */
  helperText?: string
  /** Input size */
  size?: InputSize
  /** Left icon/element */
  leftIcon?: React.ReactNode
  /** Right icon/element */
  rightIcon?: React.ReactNode
  /** Container style */
  containerStyle?: StyleProp<ViewStyle>
  /** Input style */
  inputStyle?: StyleProp<TextStyle>
  /** Label style */
  labelStyle?: StyleProp<TextStyle>
  /** Required field */
  required?: boolean
}

export function Input({
  label,
  error,
  helperText,
  size = 'md',
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  required = false,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const hasError = Boolean(error)

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          styles[`inputContainer_${size}`],
          isFocused && styles.inputContainerFocused,
          hasError && styles.inputContainerError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            styles[`input_${size}`],
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon ? styles.inputWithRightIcon : null,
            inputStyle,
          ]}
          placeholderTextColor={colors.slate[400]}
          onFocus={(e) => {
            setIsFocused(true)
            textInputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            textInputProps.onBlur?.(e)
          }}
        />

        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>

      {(error || helperText) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error[500],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: components.input.borderWidth,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
  },
  inputContainer_sm: {
    height: components.input.height.sm,
  },
  inputContainer_md: {
    height: components.input.height.md,
  },
  inputContainer_lg: {
    height: components.input.height.lg,
  },
  inputContainerFocused: {
    borderColor: colors.brand[500],
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: colors.error[500],
  },
  input: {
    flex: 1,
    color: colors.ink,
    paddingHorizontal: spacing.md,
  },
  input_sm: {
    fontSize: typography.fontSize.sm,
  },
  input_md: {
    fontSize: typography.fontSize.base,
  },
  input_lg: {
    fontSize: typography.fontSize.lg,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  leftIcon: {
    paddingLeft: spacing.sm + 4,
  },
  rightIcon: {
    paddingRight: spacing.sm + 4,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error[500],
  },
})

// Textarea Component
interface TextareaProps extends InputProps {
  /** Number of visible lines */
  numberOfLines?: number
}

export function Textarea({
  numberOfLines = 4,
  ...props
}: TextareaProps) {
  return (
    <Input
      {...props}
      multiline
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      inputStyle={[
        {
          height: 24 * numberOfLines, // Approximate line height
          paddingTop: spacing.sm + 4,
          paddingBottom: spacing.sm + 4,
        },
        props.inputStyle,
      ]}
    />
  )
}

// Search Input Component
interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  onClear?: () => void
}

export function SearchInput({
  value,
  onClear,
  ...props
}: SearchInputProps) {
  return (
    <Input
      {...props}
      value={value}
      leftIcon={
        <Text style={{ color: colors.slate[400], fontSize: 18 }}>🔍</Text>
      }
      rightIcon={
        value ? (
          <TouchableOpacity onPress={onClear}>
            <Text style={{ color: colors.slate[400], fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  )
}
