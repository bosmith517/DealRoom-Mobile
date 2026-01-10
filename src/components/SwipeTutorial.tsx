/**
 * SwipeTutorial Component
 *
 * First-time user tutorial overlay for the triage swipe screen.
 * Shows animated gestures and step-by-step instructions for each swipe direction.
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
  Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, radii, typography } from '../theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const TUTORIAL_KEY = 'flipmantis_triage_tutorial_seen'

// Tutorial steps
const TUTORIAL_STEPS = [
  {
    direction: 'right',
    icon: 'arrow-forward',
    title: 'Swipe RIGHT',
    subtitle: 'Queue for Analysis',
    description: 'Add to your analyze queue for deeper evaluation',
    color: '#10B981', // Green
  },
  {
    direction: 'left',
    icon: 'arrow-back',
    title: 'Swipe LEFT',
    subtitle: 'Pass',
    description: "Not a fit? Swipe left to dismiss",
    color: '#EF4444', // Red
  },
  {
    direction: 'up',
    icon: 'arrow-up',
    title: 'Swipe UP',
    subtitle: 'Watch',
    description: 'Add to watch list for 14-day follow-up',
    color: '#F59E0B', // Orange
  },
  {
    direction: 'down',
    icon: 'arrow-down',
    title: 'Swipe DOWN',
    subtitle: 'Contact',
    description: 'Hot lead! Queue for immediate outreach',
    color: '#3B82F6', // Blue
  },
]

interface SwipeTutorialProps {
  onComplete: () => void
}

export function SwipeTutorial({ onComplete }: SwipeTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const arrowAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  const step = TUTORIAL_STEPS[currentStep]

  useEffect(() => {
    // Fade in on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    // Start arrow animation
    startArrowAnimation()
  }, [])

  useEffect(() => {
    // Reset and restart arrow animation on step change
    arrowAnim.setValue(0)
    slideAnim.setValue(0)
    startArrowAnimation()
  }, [currentStep])

  const startArrowAnimation = () => {
    const direction = TUTORIAL_STEPS[currentStep].direction

    // Determine animation direction
    let toValue = { x: 0, y: 0 }
    if (direction === 'right') toValue = { x: 50, y: 0 }
    else if (direction === 'left') toValue = { x: -50, y: 0 }
    else if (direction === 'up') toValue = { x: 0, y: -50 }
    else if (direction === 'down') toValue = { x: 0, y: 50 }

    // Continuous sliding animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: direction === 'left' || direction === 'right' ? toValue.x : toValue.y,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    ).start()

    // Pulse animation for arrow icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = async () => {
    if (dontShowAgain) {
      try {
        await AsyncStorage.setItem(TUTORIAL_KEY, 'true')
      } catch (error) {
        console.error('Error saving tutorial preference:', error)
      }
    }

    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onComplete()
    })
  }

  const getArrowTransform = () => {
    const direction = step.direction
    if (direction === 'left' || direction === 'right') {
      return [{ translateX: slideAnim }]
    }
    return [{ translateY: slideAnim }]
  }

  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Background */}
      <View style={styles.backdrop} />

      {/* Content */}
      <View style={styles.content}>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {TUTORIAL_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                index === currentStep && styles.stepDotActive,
                index < currentStep && styles.stepDotComplete,
              ]}
            />
          ))}
        </View>

        {/* Animated gesture illustration */}
        <View style={styles.gestureContainer}>
          {/* Phone mockup */}
          <View style={styles.phoneMockup}>
            <View style={styles.cardMockup}>
              <View style={styles.cardPhotoMockup} />
              <View style={styles.cardInfoMockup}>
                <View style={styles.cardLineMockup} />
                <View style={[styles.cardLineMockup, { width: '60%' }]} />
              </View>
            </View>

            {/* Animated arrow */}
            <Animated.View
              style={[
                styles.arrowContainer,
                { backgroundColor: step.color + '30' },
                { transform: getArrowTransform() },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons
                  name={step.icon as any}
                  size={48}
                  color={step.color}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <Text style={[styles.title, { color: step.color }]}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.primaryButton, { backgroundColor: step.color }]}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>
              {isLastStep ? "Got it!" : 'Next'}
            </Text>
            {!isLastStep && (
              <Ionicons name="arrow-forward" size={18} color="white" />
            )}
          </Pressable>

          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip tutorial</Text>
          </Pressable>
        </View>

        {/* Don't show again checkbox (only on last step) */}
        {isLastStep && (
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain(!dontShowAgain)}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
            <Text style={styles.checkboxLabel}>Don't show this again</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

// Check if tutorial should be shown
export async function shouldShowTutorial(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(TUTORIAL_KEY)
    return seen !== 'true'
  } catch (error) {
    console.error('Error checking tutorial status:', error)
    return true // Show tutorial on error
  }
}

// Reset tutorial (for testing or settings)
export async function resetTutorial(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TUTORIAL_KEY)
  } catch (error) {
    console.error('Error resetting tutorial:', error)
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  content: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    maxWidth: 340,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    width: 24,
    backgroundColor: colors.white,
  },
  stepDotComplete: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  gestureContainer: {
    marginBottom: spacing.xl,
  },
  phoneMockup: {
    width: 200,
    height: 280,
    backgroundColor: colors.slate[800],
    borderRadius: radii.xl,
    padding: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cardMockup: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  cardPhotoMockup: {
    height: '50%',
    backgroundColor: colors.slate[200],
  },
  cardInfoMockup: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardLineMockup: {
    height: 12,
    backgroundColor: colors.slate[200],
    borderRadius: radii.sm,
    width: '80%',
  },
  arrowContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: -40,
    marginLeft: -40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.slate[400],
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    color: colors.slate[500],
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.slate[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  checkboxLabel: {
    color: colors.slate[400],
    fontSize: 14,
  },
})

export default SwipeTutorial
