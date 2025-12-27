/**
 * Buy Box Setup Screen
 *
 * Configure investment criteria for AI-powered scoring and matching.
 * The AI uses these preferences to:
 * - Score leads (match % against your criteria)
 * - Prioritize the swipe deck
 * - Generate smarter underwriting suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { colors, spacing, radii } from '../src/theme';
import { getActiveBuyBox, createBuyBox, updateBuyBox, BuyBox } from '../src/services';

// Property types
const PROPERTY_TYPES = [
  { key: 'sfr', label: 'Single Family' },
  { key: 'multi_2_4', label: 'Multi 2-4' },
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'land', label: 'Land' },
];

// Strategies
const STRATEGIES = [
  { key: 'flip', label: 'Flip', icon: '🔨' },
  { key: 'brrrr', label: 'BRRRR', icon: '🏠' },
  { key: 'wholesale', label: 'Wholesale', icon: '📋' },
  { key: 'hold', label: 'Buy & Hold', icon: '📈' },
];

// Distress tags
const DISTRESS_TAGS = [
  { key: 'vacant', label: 'Vacant' },
  { key: 'absentee_owner', label: 'Absentee Owner' },
  { key: 'boarded', label: 'Boarded' },
  { key: 'overgrown', label: 'Overgrown' },
  { key: 'mail_pileup', label: 'Mail Pileup' },
  { key: 'code_violation', label: 'Code Violation' },
  { key: 'fire_damage', label: 'Fire Damage' },
  { key: 'fsbo', label: 'FSBO' },
  { key: 'pre_foreclosure', label: 'Pre-Foreclosure' },
  { key: 'tax_delinquent', label: 'Tax Delinquent' },
];

// Risk tolerance
const RISK_LEVELS = [
  { key: 'conservative', label: 'Conservative', description: 'Lower risk, proven deals only' },
  { key: 'moderate', label: 'Moderate', description: 'Balanced risk/reward' },
  { key: 'aggressive', label: 'Aggressive', description: 'Higher risk for bigger upside' },
];

interface FormState {
  name: string;
  // Location
  targetZips: string;
  targetCities: string;
  targetStates: string;
  excludeZips: string;
  // Property
  propertyTypes: string[];
  minBeds: string;
  maxBeds: string;
  minBaths: string;
  maxBaths: string;
  minSqft: string;
  maxSqft: string;
  minYearBuilt: string;
  // Financial
  maxPurchasePrice: string;
  minArv: string;
  maxRepairBudget: string;
  minProfit: string;
  minRoiPercent: string;
  // Strategy
  strategies: string[];
  preferredStrategy: string;
  // Tags
  preferredTags: string[];
  avoidTags: string[];
  // Weights
  riskTolerance: string;
  weightLocation: number;
  weightPropertyFit: number;
  weightFinancial: number;
  weightDistress: number;
}

const initialFormState: FormState = {
  name: 'My Buy Box',
  targetZips: '',
  targetCities: '',
  targetStates: '',
  excludeZips: '',
  propertyTypes: ['sfr'],
  minBeds: '3',
  maxBeds: '',
  minBaths: '2',
  maxBaths: '',
  minSqft: '1000',
  maxSqft: '',
  minYearBuilt: '',
  maxPurchasePrice: '',
  minArv: '',
  maxRepairBudget: '50000',
  minProfit: '25000',
  minRoiPercent: '15',
  strategies: ['flip'],
  preferredStrategy: 'flip',
  preferredTags: ['vacant', 'absentee_owner'],
  avoidTags: [],
  riskTolerance: 'moderate',
  weightLocation: 30,
  weightPropertyFit: 25,
  weightFinancial: 30,
  weightDistress: 15,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InputRow({ label, value, onChangeText, placeholder, keyboardType = 'default', prefix }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  prefix?: string;
}) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, prefix && styles.inputWithPrefix]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.slate[400]}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

function ChipSelect({ options, selected, onToggle, multi = true }: {
  options: { key: string; label: string; icon?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.key);
        return (
          <Pressable
            key={option.key}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onToggle(option.key)}
          >
            {option.icon && <Text style={styles.chipIcon}>{option.icon}</Text>}
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function WeightSlider({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value}%</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={5}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.brand[500]}
        maximumTrackTintColor={colors.slate[200]}
        thumbTintColor={colors.brand[600]}
      />
    </View>
  );
}

export default function BuyBoxScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  // Load existing buy box
  useEffect(() => {
    async function load() {
      try {
        const buyBox = await getActiveBuyBox();
        if (buyBox) {
          setExistingId(buyBox.id);
          setForm({
            name: buyBox.name || 'My Buy Box',
            targetZips: (buyBox.target_zips || []).join(', '),
            targetCities: (buyBox.target_cities || []).join(', '),
            targetStates: (buyBox.target_states || []).join(', '),
            excludeZips: (buyBox.exclude_zips || []).join(', '),
            propertyTypes: buyBox.property_types || ['sfr'],
            minBeds: buyBox.min_beds?.toString() || '',
            maxBeds: buyBox.max_beds?.toString() || '',
            minBaths: buyBox.min_baths?.toString() || '',
            maxBaths: buyBox.max_baths?.toString() || '',
            minSqft: buyBox.min_sqft?.toString() || '',
            maxSqft: buyBox.max_sqft?.toString() || '',
            minYearBuilt: buyBox.min_year_built?.toString() || '',
            maxPurchasePrice: buyBox.max_purchase_price?.toString() || '',
            minArv: buyBox.min_arv?.toString() || '',
            maxRepairBudget: buyBox.max_repair_budget?.toString() || '',
            minProfit: buyBox.min_profit?.toString() || '',
            minRoiPercent: buyBox.min_roi_percent?.toString() || '',
            strategies: buyBox.strategies || ['flip'],
            preferredStrategy: buyBox.preferred_strategy || 'flip',
            preferredTags: buyBox.preferred_tags || ['vacant', 'absentee_owner'],
            avoidTags: buyBox.avoid_tags || [],
            riskTolerance: buyBox.risk_tolerance || 'moderate',
            weightLocation: buyBox.weight_location ?? 30,
            weightPropertyFit: buyBox.weight_property_fit ?? 25,
            weightFinancial: buyBox.weight_financial ?? 30,
            weightDistress: buyBox.weight_distress ?? 15,
          });
        }
      } catch (error) {
        console.error('Error loading buy box:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const buyBoxData: Partial<BuyBox> = {
        name: form.name,
        target_zips: form.targetZips.split(',').map(s => s.trim()).filter(Boolean),
        target_cities: form.targetCities.split(',').map(s => s.trim()).filter(Boolean),
        target_states: form.targetStates.split(',').map(s => s.trim()).filter(Boolean),
        exclude_zips: form.excludeZips.split(',').map(s => s.trim()).filter(Boolean),
        property_types: form.propertyTypes,
        min_beds: form.minBeds ? parseInt(form.minBeds) : undefined,
        max_beds: form.maxBeds ? parseInt(form.maxBeds) : undefined,
        min_baths: form.minBaths ? parseFloat(form.minBaths) : undefined,
        max_baths: form.maxBaths ? parseFloat(form.maxBaths) : undefined,
        min_sqft: form.minSqft ? parseInt(form.minSqft) : undefined,
        max_sqft: form.maxSqft ? parseInt(form.maxSqft) : undefined,
        min_year_built: form.minYearBuilt ? parseInt(form.minYearBuilt) : undefined,
        max_purchase_price: form.maxPurchasePrice ? parseFloat(form.maxPurchasePrice) : undefined,
        min_arv: form.minArv ? parseFloat(form.minArv) : undefined,
        max_repair_budget: form.maxRepairBudget ? parseFloat(form.maxRepairBudget) : undefined,
        min_profit: form.minProfit ? parseFloat(form.minProfit) : undefined,
        min_roi_percent: form.minRoiPercent ? parseFloat(form.minRoiPercent) : undefined,
        strategies: form.strategies,
        preferred_strategy: form.preferredStrategy,
        preferred_tags: form.preferredTags,
        avoid_tags: form.avoidTags,
        risk_tolerance: form.riskTolerance,
        weight_location: form.weightLocation,
        weight_property_fit: form.weightPropertyFit,
        weight_financial: form.weightFinancial,
        weight_distress: form.weightDistress,
      };

      let result;
      if (existingId) {
        result = await updateBuyBox(existingId, buyBoxData);
      } else {
        result = await createBuyBox({ ...buyBoxData, is_default: true });
      }

      if (result) {
        Alert.alert('Saved', 'Your buy box criteria has been saved. AI will now use these preferences for scoring.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to save buy box. Please try again.');
      }
    } catch (error) {
      console.error('Error saving buy box:', error);
      Alert.alert('Error', 'Failed to save buy box. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const togglePropertyType = (key: string) => {
    setForm(prev => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(key)
        ? prev.propertyTypes.filter(t => t !== key)
        : [...prev.propertyTypes, key]
    }));
  };

  const toggleStrategy = (key: string) => {
    setForm(prev => {
      const newStrategies = prev.strategies.includes(key)
        ? prev.strategies.filter(s => s !== key)
        : [...prev.strategies, key];
      return {
        ...prev,
        strategies: newStrategies,
        preferredStrategy: newStrategies.includes(prev.preferredStrategy)
          ? prev.preferredStrategy
          : newStrategies[0] || 'flip'
      };
    });
  };

  const togglePreferredTag = (key: string) => {
    setForm(prev => ({
      ...prev,
      preferredTags: prev.preferredTags.includes(key)
        ? prev.preferredTags.filter(t => t !== key)
        : [...prev.preferredTags, key],
      avoidTags: prev.avoidTags.filter(t => t !== key), // Remove from avoid if adding to preferred
    }));
  };

  const toggleAvoidTag = (key: string) => {
    setForm(prev => ({
      ...prev,
      avoidTags: prev.avoidTags.includes(key)
        ? prev.avoidTags.filter(t => t !== key)
        : [...prev.avoidTags, key],
      preferredTags: prev.preferredTags.filter(t => t !== key), // Remove from preferred if adding to avoid
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.brand[600]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Buy Box</Text>
          <Text style={styles.headerSubtitle}>AI Investment Criteria</Text>
        </View>
        <Pressable onPress={handleSave} style={styles.saveButton} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Section title="Buy Box Name">
          <TextInput
            style={styles.nameInput}
            value={form.name}
            onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
            placeholder="My Buy Box"
            placeholderTextColor={colors.slate[400]}
          />
        </Section>

        {/* Location */}
        <Section title="📍 Target Location">
          <InputRow
            label="Target ZIP Codes"
            value={form.targetZips}
            onChangeText={(text) => setForm(prev => ({ ...prev, targetZips: text }))}
            placeholder="75001, 75002, 75003"
          />
          <InputRow
            label="Target Cities"
            value={form.targetCities}
            onChangeText={(text) => setForm(prev => ({ ...prev, targetCities: text }))}
            placeholder="Dallas, Fort Worth"
          />
          <InputRow
            label="Target States"
            value={form.targetStates}
            onChangeText={(text) => setForm(prev => ({ ...prev, targetStates: text }))}
            placeholder="TX, OK"
          />
          <InputRow
            label="Exclude ZIPs"
            value={form.excludeZips}
            onChangeText={(text) => setForm(prev => ({ ...prev, excludeZips: text }))}
            placeholder="75099"
          />
        </Section>

        {/* Property */}
        <Section title="🏠 Property Criteria">
          <Text style={styles.fieldLabel}>Property Types</Text>
          <ChipSelect
            options={PROPERTY_TYPES}
            selected={form.propertyTypes}
            onToggle={togglePropertyType}
          />

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <InputRow
                label="Min Beds"
                value={form.minBeds}
                onChangeText={(text) => setForm(prev => ({ ...prev, minBeds: text }))}
                placeholder="3"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <InputRow
                label="Max Beds"
                value={form.maxBeds}
                onChangeText={(text) => setForm(prev => ({ ...prev, maxBeds: text }))}
                placeholder="Any"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <InputRow
                label="Min Baths"
                value={form.minBaths}
                onChangeText={(text) => setForm(prev => ({ ...prev, minBaths: text }))}
                placeholder="2"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <InputRow
                label="Max Baths"
                value={form.maxBaths}
                onChangeText={(text) => setForm(prev => ({ ...prev, maxBaths: text }))}
                placeholder="Any"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <InputRow
                label="Min SqFt"
                value={form.minSqft}
                onChangeText={(text) => setForm(prev => ({ ...prev, minSqft: text }))}
                placeholder="1000"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <InputRow
                label="Max SqFt"
                value={form.maxSqft}
                onChangeText={(text) => setForm(prev => ({ ...prev, maxSqft: text }))}
                placeholder="Any"
                keyboardType="numeric"
              />
            </View>
          </View>

          <InputRow
            label="Min Year Built"
            value={form.minYearBuilt}
            onChangeText={(text) => setForm(prev => ({ ...prev, minYearBuilt: text }))}
            placeholder="1960"
            keyboardType="numeric"
          />
        </Section>

        {/* Financial */}
        <Section title="💰 Financial Criteria">
          <InputRow
            label="Max Purchase Price"
            value={form.maxPurchasePrice}
            onChangeText={(text) => setForm(prev => ({ ...prev, maxPurchasePrice: text }))}
            placeholder="200000"
            keyboardType="numeric"
            prefix="$"
          />
          <InputRow
            label="Min ARV"
            value={form.minArv}
            onChangeText={(text) => setForm(prev => ({ ...prev, minArv: text }))}
            placeholder="Any"
            keyboardType="numeric"
            prefix="$"
          />
          <InputRow
            label="Max Repair Budget"
            value={form.maxRepairBudget}
            onChangeText={(text) => setForm(prev => ({ ...prev, maxRepairBudget: text }))}
            placeholder="50000"
            keyboardType="numeric"
            prefix="$"
          />
          <InputRow
            label="Min Profit Target"
            value={form.minProfit}
            onChangeText={(text) => setForm(prev => ({ ...prev, minProfit: text }))}
            placeholder="25000"
            keyboardType="numeric"
            prefix="$"
          />
          <InputRow
            label="Min ROI %"
            value={form.minRoiPercent}
            onChangeText={(text) => setForm(prev => ({ ...prev, minRoiPercent: text }))}
            placeholder="15"
            keyboardType="numeric"
          />
        </Section>

        {/* Strategy */}
        <Section title="🎯 Exit Strategy">
          <Text style={styles.fieldLabel}>Strategies I Use</Text>
          <ChipSelect
            options={STRATEGIES}
            selected={form.strategies}
            onToggle={toggleStrategy}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Preferred Strategy</Text>
          <View style={styles.chipGrid}>
            {STRATEGIES.filter(s => form.strategies.includes(s.key)).map((strategy) => (
              <Pressable
                key={strategy.key}
                style={[
                  styles.chip,
                  form.preferredStrategy === strategy.key && styles.chipSelected
                ]}
                onPress={() => setForm(prev => ({ ...prev, preferredStrategy: strategy.key }))}
              >
                <Text style={styles.chipIcon}>{strategy.icon}</Text>
                <Text style={[
                  styles.chipText,
                  form.preferredStrategy === strategy.key && styles.chipTextSelected
                ]}>
                  {strategy.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Distress Signals */}
        <Section title="🔥 Distress Signals">
          <Text style={styles.fieldLabel}>I'm Looking For (Preferred)</Text>
          <ChipSelect
            options={DISTRESS_TAGS}
            selected={form.preferredTags}
            onToggle={togglePreferredTag}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Avoid These</Text>
          <ChipSelect
            options={DISTRESS_TAGS}
            selected={form.avoidTags}
            onToggle={toggleAvoidTag}
          />
        </Section>

        {/* Risk Tolerance */}
        <Section title="⚖️ Risk Tolerance">
          <View style={styles.riskOptions}>
            {RISK_LEVELS.map((level) => (
              <Pressable
                key={level.key}
                style={[
                  styles.riskOption,
                  form.riskTolerance === level.key && styles.riskOptionSelected
                ]}
                onPress={() => setForm(prev => ({ ...prev, riskTolerance: level.key }))}
              >
                <View style={styles.riskHeader}>
                  <Text style={[
                    styles.riskLabel,
                    form.riskTolerance === level.key && styles.riskLabelSelected
                  ]}>
                    {level.label}
                  </Text>
                  {form.riskTolerance === level.key && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.brand[600]} />
                  )}
                </View>
                <Text style={styles.riskDescription}>{level.description}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* AI Weights */}
        <Section title="🤖 AI Scoring Weights">
          <Text style={styles.weightInfo}>
            Adjust how much weight the AI gives to each factor when scoring properties.
          </Text>
          <WeightSlider
            label="Location Match"
            value={form.weightLocation}
            onChange={(value) => setForm(prev => ({ ...prev, weightLocation: value }))}
          />
          <WeightSlider
            label="Property Fit"
            value={form.weightPropertyFit}
            onChange={(value) => setForm(prev => ({ ...prev, weightPropertyFit: value }))}
          />
          <WeightSlider
            label="Financial Criteria"
            value={form.weightFinancial}
            onChange={(value) => setForm(prev => ({ ...prev, weightFinancial: value }))}
          />
          <WeightSlider
            label="Distress Signals"
            value={form.weightDistress}
            onChange={(value) => setForm(prev => ({ ...prev, weightDistress: value }))}
          />
        </Section>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.slate[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    paddingTop: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.slate[500],
  },
  saveButton: {
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  nameInput: {
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
  },
  inputRow: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.slate[600],
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    backgroundColor: colors.slate[50],
  },
  inputPrefix: {
    paddingLeft: spacing.md,
    fontSize: 15,
    color: colors.slate[500],
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    padding: spacing.md,
  },
  inputWithPrefix: {
    paddingLeft: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.slate[600],
    marginBottom: spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  chipSelected: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  chipIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: 13,
    color: colors.slate[600],
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.brand[700],
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  riskOptions: {
    gap: spacing.sm,
  },
  riskOption: {
    padding: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  riskOptionSelected: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[500],
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  riskLabelSelected: {
    color: colors.brand[700],
  },
  riskDescription: {
    fontSize: 12,
    color: colors.slate[500],
    marginTop: 2,
  },
  weightInfo: {
    fontSize: 13,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  sliderRow: {
    marginBottom: spacing.md,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sliderLabel: {
    fontSize: 14,
    color: colors.ink,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand[600],
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
