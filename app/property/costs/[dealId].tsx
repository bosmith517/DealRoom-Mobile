/**
 * Property Costs Screen
 *
 * Shows and manages costs for a deal.
 * Groups costs by category with totals and allows adding/editing.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { ScreenContainer, Card } from '../../../src/components'
import { colors, spacing, typography, radii, shadows } from '../../../src/theme'
import {
  costService,
  formatCostCurrency,
  getCostStatusColor,
  getCostStatusLabel,
} from '../../../src/services'
import type {
  DealCost,
  CostCategory,
  CostSummary,
  CostStatus,
} from '../../../src/services/costService'

// Status options
const STATUS_OPTIONS: { value: CostStatus; label: string }[] = [
  { value: 'estimated', label: 'Estimated' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'contracted', label: 'Contracted' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
]

// Cost Item Card
function CostItemCard({
  cost,
  onPress,
  onMarkPaid,
}: {
  cost: DealCost
  onPress: () => void
  onMarkPaid: () => void
}) {
  const label = cost.cost_item?.item_label || cost.custom_label || 'Unknown'
  const amount = cost.actual_amount || cost.estimated_amount
  const statusColor = getCostStatusColor(cost.status)

  return (
    <TouchableOpacity
      style={styles.costCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.costMain}>
        <View style={styles.costInfo}>
          <Text style={styles.costLabel} numberOfLines={1}>
            {label}
          </Text>
          {cost.notes && (
            <Text style={styles.costNotes} numberOfLines={1}>
              {cost.notes}
            </Text>
          )}
        </View>
        <View style={styles.costAmount}>
          <Text style={styles.costValue}>{formatCostCurrency(amount)}</Text>
          {cost.actual_amount && cost.estimated_amount !== cost.actual_amount && (
            <Text style={styles.costEstimated}>
              Est: {formatCostCurrency(cost.estimated_amount)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.costFooter}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getCostStatusLabel(cost.status)}
          </Text>
        </View>
        {cost.status !== 'paid' && cost.status !== 'waived' && (
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={(e) => {
              e.stopPropagation()
              onMarkPaid()
            }}
          >
            <Text style={styles.markPaidText}>Mark Paid</Text>
          </TouchableOpacity>
        )}
        {cost.flagged_risk && (
          <Text style={styles.flagIcon}>⚠️</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// Category Section
function CategorySection({
  category,
  costs,
  onCostPress,
  onMarkPaid,
}: {
  category: CostCategory
  costs: DealCost[]
  onCostPress: (cost: DealCost) => void
  onMarkPaid: (cost: DealCost) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const total = costs.reduce(
    (sum, c) => sum + (c.actual_amount || c.estimated_amount),
    0
  )

  return (
    <View style={styles.categorySection}>
      <TouchableOpacity
        style={styles.categoryHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
        <Text style={styles.categoryLabel}>{category.category_label}</Text>
        <Text style={styles.categoryTotal}>{formatCostCurrency(total)}</Text>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.categoryCosts}>
          {costs.map((cost) => (
            <CostItemCard
              key={cost.id}
              cost={cost}
              onPress={() => onCostPress(cost)}
              onMarkPaid={() => onMarkPaid(cost)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// Summary Card
function SummaryCard({ summary }: { summary: CostSummary }) {
  return (
    <Card style={styles.summaryCard} padding="md">
      <Text style={styles.summaryTitle}>Cost Summary</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total Estimated</Text>
        <Text style={styles.summaryValue}>
          {formatCostCurrency(summary.total_estimated)}
        </Text>
      </View>
      {summary.total_actual > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Actual</Text>
          <Text style={styles.summaryValue}>
            {formatCostCurrency(summary.total_actual)}
          </Text>
        </View>
      )}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Paid</Text>
        <Text style={[styles.summaryValue, { color: colors.success[600] }]}>
          {formatCostCurrency(summary.total_paid)}
        </Text>
      </View>
      <View style={[styles.summaryRow, styles.summaryRowLast]}>
        <Text style={styles.summaryLabelBold}>Remaining</Text>
        <Text style={[styles.summaryValueBold, { color: colors.error[600] }]}>
          {formatCostCurrency(summary.total_remaining)}
        </Text>
      </View>
    </Card>
  )
}

// Add/Edit Cost Modal
function CostModal({
  visible,
  cost,
  categories,
  dealId,
  onSave,
  onClose,
}: {
  visible: boolean
  cost: DealCost | null
  categories: CostCategory[]
  dealId: string
  onSave: () => void
  onClose: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    cost?.category_id || categories[0]?.id || ''
  )
  const [label, setLabel] = useState(cost?.custom_label || '')
  const [estimated, setEstimated] = useState(
    cost?.estimated_amount?.toString() || ''
  )
  const [actual, setActual] = useState(
    cost?.actual_amount?.toString() || ''
  )
  const [status, setStatus] = useState<CostStatus>(cost?.status || 'estimated')
  const [notes, setNotes] = useState(cost?.notes || '')
  const [saving, setSaving] = useState(false)

  const isEditing = !!cost

  const handleSave = async () => {
    if (!label.trim() || !estimated.trim()) {
      Alert.alert('Error', 'Please enter a label and estimated amount')
      return
    }

    setSaving(true)
    try {
      if (isEditing && cost) {
        await costService.updateCost(cost.id, {
          category_id: selectedCategory,
          custom_label: label.trim(),
          estimated_amount: parseFloat(estimated) || 0,
          actual_amount: actual ? parseFloat(actual) : undefined,
          status,
          notes: notes.trim() || undefined,
        })
      } else {
        await costService.createCost({
          deal_id: dealId,
          category_id: selectedCategory,
          custom_label: label.trim(),
          estimated_amount: parseFloat(estimated) || 0,
          actual_amount: actual ? parseFloat(actual) : undefined,
          status,
          notes: notes.trim() || undefined,
        })
      }
      onSave()
    } catch (err) {
      Alert.alert('Error', 'Failed to save cost')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!cost) return

    Alert.alert('Delete Cost', 'Are you sure you want to delete this cost?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await costService.deleteCost(cost.id)
            onSave()
          } catch (err) {
            Alert.alert('Error', 'Failed to delete cost')
          }
        },
      },
    ])
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Cost' : 'Add Cost'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Category Picker */}
          <Text style={styles.inputLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPicker}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <View
                  style={[
                    styles.categoryChipDot,
                    { backgroundColor: cat.color },
                  ]}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.id &&
                      styles.categoryChipTextSelected,
                  ]}
                >
                  {cat.category_label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Label */}
          <Text style={styles.inputLabel}>Label</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g., Roof repair, Title insurance"
            placeholderTextColor={colors.slate[400]}
          />

          {/* Amounts */}
          <View style={styles.amountRow}>
            <View style={styles.amountCol}>
              <Text style={styles.inputLabel}>Estimated</Text>
              <TextInput
                style={styles.input}
                value={estimated}
                onChangeText={setEstimated}
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.amountCol}>
              <Text style={styles.inputLabel}>Actual</Text>
              <TextInput
                style={styles.input}
                value={actual}
                onChangeText={setActual}
                placeholder="$0"
                placeholderTextColor={colors.slate[400]}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Status */}
          <Text style={styles.inputLabel}>Status</Text>
          <View style={styles.statusPicker}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.statusChip,
                  status === opt.value && styles.statusChipSelected,
                ]}
                onPress={() => setStatus(opt.value)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    status === opt.value && styles.statusChipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes..."
            placeholderTextColor={colors.slate[400]}
            multiline
            numberOfLines={3}
          />

          {/* Delete Button */}
          {isEditing && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>Delete Cost</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function PropertyCostsScreen() {
  const { dealId } = useLocalSearchParams<{ dealId: string }>()
  const router = useRouter()

  const [costs, setCosts] = useState<DealCost[]>([])
  const [categories, setCategories] = useState<CostCategory[]>([])
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingCost, setEditingCost] = useState<DealCost | null>(null)

  const fetchData = useCallback(async () => {
    if (!dealId) return

    try {
      const [costsResult, categoriesResult, summaryResult] = await Promise.all([
        costService.getDealCosts(dealId),
        costService.getCategories(),
        costService.getDealCostSummary(dealId),
      ])

      if (!costsResult.error) {
        setCosts(costsResult.data || [])
      }
      if (!categoriesResult.error) {
        setCategories(categoriesResult.data || [])
      }
      if (!summaryResult.error) {
        setSummary(summaryResult.data)
      }
    } catch (err) {
      console.error('Error fetching costs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dealId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData()
  }, [fetchData])

  const handleAddCost = () => {
    setEditingCost(null)
    setShowModal(true)
  }

  const handleEditCost = (cost: DealCost) => {
    setEditingCost(cost)
    setShowModal(true)
  }

  const handleMarkPaid = async (cost: DealCost) => {
    Alert.prompt(
      'Mark as Paid',
      'Enter the payee name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async (paidTo) => {
            if (!paidTo?.trim()) return
            try {
              await costService.markAsPaid(cost.id, paidTo.trim())
              fetchData()
            } catch (err) {
              Alert.alert('Error', 'Failed to update cost')
            }
          },
        },
      ],
      'plain-text',
      cost.paid_to || ''
    )
  }

  const handleSave = () => {
    setShowModal(false)
    setEditingCost(null)
    fetchData()
  }

  // Group costs by category
  const costsByCategory = new Map<string, DealCost[]>()
  costs.forEach((cost) => {
    const catId = cost.category_id
    const existing = costsByCategory.get(catId) || []
    existing.push(cost)
    costsByCategory.set(catId, existing)
  })

  // Get categories that have costs, ordered
  const usedCategories = categories.filter((cat) =>
    costsByCategory.has(cat.id)
  )

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Deal Costs',
          headerShown: true,
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
          headerRight: () => (
            <TouchableOpacity onPress={handleAddCost} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScreenContainer scrollable={false} padding={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Loading costs...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand[500]}
              />
            }
          >
            {/* Summary */}
            {summary && <SummaryCard summary={summary} />}

            {/* Costs by Category */}
            {usedCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No costs yet</Text>
                <Text style={styles.emptyText}>
                  Track your deal expenses by adding costs
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleAddCost}
                >
                  <Text style={styles.emptyButtonText}>+ Add First Cost</Text>
                </TouchableOpacity>
              </View>
            ) : (
              usedCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  costs={costsByCategory.get(category.id) || []}
                  onCostPress={handleEditCost}
                  onMarkPaid={handleMarkPaid}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* Add/Edit Modal */}
        <CostModal
          visible={showModal}
          cost={editingCost}
          categories={categories}
          dealId={dealId || ''}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false)
            setEditingCost(null)
          }}
        />
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Summary Card
  summaryCard: {
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryRowLast: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  summaryLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  summaryValueBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  // Category Section
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  categoryLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  categoryTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
    marginRight: spacing.sm,
  },
  expandIcon: {
    fontSize: 10,
    color: colors.slate[400],
  },
  categoryCosts: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // Cost Card
  costCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  costMain: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  costInfo: {
    flex: 1,
  },
  costLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
  },
  costNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  costAmount: {
    alignItems: 'flex-end',
  },
  costValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  costEstimated: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },
  costFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  markPaidButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.success[50],
  },
  markPaidText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  flagIcon: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  modalSave: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  amountCol: {
    flex: 1,
  },
  categoryPicker: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
    gap: spacing.xs,
  },
  categoryChipSelected: {
    backgroundColor: colors.brand[100],
  },
  categoryChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  categoryChipTextSelected: {
    color: colors.brand[700],
    fontWeight: typography.fontWeight.semibold,
  },
  statusPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
  },
  statusChipSelected: {
    backgroundColor: colors.brand[500],
  },
  statusChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
  },
  statusChipTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.error[50],
  },
  deleteButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },
})
