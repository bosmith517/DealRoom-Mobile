/**
 * Property Lookup Screen
 *
 * Displays ATTOM property data WITHOUT requiring a deal in the pipeline.
 * Users can view all property intelligence and optionally add to pipeline.
 * This matches the web app behavior where viewing != committing to pipeline.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, Stack, Link, useRouter } from 'expo-router'
import { ScreenContainer, Card, Button } from '../../src/components'
import { colors, spacing, typography, radii } from '../../src/theme'
import { attomService } from '../../src/services'
import type { PropertyData } from '../../src/types/attom'

// Format currency
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  return '$' + value.toLocaleString()
}

// Expandable Section Component
function ExpandableSection({
  title,
  icon,
  children,
  defaultExpanded = false,
}: {
  title: string
  icon: string
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <Card style={styles.expandableSection} padding="none">
      <TouchableOpacity
        style={styles.expandableHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandableIcon}>{icon}</Text>
        <Text style={styles.expandableTitle}>{title}</Text>
        <Text style={styles.expandableArrow}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.expandableContent}>{children}</View>}
    </Card>
  )
}

// Data Row Component
function DataRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  )
}

// Confidence Badge Component
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'
  const config = {
    low: { label: 'Low', color: colors.error[500], bg: colors.error[50] },
    medium: { label: 'Medium', color: colors.warning[600], bg: colors.warning[50] },
    high: { label: 'High', color: colors.success[600], bg: colors.success[50] },
  }
  const c = config[level]
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.confidenceBadgeText, { color: c.color }]}>
        {confidence}% {c.label}
      </Text>
    </View>
  )
}

// Foreclosure Status Badge
function ForeclosureBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    none: { label: 'No Distress', color: colors.success[600], bg: colors.success[50] },
    'pre-foreclosure': { label: 'Pre-Foreclosure', color: colors.error[600], bg: colors.error[50] },
    auction: { label: 'Auction', color: colors.error[700], bg: colors.error[100] },
    reo: { label: 'REO', color: colors.warning[700], bg: colors.warning[100] },
  }
  const config = statusConfig[status] || statusConfig.none
  return (
    <View style={[styles.foreclosureBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.foreclosureBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

export default function PropertyLookupScreen() {
  const { attomId, address: passedAddress, city: passedCity, state: passedState, zip: passedZip } = useLocalSearchParams<{
    attomId: string
    address?: string
    city?: string
    state?: string
    zip?: string
  }>()
  const router = useRouter()

  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingToPipeline, setAddingToPipeline] = useState(false)

  const fetchPropertyData = useCallback(async () => {
    // If we have address params, fetch by address
    if (passedAddress && passedCity && passedState) {
      try {
        setError(null)
        const result = await attomService.getProperty({
          address: passedAddress,
          city: passedCity,
          state: passedState,
          zip: passedZip || '',
        })

        if (result.success && result.data) {
          setPropertyData(result.data)
        } else {
          setError(result.error?.message || 'Property not found')
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load property')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
      return
    }

    // Otherwise we need attomId - but ATTOM API doesn't support lookup by ID alone
    // The property data should have been passed via navigation state
    setError('Property address required. Please search again.')
    setLoading(false)
  }, [passedAddress, passedCity, passedState, passedZip])

  useEffect(() => {
    fetchPropertyData()
  }, [fetchPropertyData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPropertyData()
  }, [fetchPropertyData])

  const handleAddToPipeline = useCallback(async () => {
    if (!propertyData) return

    setAddingToPipeline(true)
    try {
      // Import the createDealFromProperty function
      const { createDealFromProperty } = await import('../../src/services/api')

      const dealId = await createDealFromProperty({
        attomId: propertyData.attomId,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zip: propertyData.zip,
        propertyType: propertyData.propertyType,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        sqft: propertyData.sqft,
        yearBuilt: propertyData.yearBuilt,
        lotSqft: propertyData.lotSqft,
        avm: propertyData.avm?.value,
        ownerName: propertyData.owner?.name,
      })

      if (dealId) {
        Alert.alert(
          'Added to Pipeline',
          'Property has been added to your deal pipeline.',
          [
            {
              text: 'View Deal',
              onPress: () => router.replace(`/property/${dealId}`),
            },
            {
              text: 'Stay Here',
              style: 'cancel',
            },
          ]
        )
      } else {
        Alert.alert('Error', 'Failed to add to pipeline')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add to pipeline')
    } finally {
      setAddingToPipeline(false)
    }
  }, [propertyData, router])

  // Extract display values
  const address = propertyData?.address || passedAddress || 'Property'
  const cityStateZip = [
    propertyData?.city || passedCity,
    [propertyData?.state || passedState, propertyData?.zip || passedZip].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ')

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ScreenContainer scrollable={false}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text style={styles.loadingText}>Loading property data...</Text>
          </View>
        </ScreenContainer>
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <ScreenContainer>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="outline" onPress={() => router.back()}>
              Go Back
            </Button>
          </View>
        </ScreenContainer>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: address.length > 20 ? address.substring(0, 17) + '...' : address,
          headerShown: true,
        }}
      />
      <ScreenContainer scrollable={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
        >
          {/* Property Header */}
          <Card style={styles.headerCard} padding="lg">
            <View style={styles.headerRow}>
              <View style={styles.headerInfo}>
                <Text style={styles.propertyAddress}>{address}</Text>
                <Text style={styles.propertyCity}>{cityStateZip}</Text>
              </View>
              <View style={styles.lookupBadge}>
                <Text style={styles.lookupBadgeText}>LOOKUP</Text>
              </View>
            </View>

            {/* Property Meta */}
            {propertyData && (
              <View style={styles.propertyMeta}>
                {propertyData.bedrooms !== undefined && (
                  <>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaValue}>{propertyData.bedrooms}</Text>
                      <Text style={styles.metaLabel}>Beds</Text>
                    </View>
                    <View style={styles.metaDivider} />
                  </>
                )}
                {propertyData.bathrooms !== undefined && (
                  <>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaValue}>{propertyData.bathrooms}</Text>
                      <Text style={styles.metaLabel}>Baths</Text>
                    </View>
                    <View style={styles.metaDivider} />
                  </>
                )}
                {propertyData.sqft && (
                  <>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaValue}>{propertyData.sqft.toLocaleString()}</Text>
                      <Text style={styles.metaLabel}>Sqft</Text>
                    </View>
                    <View style={styles.metaDivider} />
                  </>
                )}
                {propertyData.yearBuilt && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{propertyData.yearBuilt}</Text>
                    <Text style={styles.metaLabel}>Built</Text>
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* ATTOM Data Sections */}
          {propertyData && (
            <>
              {/* Valuation Section */}
              <ExpandableSection title="Valuation & Equity" icon="💰" defaultExpanded={true}>
                {propertyData.avm && (
                  <>
                    <View style={styles.avmHeader}>
                      <View>
                        <Text style={styles.avmLabel}>Automated Valuation</Text>
                        <Text style={styles.avmValue}>{formatCurrency(propertyData.avm.value)}</Text>
                        <Text style={styles.avmRange}>
                          Range: {formatCurrency(propertyData.avm.low)} - {formatCurrency(propertyData.avm.high)}
                        </Text>
                      </View>
                      <ConfidenceBadge confidence={propertyData.avm.confidence} />
                    </View>
                    <View style={styles.valuationGrid}>
                      <View style={styles.valuationItem}>
                        <Text style={styles.valuationItemLabel}>Est. Equity</Text>
                        <Text style={styles.valuationItemValue}>
                          {formatCurrency(propertyData.estimatedEquity)}
                        </Text>
                      </View>
                      <View style={styles.valuationItem}>
                        <Text style={styles.valuationItemLabel}>LTV Ratio</Text>
                        <Text style={styles.valuationItemValue}>
                          {propertyData.ltvRatio ? `${propertyData.ltvRatio.toFixed(1)}%` : '-'}
                        </Text>
                      </View>
                      <View style={styles.valuationItem}>
                        <Text style={styles.valuationItemLabel}>Rental Value</Text>
                        <Text style={styles.valuationItemValue}>
                          {formatCurrency(propertyData.rentalAvm)}/mo
                        </Text>
                      </View>
                      <View style={styles.valuationItem}>
                        <Text style={styles.valuationItemLabel}>Tax Assessed</Text>
                        <Text style={styles.valuationItemValue}>
                          {formatCurrency(propertyData.taxAssessment)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </ExpandableSection>

              {/* Owner Information */}
              {propertyData.owner && (
                <ExpandableSection title="Owner Information" icon="👤" defaultExpanded={true}>
                  <DataRow label="Owner Name" value={propertyData.owner.name} />
                  {propertyData.owner.name2 && <DataRow label="Owner 2" value={propertyData.owner.name2} />}
                  <DataRow label="Owner Type" value={propertyData.owner.type} />
                  <View style={styles.ownerBadgeRow}>
                    <View style={[
                      styles.ownerStatusBadge,
                      { backgroundColor: propertyData.owner.occupied ? colors.success[50] : colors.warning[50] }
                    ]}>
                      <Text style={[
                        styles.ownerStatusText,
                        { color: propertyData.owner.occupied ? colors.success[600] : colors.warning[600] }
                      ]}>
                        {propertyData.owner.occupied ? 'Owner Occupied' : 'Non-Owner Occupied'}
                      </Text>
                    </View>
                    {propertyData.owner.absentee && (
                      <View style={[styles.ownerStatusBadge, { backgroundColor: colors.brand[50] }]}>
                        <Text style={[styles.ownerStatusText, { color: colors.brand[600] }]}>
                          Absentee Owner
                        </Text>
                      </View>
                    )}
                  </View>
                  {propertyData.owner.mailingAddress && (
                    <>
                      <Text style={styles.subsectionTitle}>Mailing Address</Text>
                      <DataRow label="Address" value={propertyData.owner.mailingAddress} />
                      <DataRow
                        label="City/State"
                        value={[propertyData.owner.mailingCity, propertyData.owner.mailingState, propertyData.owner.mailingZip]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    </>
                  )}
                </ExpandableSection>
              )}

              {/* Foreclosure/Distress */}
              {propertyData.foreclosure && propertyData.foreclosure.status !== 'none' && (
                <ExpandableSection title="Distress Signals" icon="⚠️" defaultExpanded={true}>
                  <View style={styles.distressHeader}>
                    <ForeclosureBadge status={propertyData.foreclosure.status} />
                  </View>
                  <DataRow label="Recording Date" value={propertyData.foreclosure.recordingDate} />
                  <DataRow label="Default Amount" value={formatCurrency(propertyData.foreclosure.defaultAmount)} />
                  <DataRow label="Auction Date" value={propertyData.foreclosure.auctionDate} />
                  <DataRow label="Auction Location" value={propertyData.foreclosure.auctionLocation} />
                  <DataRow label="Trustee" value={propertyData.foreclosure.trusteeName} />
                  <DataRow label="Lender" value={propertyData.foreclosure.lenderName} />
                </ExpandableSection>
              )}

              {/* Last Sale */}
              {propertyData.lastSale && (
                <ExpandableSection title="Last Sale" icon="🏷️">
                  <DataRow label="Sale Date" value={propertyData.lastSale.date} />
                  <DataRow label="Sale Price" value={formatCurrency(propertyData.lastSale.price)} />
                </ExpandableSection>
              )}

              {/* Construction Details */}
              {propertyData.construction && (
                <ExpandableSection title="Construction Details" icon="🔨">
                  <DataRow label="Foundation" value={propertyData.construction.foundationType} />
                  <DataRow label="Roof Type" value={propertyData.construction.roofType} />
                  <DataRow label="Exterior Walls" value={propertyData.construction.wallType} />
                  <DataRow label="Heating" value={propertyData.construction.heatingType} />
                  <DataRow label="Cooling" value={propertyData.construction.coolingType} />
                  <DataRow label="Fireplaces" value={propertyData.construction.fireplaceCount} />
                  <DataRow label="Garage Type" value={propertyData.construction.garageType} />
                  <DataRow label="Garage Spaces" value={propertyData.construction.garageSpaces} />
                  <DataRow label="Pool" value={propertyData.construction.pool ? 'Yes' : 'No'} />
                  <DataRow label="Quality" value={propertyData.construction.quality} />
                  <DataRow label="Condition" value={propertyData.construction.condition} />
                </ExpandableSection>
              )}

              {/* Tax Information */}
              {propertyData.tax && (
                <ExpandableSection title="Tax Information" icon="📋">
                  <DataRow label="Tax Year" value={propertyData.tax.taxYear} />
                  <DataRow label="Annual Tax" value={formatCurrency(propertyData.tax.taxAmount)} />
                  <DataRow label="Assessed Value" value={formatCurrency(propertyData.tax.assessedValue)} />
                  <DataRow label="Land Value" value={formatCurrency(propertyData.tax.assessedLandValue)} />
                  <DataRow label="Improvement Value" value={formatCurrency(propertyData.tax.assessedImprovementValue)} />
                  <DataRow label="Market Value" value={formatCurrency(propertyData.tax.marketValue)} />
                  {propertyData.tax.isDelinquent && (
                    <View style={styles.distressFlag}>
                      <Text style={styles.distressFlagText}>⚠️ Tax Delinquent: {formatCurrency(propertyData.tax.delinquentAmount)}</Text>
                    </View>
                  )}
                </ExpandableSection>
              )}

              {/* Mortgages */}
              {propertyData.mortgages && propertyData.mortgages.length > 0 && (
                <ExpandableSection title={`Mortgages (${propertyData.mortgages.length})`} icon="🏦">
                  {propertyData.mortgages.map((mortgage, idx) => (
                    <View key={idx} style={styles.mortgageItem}>
                      <Text style={styles.mortgagePosition}>
                        {mortgage.position === 1 ? '1st' : mortgage.position === 2 ? '2nd' : `${mortgage.position}th`} Lien
                      </Text>
                      <DataRow label="Original Amount" value={formatCurrency(mortgage.originalAmount)} />
                      <DataRow label="Est. Balance" value={formatCurrency(mortgage.estimatedBalance)} />
                      <DataRow label="Loan Type" value={mortgage.loanType} />
                      <DataRow label="Interest Rate" value={mortgage.interestRate ? `${mortgage.interestRate}%` : undefined} />
                      <DataRow label="Lender" value={mortgage.lenderName} />
                      <DataRow label="Originated" value={mortgage.originationDate} />
                    </View>
                  ))}
                </ExpandableSection>
              )}

              {/* Schools */}
              {propertyData.schools && propertyData.schools.length > 0 && (
                <ExpandableSection title={`Nearby Schools (${propertyData.schools.length})`} icon="🏫">
                  {propertyData.schools.slice(0, 5).map((school, idx) => (
                    <View key={idx} style={styles.schoolItem}>
                      <View style={styles.schoolHeader}>
                        <Text style={styles.schoolName}>{school.schoolName}</Text>
                        {school.rating && (
                          <View style={styles.schoolRating}>
                            <Text style={styles.schoolRatingText}>{school.rating}/10</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.schoolType}>
                        {school.schoolType} • {school.distance.toFixed(1)} mi
                      </Text>
                      {school.gradeRange && (
                        <Text style={styles.schoolGrades}>Grades: {school.gradeRange}</Text>
                      )}
                    </View>
                  ))}
                </ExpandableSection>
              )}

              {/* Sales History */}
              {propertyData.salesHistory && propertyData.salesHistory.length > 1 && (
                <ExpandableSection title={`Sales History (${propertyData.salesHistory.length})`} icon="📜">
                  {propertyData.salesHistory.map((sale, idx) => (
                    <View key={idx} style={styles.saleHistoryItem}>
                      <View style={styles.saleHistoryHeader}>
                        <Text style={styles.saleHistoryPrice}>{formatCurrency(sale.price)}</Text>
                        <Text style={styles.saleHistoryDate}>{sale.date}</Text>
                      </View>
                      {sale.transactionType && (
                        <Text style={styles.saleHistoryType}>{sale.transactionType}</Text>
                      )}
                    </View>
                  ))}
                </ExpandableSection>
              )}

              {/* Property Identifiers */}
              <ExpandableSection title="Property Identifiers" icon="🔑">
                <DataRow label="ATTOM ID" value={propertyData.attomId} />
                <DataRow label="APN" value={propertyData.apn} />
                <DataRow label="FIPS" value={propertyData.fips} />
                <DataRow label="County" value={propertyData.county} />
                <DataRow label="Lat/Long" value={`${propertyData.latitude?.toFixed(5)}, ${propertyData.longitude?.toFixed(5)}`} />
              </ExpandableSection>

              {/* Market Intelligence Navigation */}
              <Text style={styles.sectionTitle}>Market Intelligence</Text>
              <View style={styles.actionsRow}>
                <Link
                  href={{
                    pathname: '/property/comps',
                    params: { attomId: propertyData.attomId, address: propertyData.address },
                  }}
                  asChild
                >
                  <Button variant="outline" style={styles.actionButton}>
                    📊 View Comps
                  </Button>
                </Link>
                <Link
                  href={{
                    pathname: '/property/trends',
                    params: { zip: propertyData.zip },
                  }}
                  asChild
                >
                  <Button variant="outline" style={styles.actionButton}>
                    📈 Market Trends
                  </Button>
                </Link>
              </View>

              {/* Add to Pipeline Button */}
              <Text style={styles.sectionTitle}>Pipeline</Text>
              <Button
                variant="primary"
                onPress={handleAddToPipeline}
                disabled={addingToPipeline}
                style={styles.pipelineButton}
              >
                {addingToPipeline ? 'Adding...' : '➕ Add to Pipeline'}
              </Button>

              <Text style={styles.pipelineHint}>
                Add this property to your deal pipeline to track progress, add notes, and run analysis.
              </Text>
            </>
          )}

          {/* Debug Info */}
          <Text style={styles.debugText}>ATTOM ID: {attomId || propertyData?.attomId || 'N/A'}</Text>
        </ScrollView>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  propertyAddress: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  propertyCity: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  lookupBadge: {
    backgroundColor: colors.brand[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  lookupBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[700],
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.ink,
  },
  metaLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  metaDivider: {
    width: 1,
    backgroundColor: colors.slate[200],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  pipelineButton: {
    marginTop: spacing.xs,
  },
  pipelineHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: 'center',
  },
  debugText: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    fontSize: typography.fontSize.xs,
    color: colors.slate[300],
    textAlign: 'center',
  },

  // Expandable Section Styles
  expandableSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  expandableIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  expandableTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  expandableArrow: {
    fontSize: 12,
    color: colors.slate[400],
  },
  expandableContent: {
    padding: spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },

  // Data Row Styles
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[50],
  },
  dataLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    flex: 1,
  },
  dataValue: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },

  // Confidence Badge
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  confidenceBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Foreclosure Badge
  foreclosureBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  foreclosureBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // AVM Header
  avmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avmLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: spacing.xs,
  },
  avmValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.brand[700],
  },
  avmRange: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },

  // Valuation Grid
  valuationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  valuationItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.slate[50],
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  valuationItemLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginBottom: 2,
  },
  valuationItemValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },

  // Owner Badge Row
  ownerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  ownerStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  ownerStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },

  // Subsection Title
  subsectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[600],
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Distress Styles
  distressHeader: {
    marginBottom: spacing.md,
  },
  distressFlag: {
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  distressFlagText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Mortgage Item
  mortgageItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  mortgagePosition: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand[600],
    marginBottom: spacing.xs,
  },

  // School Item
  schoolItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.ink,
    flex: 1,
  },
  schoolRating: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  schoolRatingText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  schoolType: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  schoolGrades: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },

  // Sale History Item
  saleHistoryItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  saleHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleHistoryPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.ink,
  },
  saleHistoryDate: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  saleHistoryType: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 2,
  },
})
