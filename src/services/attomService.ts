/**
 * ATTOM Service
 *
 * Comprehensive service for all 6 ATTOM API actions via Supabase Edge Function.
 *
 * Actions:
 * - getProperty (V1) - Property details + AVM + 150+ data points
 * - getComparables (V2) - Auto-matched comparables
 * - searchZip (V1) - ZIP code property search
 * - getAreaSales (V1) - Recent area sales
 * - getSalesTrends (V4) - 5-year market trends
 * - lookupLocation (V4) - Geography lookup for geoIdV4
 */

import { supabase } from '../lib/supabase'
import type {
  PropertyData,
  ComparablesResponse,
  ZipSearchResponse,
  AreaSalesResponse,
  SalesTrendsResponse,
  LocationLookupResponse,
  GetPropertyRequest,
  GetComparablesRequest,
  SearchZipRequest,
  GetAreaSalesRequest,
  GetSalesTrendsRequest,
  LookupLocationRequest,
  AttomApiResponse,
  GeographyType,
} from '../types/attom'

// Edge Function name
const EDGE_FUNCTION = 'get-attom-property-data'

// ============================================================================
// Data Transformation: Edge Function Response → Mobile Types
// ============================================================================

/**
 * Transform the nested edge function response to the flat mobile PropertyData structure.
 * The edge function returns data in a nested format (identifier.attomId, location.city, etc.)
 * but the mobile app expects a flat structure (attomId, city, etc.)
 */
function transformEdgePropertyResponse(edgeData: any): PropertyData {
  // Handle both direct property data and wrapped { property: ... } format
  const p = edgeData?.property || edgeData

  if (!p) {
    throw new Error('No property data in response')
  }

  // Debug logging - remove in production
  console.log('[Transform] Input structure:', {
    hasProperty: !!edgeData?.property,
    hasIdentifier: !!p.identifier,
    hasLocation: !!p.location,
    hasValuation: !!p.valuation,
    valuationAvm: p.valuation?.avm,
    hasSummary: !!p.summary,
  })

  // Helper to safely get number (handles 0 correctly)
  const getNumber = (primary: any, fallback: any, defaultVal = 0): number => {
    if (typeof primary === 'number') return primary
    if (typeof fallback === 'number') return fallback
    return defaultVal
  }

  // Extract AVM values - handle 0 correctly (0 is a valid number, not falsy)
  const avmValue = getNumber(p.valuation?.avm, p.avm?.value, 0)
  const avmHigh = getNumber(p.valuation?.avmHigh, p.avm?.high, 0)
  const avmLow = getNumber(p.valuation?.avmLow, p.avm?.low, 0)
  const avmConfidence = getNumber(p.valuation?.avmConfidence, p.avm?.confidence, 0)

  console.log('[Transform] AVM values:', { avmValue, avmHigh, avmLow, avmConfidence })

  return {
    // Identifiers
    attomId: p.identifier?.attomId || p.attomId || '',
    fips: p.identifier?.fips || p.fips,
    apn: p.identifier?.apn || p.apn,
    geoIdV4: p.geoIdV4,

    // Location - handle both nested and flat
    address: p.location?.address || p.address || '',
    city: p.location?.city || p.city || '',
    state: p.location?.state || p.state || '',
    zip: p.location?.zipCode || p.location?.zip || p.zip || '',
    county: p.location?.county || p.county,
    latitude: p.location?.latitude || p.latitude || 0,
    longitude: p.location?.longitude || p.longitude || 0,

    // Property Summary - handle both nested and flat
    propertyType: p.summary?.proptype || p.propertyType || '',
    propertyClass: p.summary?.propclass || p.propertyClass,
    propertySubType: p.summary?.propsubtype || p.propertySubType,
    bedrooms: getNumber(p.summary?.bedrooms, p.bedrooms, 0),
    bathrooms: getNumber(p.summary?.bathrooms, p.bathrooms, 0),
    sqft: getNumber(p.summary?.sqft, p.sqft, 0),
    lotSqft: getNumber(p.summary?.lotSqft, p.lotSqft, 0),
    yearBuilt: getNumber(p.summary?.yearbuilt || p.summary?.yearBuilt, p.yearBuilt, 0),
    stories: p.summary?.stories || p.stories,

    // Valuation - transform nested valuation to avm object
    avm: {
      value: avmValue,
      high: avmHigh,
      low: avmLow,
      confidence: avmConfidence,
    },
    rentalAvm: p.valuation?.rentalAvm ?? p.rentalAvm,
    taxAssessment: p.valuation?.taxAssessment ?? p.taxAssessment,
    estimatedEquity: p.valuation?.equity ?? p.estimatedEquity,
    estimatedLoanBalance: p.valuation?.loanBalance ?? p.estimatedLoanBalance,
    ltvRatio: (() => {
      const balance = p.valuation?.loanBalance ?? p.estimatedLoanBalance
      const avm = avmValue
      return balance && avm ? (balance / avm) * 100 : undefined
    })(),

    // Owner - transform nested ownership to owner object
    owner: {
      name: p.ownership?.ownerName || p.owner?.name || '',
      name2: p.ownership?.ownerName2 || p.owner?.name2,
      type: p.ownership?.ownerType || p.owner?.type || 'individual',
      occupied: p.ownership?.ownerOccupied ?? p.owner?.occupied ?? false,
      absentee: !(p.ownership?.ownerOccupied ?? p.owner?.occupied ?? true),
      mailingAddress: p.ownership?.mailingAddress || p.owner?.mailingAddress,
      mailingCity: p.ownership?.mailingCity || p.owner?.mailingCity,
      mailingState: p.ownership?.mailingState || p.owner?.mailingState,
      mailingZip: p.ownership?.mailingZip || p.owner?.mailingZip,
    },

    // Last Sale
    lastSale: (p.saleHistory?.lastSalePrice || p.lastSale?.price) ? {
      date: p.saleHistory?.lastSaleDate || p.lastSale?.date || '',
      price: p.saleHistory?.lastSalePrice || p.lastSale?.price || 0,
    } : undefined,

    // Construction - transform nested building to construction object
    construction: p.building ? {
      foundationType: p.building.construction?.foundationType,
      roofType: p.building.construction?.roofType,
      wallType: p.building.construction?.exteriorWalls,
      heatingType: p.building.interior?.heatingType,
      coolingType: p.building.interior?.coolingType,
      fireplaceCount: p.building.interior?.fireplaces,
      garageType: p.building.parking?.garageType,
      garageSpaces: p.building.parking?.garageSpaces,
      pool: p.building.features?.pool,
      quality: p.building.construction?.quality,
      condition: p.building.construction?.condition,
    } : p.construction,

    // Tax - take first tax history entry or use existing tax object
    tax: p.taxHistory?.[0] ? {
      taxYear: p.taxHistory[0].tax_year,
      taxAmount: p.taxHistory[0].tax_amount,
      assessedValue: p.taxHistory[0].assessed_total,
      assessedLandValue: p.taxHistory[0].assessed_land,
      assessedImprovementValue: p.taxHistory[0].assessed_improvements,
      marketValue: p.taxHistory[0].market_total,
      isDelinquent: p.taxHistory[0].is_delinquent,
      delinquentAmount: p.taxHistory[0].delinquent_amount,
    } : p.tax,
    annualTaxAmount: p.valuation?.annualTaxAmount || p.annualTaxAmount,

    // Sales History - transform transactions array
    salesHistory: (p.transactions || p.salesHistory)?.map((t: any) => ({
      date: t.sale_date || t.date || '',
      price: t.sale_price || t.price || 0,
      pricePerSqft: t.price_per_sqft || t.pricePerSqft,
      transactionType: t.transaction_type || t.transactionType,
      buyerName: t.buyer_name || t.buyerName,
      sellerName: t.seller_name || t.sellerName,
      mortgageAmount: t.mortgage_amount || t.mortgageAmount,
      lenderName: t.mortgage_lender || t.lenderName,
    })),

    // Mortgages
    mortgages: (p.mortgages)?.map((m: any) => ({
      position: m.position || 1,
      originalAmount: m.loan_amount || m.originalAmount || 0,
      estimatedBalance: m.estimated_balance || m.estimatedBalance,
      loanType: m.loan_type || m.loanType,
      interestRate: m.interest_rate || m.interestRate,
      interestRateType: (m.interest_rate_type || m.interestRateType) === 'Fixed' ? 'fixed' as const : 'adjustable' as const,
      lenderName: m.lender_name || m.lenderName,
      originationDate: m.origination_date || m.originationDate,
      maturityDate: m.maturity_date || m.maturityDate,
    })),

    // Schools
    schools: (p.schools)?.map((s: any) => ({
      schoolName: s.schoolName || s.name || '',
      schoolType: s.schoolType || s.type || '',
      gradeRange: s.gradeRange,
      distance: s.distance || 0,
      rating: s.rating,
    })),

    // Foreclosure
    foreclosure: p.foreclosure ? {
      status: p.foreclosure.status || 'none',
      isLisPendens: p.foreclosure.isLisPendens,
      isNoticeOfDefault: p.foreclosure.isNoticeOfDefault,
      isNoticeOfSale: p.foreclosure.isNoticeOfSale,
      recordingDate: p.foreclosure.recordingDate,
      defaultAmount: p.foreclosure.defaultAmount,
      auctionDate: p.foreclosure.auctionDate,
      auctionLocation: p.foreclosure.auctionLocation,
      trusteeName: p.foreclosure.trusteeInfo || p.foreclosure.trusteeName,
      lenderName: p.foreclosure.lenderName,
    } : undefined,

    // Neighborhood (partial support)
    neighborhoodName: p.neighborhood?.neighborhoodName,
    medianHouseholdIncome: p.neighborhood?.medianIncome,
    medianHomeValue: p.neighborhood?.medianHomeValue,
    walkScore: p.neighborhood?.walkScore,
    transitScore: p.neighborhood?.transitScore,
  }
}

// ============================================================================
// ATTOM Service Class
// ============================================================================

class AttomService {
  /**
   * Call the ATTOM Edge Function with a specific action
   */
  private async callEdgeFunction<T>(
    action: string,
    params: Record<string, any>
  ): Promise<AttomApiResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
        body: { action, ...params },
      })

      if (error) {
        console.error(`[AttomService] ${action} error:`, error)
        return {
          success: false,
          error: {
            code: 'EDGE_FUNCTION_ERROR',
            message: error.message || 'Edge function call failed',
          },
        }
      }

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || {
            code: 'UNKNOWN_ERROR',
            message: 'Unknown error occurred',
          },
        }
      }

      return {
        success: true,
        data: data.data || data,
        cached: data.cached,
        cachedAt: data.cachedAt,
      }
    } catch (err) {
      console.error(`[AttomService] ${action} exception:`, err)
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      }
    }
  }

  // ==========================================================================
  // ACTION 1: getProperty (V1 API)
  // Full property enrichment with 150+ data points
  // ==========================================================================

  async getProperty(params: GetPropertyRequest): Promise<AttomApiResponse<PropertyData>> {
    console.log('[AttomService] getProperty:', params.address)

    // Call edge function - returns nested structure
    const result = await this.callEdgeFunction<any>('getProperty', params)

    // Transform the response to mobile's flat structure
    if (result.success && result.data) {
      try {
        result.data = transformEdgePropertyResponse(result.data)
      } catch (err) {
        console.error('[AttomService] Transform error:', err)
        return {
          success: false,
          error: {
            code: 'TRANSFORM_ERROR',
            message: 'Failed to parse property data',
          },
        }
      }
    }

    return result as AttomApiResponse<PropertyData>
  }

  /**
   * Convenience method to get property by full address string
   */
  async getPropertyByAddress(fullAddress: string): Promise<AttomApiResponse<PropertyData>> {
    // Parse address string (e.g., "123 Main St, City, ST 12345")
    const parts = fullAddress.split(',').map(p => p.trim())

    if (parts.length < 2) {
      return {
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Address must include street, city, state, and zip',
        },
      }
    }

    const address = parts[0]
    const cityStateZip = parts.slice(1).join(', ')

    // Extract state and zip from last part
    const stateZipMatch = cityStateZip.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/)
    const state = stateZipMatch?.[1] || ''
    const zip = stateZipMatch?.[2] || ''
    const city = cityStateZip.replace(/,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?/, '').trim()

    return this.getProperty({ address, city, state, zip })
  }

  // ==========================================================================
  // ACTION 2: getComparables (V2 API)
  // Auto-matched comparable sales by ATTOM ID
  // ==========================================================================

  async getComparables(attomId: string): Promise<AttomApiResponse<ComparablesResponse>> {
    console.log('[AttomService] getComparables:', attomId)
    return this.callEdgeFunction<ComparablesResponse>('getComparables', { attomId })
  }

  /**
   * Get comparables and calculate ARV
   */
  async getComparablesWithARV(attomId: string): Promise<AttomApiResponse<ComparablesResponse>> {
    const result = await this.getComparables(attomId)

    if (result.success && result.data?.comparables) {
      // Calculate ARV if not already provided
      if (!result.data.arvAnalysis) {
        const comps = result.data.comparables
        if (comps.length > 0) {
          const prices = comps.map(c => c.salePrice)
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
          const sortedPrices = [...prices].sort((a, b) => a - b)
          const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)]
          const avgPricePerSqft =
            comps.reduce((a, b) => a + (b.pricePerSqft || 0), 0) / comps.length

          // Confidence based on comp count and spread
          const spread = (Math.max(...prices) - Math.min(...prices)) / avgPrice
          const confidence =
            comps.length >= 5 && spread < 0.15
              ? 'high'
              : comps.length >= 3 && spread < 0.25
              ? 'medium'
              : 'low'

          result.data.arvAnalysis = {
            arv: Math.round(avgPrice),
            arvLow: Math.round(avgPrice * 0.95),
            arvHigh: Math.round(avgPrice * 1.05),
            medianPrice: Math.round(medianPrice),
            avgPricePerSqft: Math.round(avgPricePerSqft),
            confidence,
          }
        }
      }
    }

    return result
  }

  // ==========================================================================
  // ACTION 3: searchZip (V1 API)
  // Search properties in a ZIP code
  // ==========================================================================

  async searchZip(params: SearchZipRequest): Promise<AttomApiResponse<ZipSearchResponse>> {
    console.log('[AttomService] searchZip:', params.postalcode)
    return this.callEdgeFunction<ZipSearchResponse>('searchZip', params)
  }

  /**
   * Search ZIP with pagination helper
   */
  async searchZipPaginated(
    postalcode: string,
    options?: {
      propertytype?: string
      page?: number
      pagesize?: number
    }
  ): Promise<AttomApiResponse<ZipSearchResponse>> {
    return this.searchZip({
      postalcode,
      propertytype: options?.propertytype,
      page: options?.page || 1,
      pagesize: options?.pagesize || 20,
    })
  }

  // ==========================================================================
  // ACTION 4: getAreaSales (V1 API)
  // Recent sales in a geographic area
  // ==========================================================================

  async getAreaSales(params: GetAreaSalesRequest): Promise<AttomApiResponse<AreaSalesResponse>> {
    console.log('[AttomService] getAreaSales:', params.geoIdV4)
    return this.callEdgeFunction<AreaSalesResponse>('getAreaSales', params)
  }

  /**
   * Get area sales with automatic location lookup
   */
  async getAreaSalesByZip(
    zip: string,
    page?: number
  ): Promise<AttomApiResponse<AreaSalesResponse>> {
    // First lookup the geoIdV4 for this ZIP
    const locationResult = await this.lookupLocation({ name: zip, geographyType: 'ZI' })

    if (!locationResult.success || !locationResult.data?.locations?.[0]) {
      return {
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: `Could not find geoIdV4 for ZIP ${zip}`,
        },
      }
    }

    const geoIdV4 = locationResult.data.locations[0].geoIdV4
    return this.getAreaSales({ geoIdV4, page })
  }

  // ==========================================================================
  // ACTION 5: getSalesTrends (V4 API)
  // 5-year market price and volume trends
  // ==========================================================================

  async getSalesTrends(
    params: GetSalesTrendsRequest
  ): Promise<AttomApiResponse<SalesTrendsResponse>> {
    console.log('[AttomService] getSalesTrends:', params.geoIdV4, params.interval)
    return this.callEdgeFunction<SalesTrendsResponse>('getSalesTrends', params)
  }

  /**
   * Get sales trends by ZIP code
   */
  async getSalesTrendsByZip(
    zip: string,
    interval: 'yearly' | 'quarterly' | 'monthly' = 'yearly'
  ): Promise<AttomApiResponse<SalesTrendsResponse>> {
    // First lookup the geoIdV4 for this ZIP
    const locationResult = await this.lookupLocation({ name: zip, geographyType: 'ZI' })

    if (!locationResult.success || !locationResult.data?.locations?.[0]) {
      return {
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: `Could not find geoIdV4 for ZIP ${zip}`,
        },
      }
    }

    const geoIdV4 = locationResult.data.locations[0].geoIdV4
    return this.getSalesTrends({ geoIdV4, interval })
  }

  /**
   * Get 5-year trends with computed YoY metrics
   */
  async get5YearTrends(
    geoIdV4: string,
    interval: 'yearly' | 'quarterly' | 'monthly' = 'yearly'
  ): Promise<AttomApiResponse<SalesTrendsResponse>> {
    const currentYear = new Date().getFullYear()
    return this.getSalesTrends({
      geoIdV4,
      interval,
      startyear: currentYear - 5,
      endyear: currentYear,
    })
  }

  // ==========================================================================
  // ACTION 6: lookupLocation (V4 API)
  // Get geoIdV4 for city, county, or ZIP
  // ==========================================================================

  async lookupLocation(
    params: LookupLocationRequest
  ): Promise<AttomApiResponse<LocationLookupResponse>> {
    console.log('[AttomService] lookupLocation:', params.name, params.geographyType)
    return this.callEdgeFunction<LocationLookupResponse>('lookupLocation', params)
  }

  /**
   * Lookup ZIP code
   */
  async lookupZip(zip: string): Promise<AttomApiResponse<LocationLookupResponse>> {
    return this.lookupLocation({ name: zip, geographyType: 'ZI' })
  }

  /**
   * Lookup city/place
   */
  async lookupCity(cityState: string): Promise<AttomApiResponse<LocationLookupResponse>> {
    return this.lookupLocation({ name: cityState, geographyType: 'PL' })
  }

  /**
   * Lookup county
   */
  async lookupCounty(countyState: string): Promise<AttomApiResponse<LocationLookupResponse>> {
    return this.lookupLocation({ name: countyState, geographyType: 'CO' })
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get full property intel with comps and trends
   */
  async getFullPropertyIntel(
    address: string,
    city: string,
    state: string,
    zip: string
  ): Promise<{
    property: AttomApiResponse<PropertyData>
    comparables: AttomApiResponse<ComparablesResponse> | null
    trends: AttomApiResponse<SalesTrendsResponse> | null
  }> {
    // Get property first
    const property = await this.getProperty({ address, city, state, zip })

    let comparables: AttomApiResponse<ComparablesResponse> | null = null
    let trends: AttomApiResponse<SalesTrendsResponse> | null = null

    // If property found, get comps and trends
    if (property.success && property.data?.attomId) {
      // Get comparables
      comparables = await this.getComparablesWithARV(property.data.attomId)

      // Get trends for the ZIP
      trends = await this.getSalesTrendsByZip(zip)
    }

    return { property, comparables, trends }
  }

  /**
   * Quick property lookup for search results
   */
  async quickPropertyLookup(
    address: string,
    city: string,
    state: string,
    zip: string
  ): Promise<{
    attomId?: string
    avm?: number
    bedrooms?: number
    bathrooms?: number
    sqft?: number
    yearBuilt?: number
    ownerName?: string
    error?: string
  }> {
    const result = await this.getProperty({ address, city, state, zip })

    if (!result.success) {
      return { error: result.error?.message || 'Property not found' }
    }

    const p = result.data!
    return {
      attomId: p.attomId,
      avm: p.avm?.value,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      yearBuilt: p.yearBuilt,
      ownerName: p.owner?.name,
    }
  }
}

// Export singleton instance
export const attomService = new AttomService()

// Export class for testing
export { AttomService }
