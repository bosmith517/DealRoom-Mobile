/**
 * Investor Onboarding Wizard
 *
 * Multi-step wizard to collect investor profile information for personalized AI analysis.
 * Steps: Experience, Financial, Goals, Time, Risk, Team, Market
 *
 * Mobile version - adapted from web implementation
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { aiService } from '../services/aiService'
import type { InvestorProfileUpdate } from '../types/ai'
import { colors } from '../theme'

// ============================================================================
// Types
// ============================================================================

type OnboardingStep = 'welcome' | 'experience' | 'financial' | 'goals' | 'time' | 'risk' | 'team' | 'market' | 'complete'

interface StepConfig {
  id: OnboardingStep
  title: string
  subtitle: string
  icon: string
}

const STEPS: StepConfig[] = [
  { id: 'welcome', title: 'Welcome', subtitle: "Train The Mantis", icon: '' },
  { id: 'experience', title: 'Experience', subtitle: 'Where are you at?', icon: '' },
  { id: 'financial', title: 'Capital', subtitle: 'What are you working with?', icon: '' },
  { id: 'goals', title: 'Goals', subtitle: 'What are you chasing?', icon: '' },
  { id: 'time', title: 'Availability', subtitle: 'How deep are you in?', icon: '' },
  { id: 'risk', title: 'Risk', subtitle: 'What keeps you up at night?', icon: '' },
  { id: 'team', title: 'Team', subtitle: 'Who you got?', icon: '' },
  { id: 'market', title: 'Market', subtitle: 'Where are you hunting?', icon: '' },
  { id: 'complete', title: 'Ready', subtitle: 'The Mantis is locked in', icon: '' },
]

interface InvestorOnboardingProps {
  onComplete?: () => void
  onSkip?: () => void
}

// ============================================================================
// Main Component
// ============================================================================

export const InvestorOnboarding: React.FC<InvestorOnboardingProps> = ({
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [profile, setProfile] = useState<Partial<InvestorProfileUpdate>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingBoxes, setGeneratingBoxes] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)

  // Load existing profile on mount
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const existingProfile = await aiService.getOrCreateInvestorProfile()
      if (existingProfile) {
        const cleanedProfile: Partial<InvestorProfileUpdate> = {}
        for (const [key, value] of Object.entries(existingProfile)) {
          if (value !== null) {
            (cleanedProfile as Record<string, unknown>)[key] = value
          }
        }
        setProfile(cleanedProfile)
        if (existingProfile.onboarding_completed) {
          setCurrentStep('complete')
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const progressPercent = Math.round((currentStepIndex / (STEPS.length - 1)) * 100)

  const updateProfile = (updates: Partial<InvestorProfileUpdate>) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const saveAndContinue = async (nextStep: OnboardingStep) => {
    setSaving(true)
    try {
      const completedSteps = [...(profile.onboarding_steps_completed || [])]
      if (currentStep !== 'welcome' && currentStep !== 'complete' && !completedSteps.includes(currentStep)) {
        completedSteps.push(currentStep)
      }

      await aiService.updateInvestorProfile({
        ...profile,
        onboarding_steps_completed: completedSteps,
      })

      setCurrentStep(nextStep)
    } catch (err) {
      console.error('Error saving profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      await aiService.updateInvestorProfile({
        ...profile,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })

      setGeneratingBoxes(true)
      const result = await aiService.generateBuyBoxesFromProfile()
      if (result) {
        setGeneratedCount(result.created)
      }

      setCurrentStep('complete')
    } catch (err) {
      console.error('Error completing onboarding:', err)
    } finally {
      setSaving(false)
      setGeneratingBoxes(false)
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand[600]} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Bar */}
        {currentStep !== 'welcome' && currentStep !== 'complete' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                Step {currentStepIndex} of {STEPS.length - 2}
              </Text>
              <Text style={styles.progressText}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        )}

        {/* Step Content */}
        <View style={styles.contentCard}>
          {currentStep === 'welcome' && (
            <WelcomeStep
              onContinue={() => saveAndContinue('experience')}
              onSkip={onSkip}
            />
          )}

          {currentStep === 'experience' && (
            <ExperienceStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('financial')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'financial' && (
            <FinancialStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('goals')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'goals' && (
            <GoalsStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('time')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'time' && (
            <TimeStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('risk')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'risk' && (
            <RiskStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('team')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'team' && (
            <TeamStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={() => saveAndContinue('market')}
              onBack={goBack}
              saving={saving}
            />
          )}

          {currentStep === 'market' && (
            <MarketStep
              profile={profile}
              updateProfile={updateProfile}
              onContinue={handleComplete}
              onBack={goBack}
              saving={saving || generatingBoxes}
            />
          )}

          {currentStep === 'complete' && (
            <CompleteStep
              generatedCount={generatedCount}
              onFinish={onComplete}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ============================================================================
// Step Components
// ============================================================================

interface StepProps {
  profile: Partial<InvestorProfileUpdate>
  updateProfile: (updates: Partial<InvestorProfileUpdate>) => void
  onContinue: () => void
  onBack: () => void
  saving: boolean
}

// Welcome Step
const WelcomeStep: React.FC<{ onContinue: () => void; onSkip?: () => void }> = ({
  onContinue,
  onSkip,
}) => (
  <View style={styles.welcomeContainer}>
    <Image
      source={require('../../assets/mantis-wealth.png')}
      style={styles.welcomeMascot}
      resizeMode="contain"
    />
    <Text style={styles.welcomeTitle}>Train The Mantis</Text>
    <Text style={styles.welcomeSubtitle}>
      The Mantis hunts deals your way—but first, it needs to know how you operate.
      Two minutes now saves you hours later.
    </Text>
    <TouchableOpacity style={styles.primaryButton} onPress={onContinue}>
      <Text style={styles.primaryButtonText}>Let's Go</Text>
    </TouchableOpacity>
    {onSkip && (
      <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipButtonText}>I'll wing it for now</Text>
      </TouchableOpacity>
    )}
  </View>
)

// Experience Step
const ExperienceStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const experienceLevels = [
    { value: 'beginner', label: 'Just Starting', desc: "Learning the ropes" },
    { value: 'intermediate', label: 'Got Some Reps', desc: "1-5 deals under my belt" },
    { value: 'advanced', label: 'Been Around', desc: "6-20 deals done" },
    { value: 'expert', label: 'Seasoned Pro', desc: "20+ deals and counting" },
  ]

  const strategies = [
    { value: 'flip', label: 'Fix & Flip' },
    { value: 'brrrr', label: 'BRRRR' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'hold', label: 'Buy & Hold' },
  ]

  const toggleStrategy = (strategy: string) => {
    const current = profile.strategies_executed || []
    const updated = current.includes(strategy)
      ? current.filter(s => s !== strategy)
      : [...current, strategy]
    updateProfile({ strategies_executed: updated })
  }

  return (
    <View>
      <Text style={styles.stepTitle}>What's Your Deal Count?</Text>
      <Text style={styles.stepSubtitle}>No judgment—we all started somewhere.</Text>

      <View style={styles.optionsGrid}>
        {experienceLevels.map(level => (
          <TouchableOpacity
            key={level.value}
            onPress={() => updateProfile({ experience_level: level.value })}
            style={[
              styles.optionCard,
              profile.experience_level === level.value && styles.optionCardSelected,
            ]}
          >
            <Text style={styles.optionLabel}>{level.label}</Text>
            <Text style={styles.optionDesc}>{level.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {profile.experience_level && profile.experience_level !== 'beginner' && (
        <>
          <Text style={styles.sectionLabel}>What plays have you run?</Text>
          <View style={styles.tagsRow}>
            {strategies.map(s => (
              <TouchableOpacity
                key={s.value}
                onPress={() => toggleStrategy(s.value)}
                style={[
                  styles.tag,
                  (profile.strategies_executed || []).includes(s.value) && styles.tagSelected,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    (profile.strategies_executed || []).includes(s.value) && styles.tagTextSelected,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !profile.experience_level && styles.buttonDisabled]}
          onPress={onContinue}
          disabled={!profile.experience_level || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Financial Step
const FinancialStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const capitalRanges = [
    { value: 'under_25k', label: 'Under $25K' },
    { value: '25k_50k', label: '$25K - $50K' },
    { value: '50k_100k', label: '$50K - $100K' },
    { value: '100k_250k', label: '$100K - $250K' },
    { value: '250k_500k', label: '$250K - $500K' },
    { value: 'over_500k', label: '$500K+' },
  ]

  const fundingSources = [
    { value: 'cash', label: 'Cash' },
    { value: 'hard_money', label: 'Hard Money' },
    { value: 'private_money', label: 'Private Money' },
    { value: 'conventional', label: 'Conventional' },
    { value: 'heloc', label: 'HELOC' },
    { value: 'partners', label: 'Partners/JV' },
  ]

  const toggleFunding = (source: string) => {
    const current = profile.funding_sources || []
    const updated = current.includes(source)
      ? current.filter(s => s !== source)
      : [...current, source]
    updateProfile({ funding_sources: updated })
  }

  return (
    <View>
      <Text style={styles.stepTitle}>What's Your Firepower?</Text>
      <Text style={styles.stepSubtitle}>How much capital can you put to work?</Text>

      <View style={styles.optionsGrid}>
        {capitalRanges.map(range => (
          <TouchableOpacity
            key={range.value}
            onPress={() => updateProfile({ capital_range: range.value })}
            style={[
              styles.optionCard,
              profile.capital_range === range.value && styles.optionCardSelected,
            ]}
          >
            <Text style={styles.optionLabel}>{range.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>How are you funding deals?</Text>
      <View style={styles.tagsRow}>
        {fundingSources.map(s => (
          <TouchableOpacity
            key={s.value}
            onPress={() => toggleFunding(s.value)}
            style={[
              styles.tag,
              (profile.funding_sources || []).includes(s.value) && styles.tagSelected,
            ]}
          >
            <Text
              style={[
                styles.tagText,
                (profile.funding_sources || []).includes(s.value) && styles.tagTextSelected,
              ]}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !profile.capital_range && styles.buttonDisabled]}
          onPress={onContinue}
          disabled={!profile.capital_range || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Goals Step
const GoalsStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const goals = [
    { value: 'quick_profits', label: 'Quick Cash', desc: 'Flip it, wholesale it, move on' },
    { value: 'cash_flow', label: 'Monthly Checks', desc: 'Build that rental income' },
    { value: 'wealth_building', label: 'Long Game', desc: 'Stack equity over time' },
    { value: 'portfolio_growth', label: 'Scale Up', desc: 'More doors, more deals' },
    { value: 'retirement', label: 'Freedom Fund', desc: 'Replace the 9-5 eventually' },
  ]

  return (
    <View>
      <Text style={styles.stepTitle}>What's the Play?</Text>
      <Text style={styles.stepSubtitle}>What are you optimizing for right now?</Text>

      {goals.map(goal => (
        <TouchableOpacity
          key={goal.value}
          onPress={() => updateProfile({ primary_goal: goal.value })}
          style={[
            styles.listOptionCard,
            profile.primary_goal === goal.value && styles.optionCardSelected,
          ]}
        >
          <Text style={styles.optionLabel}>{goal.label}</Text>
          <Text style={styles.optionDesc}>{goal.desc}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !profile.primary_goal && styles.buttonDisabled]}
          onPress={onContinue}
          disabled={!profile.primary_goal || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Time Step
const TimeStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const timeOptions = [
    { value: 5, label: '< 5 hours', desc: 'Squeezing it in' },
    { value: 10, label: '5-10 hours', desc: 'Nights and weekends' },
    { value: 20, label: '10-20 hours', desc: 'Serious side hustle' },
    { value: 40, label: '20-40 hours', desc: 'Half to full-time' },
    { value: 50, label: '40+ hours', desc: 'This IS the job' },
  ]

  const workStyles = [
    { value: 'hands_on', label: 'Hands-On' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'delegator', label: 'Delegator' },
  ]

  return (
    <View>
      <Text style={styles.stepTitle}>How Much Bandwidth?</Text>
      <Text style={styles.stepSubtitle}>Hours per week you can dedicate to deals.</Text>

      {timeOptions.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => updateProfile({ hours_per_week: opt.value })}
          style={[
            styles.listOptionCard,
            profile.hours_per_week === opt.value && styles.optionCardSelected,
          ]}
        >
          <Text style={styles.optionLabel}>{opt.label}</Text>
          <Text style={styles.optionDesc}>{opt.desc}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionLabel}>How do you like to operate?</Text>
      <View style={styles.tagsRow}>
        {workStyles.map(style => (
          <TouchableOpacity
            key={style.value}
            onPress={() => updateProfile({ preferred_work_style: style.value })}
            style={[
              styles.tag,
              profile.preferred_work_style === style.value && styles.tagSelected,
            ]}
          >
            <Text
              style={[
                styles.tagText,
                profile.preferred_work_style === style.value && styles.tagTextSelected,
              ]}
            >
              {style.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !profile.hours_per_week && styles.buttonDisabled]}
          onPress={onContinue}
          disabled={!profile.hours_per_week || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Risk Step
const RiskStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const riskLevels = [
    { value: 'conservative', label: 'Play It Safe', desc: 'Clean deals only. No surprises.' },
    { value: 'moderate', label: 'Calculated Risks', desc: 'Some hair on it is fine.' },
    { value: 'aggressive', label: 'Swing Big', desc: "If the numbers work, let's go." },
  ]

  const aversions = [
    { value: 'foundation_issues', label: 'Foundation Issues' },
    { value: 'mold', label: 'Mold/Water Damage' },
    { value: 'structural', label: 'Structural Problems' },
    { value: 'title_issues', label: 'Title Issues' },
    { value: 'flood_zone', label: 'Flood Zones' },
  ]

  const toggleAversion = (aversion: string) => {
    const current = profile.risk_aversions || []
    const updated = current.includes(aversion)
      ? current.filter(a => a !== aversion)
      : [...current, aversion]
    updateProfile({ risk_aversions: updated })
  }

  return (
    <View>
      <Text style={styles.stepTitle}>What's Your Risk Appetite?</Text>
      <Text style={styles.stepSubtitle}>Be honest—we won't show you stuff that'll stress you out.</Text>

      {riskLevels.map(level => (
        <TouchableOpacity
          key={level.value}
          onPress={() => updateProfile({ risk_tolerance: level.value })}
          style={[
            styles.listOptionCard,
            profile.risk_tolerance === level.value && styles.optionCardSelected,
          ]}
        >
          <Text style={styles.optionLabel}>{level.label}</Text>
          <Text style={styles.optionDesc}>{level.desc}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionLabel}>Hard pass on any of these?</Text>
      <View style={styles.tagsRow}>
        {aversions.map(a => (
          <TouchableOpacity
            key={a.value}
            onPress={() => toggleAversion(a.value)}
            style={[
              styles.tag,
              (profile.risk_aversions || []).includes(a.value) && styles.tagDanger,
            ]}
          >
            <Text
              style={[
                styles.tagText,
                (profile.risk_aversions || []).includes(a.value) && styles.tagTextDanger,
              ]}
            >
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !profile.risk_tolerance && styles.buttonDisabled]}
          onPress={onContinue}
          disabled={!profile.risk_tolerance || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Team Step
const TeamStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const teamMembers = [
    { key: 'has_contractor', label: 'Contractor/GC', desc: 'Someone to swing hammers' },
    { key: 'has_agent', label: 'Real Estate Agent', desc: 'Boots on the ground' },
    { key: 'has_property_manager', label: 'Property Manager', desc: 'Handles the tenants' },
    { key: 'has_mentor', label: 'Mentor/Coach', desc: 'Been there, done that' },
  ]

  return (
    <View>
      <Text style={styles.stepTitle}>Who's in Your Corner?</Text>
      <Text style={styles.stepSubtitle}>Check anyone you've got on speed dial.</Text>

      {teamMembers.map(member => {
        const isSelected = Boolean(profile[member.key as keyof typeof profile])
        return (
          <TouchableOpacity
            key={member.key}
            onPress={() => updateProfile({ [member.key]: !isSelected })}
            style={[
              styles.listOptionCard,
              isSelected && styles.optionCardSelected,
            ]}
          >
            <View style={styles.teamRow}>
              <View style={styles.teamInfo}>
                <Text style={styles.optionLabel}>{member.label}</Text>
                <Text style={styles.optionDesc}>{member.desc}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxChecked,
                ]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          </TouchableOpacity>
        )
      })}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Market Step
const MarketStep: React.FC<StepProps> = ({
  profile,
  updateProfile,
  onContinue,
  onBack,
  saving,
}) => {
  const [zipInput, setZipInput] = useState('')

  const addZip = () => {
    const zip = zipInput.trim()
    if (zip && zip.length === 5 && /^\d+$/.test(zip)) {
      const current = profile.target_zips || []
      if (!current.includes(zip)) {
        updateProfile({ target_zips: [...current, zip] })
      }
      setZipInput('')
    }
  }

  const removeZip = (zip: string) => {
    const current = profile.target_zips || []
    updateProfile({ target_zips: current.filter(z => z !== zip) })
  }

  return (
    <View>
      <Text style={styles.stepTitle}>Where Are You Hunting?</Text>
      <Text style={styles.stepSubtitle}>Your home turf and target zones.</Text>

      <View style={styles.inputRow}>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>Home Market City</Text>
          <TextInput
            style={styles.textInput}
            value={profile.home_market_city || ''}
            onChangeText={text => updateProfile({ home_market_city: text })}
            placeholder="e.g., Denver"
            placeholderTextColor={colors.slate[400]}
          />
        </View>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>State</Text>
          <TextInput
            style={styles.textInput}
            value={profile.home_market_state || ''}
            onChangeText={text => updateProfile({ home_market_state: text.toUpperCase() })}
            placeholder="e.g., CO"
            placeholderTextColor={colors.slate[400]}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Target ZIP Codes</Text>
      <View style={styles.zipInputRow}>
        <TextInput
          style={[styles.textInput, { flex: 1, marginRight: 8 }]}
          value={zipInput}
          onChangeText={setZipInput}
          placeholder="Enter ZIP"
          placeholderTextColor={colors.slate[400]}
          keyboardType="number-pad"
          maxLength={5}
          onSubmitEditing={addZip}
        />
        <TouchableOpacity style={styles.addButton} onPress={addZip}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tagsRow}>
        {(profile.target_zips || []).map(zip => (
          <View key={zip} style={styles.zipTag}>
            <Text style={styles.zipTagText}>{zip}</Text>
            <TouchableOpacity onPress={() => removeZip(zip)}>
              <Text style={styles.zipRemove}>x</Text>
            </TouchableOpacity>
          </View>
        ))}
        {(profile.target_zips || []).length === 0 && (
          <Text style={styles.noZipsText}>No ZIPs added yet</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => updateProfile({ comfortable_remote_investing: !profile.comfortable_remote_investing })}
      >
        <View
          style={[
            styles.checkbox,
            profile.comfortable_remote_investing && styles.checkboxChecked,
          ]}
        >
          {profile.comfortable_remote_investing && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>
          I'm down to invest outside my backyard
        </Text>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Lock It In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Complete Step
const CompleteStep: React.FC<{ generatedCount: number; onFinish?: () => void }> = ({
  generatedCount,
  onFinish,
}) => (
  <View style={styles.welcomeContainer}>
    <Text style={styles.welcomeEmoji}>🔥</Text>
    <Text style={styles.welcomeTitle}>The Mantis Is Ready</Text>
    <Text style={styles.welcomeSubtitle}>
      Sharp eyes. Your criteria. The Mantis now knows exactly what you're looking
      for and how you like to operate. Time to hunt.
    </Text>

    {generatedCount > 0 && (
      <View style={styles.successBanner}>
        <Text style={styles.successText}>
          🎯 The Mantis created {generatedCount} Buy {generatedCount === 1 ? 'Box' : 'Boxes'} based on your profile
        </Text>
      </View>
    )}

    <TouchableOpacity style={styles.primaryButton} onPress={onFinish}>
      <Text style={styles.primaryButtonText}>Start Hunting</Text>
    </TouchableOpacity>
  </View>
)

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: colors.slate[500],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.slate[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand[600],
    borderRadius: 4,
  },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  welcomeMascot: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.slate[800],
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.slate[600],
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: colors.brand[600],
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.slate[500],
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate[800],
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.slate[500],
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  optionCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  optionCardSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  listOptionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate[800],
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: colors.slate[500],
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.slate[700],
    marginBottom: 12,
    marginTop: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.slate[100],
    marginRight: 8,
    marginBottom: 8,
  },
  tagSelected: {
    backgroundColor: colors.brand[600],
  },
  tagDanger: {
    backgroundColor: colors.error[600] + '20',
    borderWidth: 1,
    borderColor: colors.error[600],
  },
  tagText: {
    fontSize: 14,
    color: colors.slate[600],
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#fff',
  },
  tagTextDanger: {
    color: colors.error[600],
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.slate[600],
    fontWeight: '500',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.slate[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.slate[700],
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.slate[800],
    backgroundColor: '#fff',
  },
  zipInputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: colors.slate[200],
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.slate[700],
    fontWeight: '600',
  },
  zipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[100],
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  zipTagText: {
    color: colors.brand[700],
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  zipRemove: {
    color: colors.brand[700],
    fontSize: 14,
    fontWeight: '700',
  },
  noZipsText: {
    fontSize: 14,
    color: colors.slate[400],
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.slate[50],
    borderRadius: 12,
    marginTop: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.slate[700],
    marginLeft: 12,
  },
  successBanner: {
    backgroundColor: colors.success[600] + '20',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  successText: {
    color: colors.success[600],
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
})

export default InvestorOnboarding
