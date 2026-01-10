/**
 * Buy Box Template Selector
 *
 * Lets users create buy boxes from pre-built templates based on:
 * - Strategy (Flip, BRRRR, Wholesale, Hold)
 * - Funding source (Hard money, Private, Cash)
 * - Risk tolerance (A/B/C deals)
 * - Team capacity (Full gut, Cosmetic, Turnkey)
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
  Modal,
} from 'react-native'
import { aiService } from '../services/aiService'
import type { BuyBoxTemplate } from '../types/ai'
import { colors } from '../theme'

interface BuyBoxTemplateSelectorProps {
  visible: boolean
  onSelectTemplate: (templateId: string, customName?: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const CATEGORIES = [
  { id: 'strategy', label: 'Strategy', description: 'Flip, BRRRR, Wholesale, Hold' },
  { id: 'funding', label: 'Funding', description: 'Hard money, Private, Cash' },
  { id: 'risk', label: 'Risk Level', description: 'A deals, B deals, C deals' },
  { id: 'capacity', label: 'Rehab Scope', description: 'Full gut, Cosmetic, Turnkey' },
]

export const BuyBoxTemplateSelector: React.FC<BuyBoxTemplateSelectorProps> = ({
  visible,
  onSelectTemplate,
  onCancel,
  isLoading = false,
}) => {
  const [templates, setTemplates] = useState<BuyBoxTemplate[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('strategy')
  const [selectedTemplate, setSelectedTemplate] = useState<BuyBoxTemplate | null>(null)
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (visible) {
      fetchTemplates()
    }
  }, [visible])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const data = await aiService.getBuyBoxTemplates()
      setTemplates(data || [])
    } catch (err) {
      console.error('Error fetching templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = templates.filter(t => t.category === selectedCategory)

  const handleCreate = async () => {
    if (!selectedTemplate) return
    await onSelectTemplate(selectedTemplate.id, customName || undefined)
  }

  const getRiskBadgeStyle = (risk: string) => {
    switch (risk) {
      case 'conservative':
        return { backgroundColor: '#D1FAE5', color: '#047857' }
      case 'moderate':
        return { backgroundColor: '#DBEAFE', color: '#2563EB' }
      case 'aggressive':
        return { backgroundColor: '#FEF3C7', color: '#D97706' }
      default:
        return { backgroundColor: '#F1F5F9', color: '#64748B' }
    }
  }

  const handleClose = () => {
    setSelectedTemplate(null)
    setCustomName('')
    setSelectedCategory('strategy')
    onCancel()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Buy Box from Template</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[600]} />
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabs}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategory(cat.id)
                    setSelectedTemplate(null)
                  }}
                  style={[
                    styles.categoryTab,
                    selectedCategory === cat.id && styles.categoryTabSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      selectedCategory === cat.id && styles.categoryTabTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Category Description */}
            <Text style={styles.categoryDescription}>
              {CATEGORIES.find(c => c.id === selectedCategory)?.description}
            </Text>

            {/* Templates List */}
            <View style={styles.templatesList}>
              {filteredTemplates.map(template => {
                const riskStyle = getRiskBadgeStyle(template.risk_tolerance)
                return (
                  <TouchableOpacity
                    key={template.id}
                    onPress={() => {
                      setSelectedTemplate(template)
                      setCustomName(template.name)
                    }}
                    style={[
                      styles.templateCard,
                      selectedTemplate?.id === template.id && styles.templateCardSelected,
                    ]}
                  >
                    <View style={styles.templateHeader}>
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                      <View style={styles.templateTitleRow}>
                        <Text style={styles.templateName}>{template.name}</Text>
                        <View style={[styles.riskBadge, { backgroundColor: riskStyle.backgroundColor }]}>
                          <Text style={[styles.riskBadgeText, { color: riskStyle.color }]}>
                            {template.risk_tolerance}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.templateDescription} numberOfLines={2}>
                      {template.description}
                    </Text>
                    <View style={styles.strategiesRow}>
                      {template.strategies.map(s => (
                        <View key={s} style={styles.strategyTag}>
                          <Text style={styles.strategyTagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                )
              })}

              {filteredTemplates.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No templates in this category</Text>
                </View>
              )}
            </View>

            {/* Custom Name Input (when template selected) */}
            {selectedTemplate && (
              <View style={styles.customNameSection}>
                <Text style={styles.inputLabel}>Buy Box Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder={selectedTemplate.name}
                  placeholderTextColor={colors.slate[400]}
                />
                <Text style={styles.inputHint}>
                  You can customize the name or keep the default
                </Text>

                <View style={styles.templateInfo}>
                  <Text style={styles.templateInfoTitle}>This template includes:</Text>
                  <Text style={styles.templateInfoItem}>
                    • Pre-configured criteria for {selectedTemplate.preferred_strategy} strategy
                  </Text>
                  <Text style={styles.templateInfoItem}>
                    • {selectedTemplate.risk_tolerance} risk tolerance settings
                  </Text>
                  <Text style={styles.templateInfoItem}>
                    • Recommended tag preferences and weights
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              (!selectedTemplate || isLoading) && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!selectedTemplate || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Buy Box</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.slate[800],
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.brand[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  categoryTabs: {
    paddingBottom: 12,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.slate[100],
    marginRight: 8,
  },
  categoryTabSelected: {
    backgroundColor: colors.brand[600],
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.slate[600],
  },
  categoryTabTextSelected: {
    color: '#fff',
  },
  categoryDescription: {
    fontSize: 13,
    color: colors.slate[500],
    marginBottom: 16,
  },
  templatesList: {
    gap: 12,
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.slate[200],
    marginBottom: 12,
  },
  templateCardSelected: {
    borderColor: colors.brand[500],
    backgroundColor: colors.brand[50],
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  templateTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate[800],
  },
  riskBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  templateDescription: {
    fontSize: 14,
    color: colors.slate[500],
    marginBottom: 12,
    lineHeight: 20,
  },
  strategiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  strategyTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.slate[100],
    borderRadius: 12,
  },
  strategyTagText: {
    fontSize: 12,
    color: colors.slate[600],
    textTransform: 'capitalize',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.slate[400],
  },
  customNameSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
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
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.slate[800],
    backgroundColor: '#fff',
  },
  inputHint: {
    fontSize: 12,
    color: colors.slate[500],
    marginTop: 6,
  },
  templateInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
  },
  templateInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate[700],
    marginBottom: 8,
  },
  templateInfoItem: {
    fontSize: 13,
    color: colors.slate[500],
    marginBottom: 4,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  createButton: {
    backgroundColor: colors.brand[600],
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default BuyBoxTemplateSelector
