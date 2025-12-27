/**
 * ATTOM API Types
 *
 * Comprehensive type definitions for all 6 ATTOM API actions:
 * - getProperty (V1) - Property details + AVM
 * - getComparables (V2) - Auto-matched comps
 * - searchZip (V1) - ZIP code property search
 * - getAreaSales (V1) - Recent area sales
 * - getSalesTrends (V4) - 5-year market trends
 * - lookupLocation (V4) - Geography lookup
 */

// ============================================================================
// Property Data (getProperty - V1 API)
// ============================================================================

export interface PropertyAVM {
  value: number
  high: number
  low: number
  confidence: number // 0-100
  eventDate?: string
  source?: string
}

export interface PropertyOwner {
  name: string
  name2?: string
  type: 'individual' | 'llc' | 'corporation' | 'trust' | 'estate' | 'bank' | string
  occupied: boolean
  absentee: boolean
  mailingAddress?: string
  mailingCity?: string
  mailingState?: string
  mailingZip?: string
}

export interface PropertySale {
  date: string
  price: number
  pricePerSqft?: number
  transactionType?: string
  buyerName?: string
  sellerName?: string
  mortgageAmount?: number
  lenderName?: string
  armsLength?: boolean
  foreclosureSale?: boolean
  reoSale?: boolean
  documentNumber?: string
}

export interface PropertyMortgage {
  position: number // 1st, 2nd, 3rd
  originalAmount: number
  estimatedBalance?: number
  loanType?: string
  interestRate?: number
  interestRateType?: 'fixed' | 'adjustable'
  lenderName?: string
  originationDate?: string
  maturityDate?: string
  loanPurpose?: string
}

export interface PropertyTax {
  taxYear: number
  taxAmount: number
  assessedValue: number
  assessedLandValue?: number
  assessedImprovementValue?: number
  marketValue?: number
  marketLandValue?: number
  marketImprovementValue?: number
  isDelinquent?: boolean
  delinquentAmount?: number
}

export interface PropertySchool {
  schoolId?: string
  schoolName: string
  schoolType: 'elementary' | 'middle' | 'high' | 'private' | string
  gradeRange?: string
  distance: number // miles
  rating?: number // 1-10
  enrollment?: number
  studentTeacherRatio?: number
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  website?: string
  districtName?: string
}

export interface PropertyConstruction {
  foundationType?: string
  roofType?: string
  roofCover?: string
  wallType?: string
  heatingType?: string
  coolingType?: string
  fireplaceCount?: number
  basementType?: string
  garageType?: string
  garageSpaces?: number
  parkingSpaces?: number
  pool?: boolean
  flooring?: string
  quality?: string
  condition?: string
}

export interface PropertyForeclosure {
  status: 'none' | 'pre-foreclosure' | 'auction' | 'reo'
  isLisPendens?: boolean
  isNoticeOfDefault?: boolean
  isNoticeOfSale?: boolean
  recordingDate?: string
  defaultAmount?: number
  auctionDate?: string
  auctionLocation?: string
  trusteeName?: string
  lenderName?: string
  documentNumber?: string
}

export interface PropertyData {
  // Identifiers
  attomId: string
  fips?: string
  apn?: string
  geoIdV4?: string

  // Location
  address: string
  city: string
  state: string
  zip: string
  county?: string
  latitude: number
  longitude: number

  // Property Summary
  propertyType: string
  propertyClass?: string
  propertySubType?: string
  bedrooms: number
  bathrooms: number
  partialBaths?: number
  sqft: number
  lotSqft: number
  yearBuilt: number
  effectiveYearBuilt?: number
  stories?: number

  // Valuation
  avm: PropertyAVM
  rentalAvm?: number
  taxAssessment?: number
  estimatedEquity?: number
  estimatedLoanBalance?: number
  ltvRatio?: number

  // Owner
  owner: PropertyOwner

  // Last Sale
  lastSale?: PropertySale

  // Construction
  construction?: PropertyConstruction

  // Tax Info
  tax?: PropertyTax
  annualTaxAmount?: number

  // Arrays
  salesHistory?: PropertySale[]
  mortgages?: PropertyMortgage[]
  taxHistory?: PropertyTax[]
  schools?: PropertySchool[]

  // Foreclosure
  foreclosure?: PropertyForeclosure

  // Neighborhood
  neighborhoodName?: string
  medianHouseholdIncome?: number
  medianHomeValue?: number
  walkScore?: number
  transitScore?: number
}

// ============================================================================
// Comparables (getComparables - V2 API)
// ============================================================================

export interface ComparableSale {
  attomId: string
  address: string
  city: string
  state: string
  zip: string
  distance: number // miles from subject
  saleDate: string
  salePrice: number
  pricePerSqft: number
  bedrooms: number
  bathrooms: number
  sqft: number
  yearBuilt: number
  propertyType?: string
  daysAgo: number
  buyerName?: string
  sellerName?: string
  loanAmount?: number
  latitude?: number
  longitude?: number
}

export interface ComparablesResponse {
  subject: {
    attomId: string
    address: string
    city: string
    state: string
    zip: string
    bedrooms: number
    bathrooms: number
    sqft: number
    yearBuilt: number
    lastSaleDate?: string
    lastSalePrice?: number
  }
  comparables: ComparableSale[]
  count: number
  arvAnalysis?: {
    arv: number
    arvLow: number
    arvHigh: number
    medianPrice: number
    avgPricePerSqft: number
    confidence: 'low' | 'medium' | 'high'
  }
}

// ============================================================================
// ZIP Search (searchZip - V1 API)
// ============================================================================

export interface ZipProperty {
  attomId: string
  address: string
  city: string
  state: string
  zip: string
  propertyType: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  yearBuilt?: number
  lotSqft?: number
  latitude: number
  longitude: number
}

export interface ZipSearchResponse {
  properties: ZipProperty[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// Area Sales (getAreaSales - V1 API)
// ============================================================================

export interface AreaSale {
  attomId: string
  address: string
  city: string
  state: string
  zip: string
  saleDate: string
  salePrice: number
  pricePerSqft?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  yearBuilt?: number
  propertyType?: string
  transactionType?: string
  buyerName?: string
  sellerName?: string
  latitude?: number
  longitude?: number
}

export interface AreaSalesResponse {
  sales: AreaSale[]
  total: number
  page: number
  pageSize: number
  geoIdV4: string
  geographyName?: string
}

// ============================================================================
// Sales Trends (getSalesTrends - V4 API)
// ============================================================================

export interface TrendDataPoint {
  year: number
  quarter?: number
  month?: number
  dateRange?: string
  homeSaleCount: number
  avgSalePrice: number
  medSalePrice: number
  pricePerSqft?: number
}

export interface SalesTrendsResponse {
  geoIdV4: string
  geographyName: string
  interval: 'yearly' | 'quarterly' | 'monthly'
  trends: TrendDataPoint[]
  summary?: {
    medianPrice12Mo?: number
    avgPrice12Mo?: number
    priceChange12Mo?: number // YoY %
    totalSales12Mo?: number
    avgDaysOnMarket?: number
  }
}

// ============================================================================
// Location Lookup (lookupLocation - V4 API)
// ============================================================================

export type GeographyType = 'ZI' | 'PL' | 'CO' // ZIP, Place (City), County

export interface LocationInfo {
  geoIdV4: string
  name: string
  geographyType: GeographyType
  state?: string
  county?: string
  latitude?: number
  longitude?: number
  areaSquareMiles?: number
}

export interface LocationLookupResponse {
  locations: LocationInfo[]
  total: number
}

// ============================================================================
// API Request Types
// ============================================================================

export interface GetPropertyRequest {
  address: string
  city: string
  state: string
  zip: string
}

export interface GetComparablesRequest {
  attomId: string
}

export interface SearchZipRequest {
  postalcode: string
  propertytype?: string
  page?: number
  pagesize?: number
}

export interface GetAreaSalesRequest {
  geoIdV4: string
  page?: number
  pagesize?: number
}

export interface GetSalesTrendsRequest {
  geoIdV4: string
  interval?: 'yearly' | 'quarterly' | 'monthly'
  startyear?: number
  endyear?: number
}

export interface LookupLocationRequest {
  name: string
  geographyType?: GeographyType
}

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface AttomApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
  cached?: boolean
  cachedAt?: string
}
