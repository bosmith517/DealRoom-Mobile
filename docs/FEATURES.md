# DealRoom Mobile App - Feature Documentation

DealRoom is a **real estate investor mobile app** built with React Native/Expo, designed for the full lead-to-deal lifecycle: driving for dollars, lead capture, property intelligence, skip tracing, and deal pipeline management.

---

## Table of Contents

1. [Navigation Structure](#navigation-structure)
2. [Core Features](#core-features)
3. [UI Components](#ui-components)
4. [Integrations](#integrations)
5. [Offline Capabilities](#offline-capabilities)
6. [State Management](#state-management)
7. [Data Models](#data-models)

---

## Navigation Structure

### Primary Bottom Tab Navigation (5 tabs with center FAB)

| Tab | Screen | Description |
|-----|--------|-------------|
| Dashboard | `app/(tabs)/index.tsx` | Start of day view with KPIs and quick actions |
| Leads | `app/(tabs)/leads.tsx` | List of all captured leads from driving sessions |
| Drive (FAB) | `app/driving.tsx` | Driving for Dollars mode (center floating action button) |
| Pipeline | `app/(tabs)/pipeline.tsx` | Kanban-style deal pipeline view |
| Profile | `app/(tabs)/profile.tsx` | User settings and preferences |

### Modal & Detail Screens

| Screen | Path | Description |
|--------|------|-------------|
| Login | `app/(auth)/login.tsx` | Authentication |
| Property Detail | `app/property/[assetId].tsx` | Full property/deal with 150+ ATTOM data points |
| Comparables | `app/property/comps.tsx` | Auto-matched comps with ARV analysis (V2 API) |
| Market Trends | `app/property/trends.tsx` | 5-year market trends and charts (V4 API) |
| Lead Detail | `app/lead/[id].tsx` | Lead detail with skip trace and reach workflow |
| New Property | `app/property/new.tsx` | Create new property/deal |
| Evaluation | `app/evaluation/[sessionId].tsx` | On-site photo evaluation (offline capable) |
| Triage | `app/triage.tsx` | Swipe triage queue |
| Analyze | `app/analyze.tsx` | Analysis queue |
| Buy Box | `app/buybox.tsx` | Investment criteria setup |
| Search | `app/(tabs)/search.tsx` | Deal and property search |
| Stakeholder Portal | `app/portal/[token].tsx` | Public token-based access for lenders/contractors |
| Investor Onboarding | `src/components/InvestorOnboarding.tsx` | "Train The Mantis" profile wizard |

---

## Core Features

### 1. Driving for Dollars

**Screen:** `app/driving.tsx`

Field operations mode for capturing investment opportunities while driving neighborhoods.

**Features:**
- One-hand optimized, car-friendly UI
- Live GPS route tracking with map display
- Session management (start, pause, resume, end, abandon)
- Lead capture with:
  - One-tap "TAP TO SAVE" quick capture
  - Detailed modal form (notes, tags, priority, address)
  - Photo capture integration
  - Quick distress tags
  - Priority levels (Normal, High, Hot)
- Route visualization with saved lead pins
- Session statistics (distance, duration, lead count)
- GPS status indicator
- Offline-first with AsyncStorage queue

**Quick Distress Tags:**
- Vacant
- Boarded
- Overgrown
- Mail Pileup
- For Rent
- FSBO
- Code Violation
- Good Bones

---

### 2. Swipe Triage (Tinder for Properties)

**Screen:** `app/triage.tsx`

Rapid property evaluation using swipe gestures.

**Swipe Actions:**
| Direction | Color | Action | Result |
|-----------|-------|--------|--------|
| Right | Green | Queue for Analysis | Moves to analyze queue |
| Left | Red | Dismiss | Requires reason selection |
| Up | Orange | Watch | High priority + 14-day follow-up |
| Down | Blue | Contact/Outreach | Hot priority + skip trace task |

**Dismiss Reasons:**
- Not my area
- Too expensive
- Not distressed
- Duplicate
- Other

**Card Display:**
- Property photo
- Distress score badge (color-coded)
- Address and location
- Tags and distress signals
- Notes preview
- Capture timestamp
- Animated swipe overlays

---

### 3. On-Site Property Evaluation (Signature Feature)

**Screen:** `app/evaluation/[sessionId].tsx`

Guided photo capture workflow for field evaluations - works completely offline with automatic sync.

**Key Capabilities:**
- Capture evaluations on-site, even without internet
- Photos stored locally and sync automatically when back online
- Strategy-specific photo prompts
- Progress tracking with required vs optional photos
- Upload progress indicators
- Draft saving for interrupted sessions

**Strategy-Specific Photo Prompts:**

| Strategy | Required Photos | Optional Photos |
|----------|-----------------|-----------------|
| **Flip** | Exterior Front/Rear, Kitchen Wide, Bathroom 1, Electrical Panel, HVAC, Roof | Exterior Sides, Appliances, Cabinets, Water Heater, Foundation, Flooring, Damage |
| **BRRRR** | All Flip photos + Rental Comps | Same as Flip |
| **Wholesale** | Exterior Front | Exterior Rear, Neighborhood Context, Street View |

**Photo Prompt Examples:**
- Exterior - Front (required)
- Exterior - Rear (required)
- Kitchen - Wide Shot (required)
- Kitchen - Appliances
- Bathroom 1 (required)
- Electrical Panel (required)
- HVAC Unit (required)
- Roof Condition (required)
- Foundation
- Damage Areas

**Offline Workflow:**
1. Start evaluation session on property
2. Capture photos using camera or choose from library
3. Photos saved locally to device
4. Continue capturing even without signal
5. When back online, photos auto-upload in background
6. Upload progress shown per photo
7. Session completes when all uploads finish

**Session Operations:**
- Start Session - Initialize evaluation
- Save Progress - Save draft to local storage
- Complete Session - Finalize and upload
- Abandon Session - Discard progress

---

### 4. Analyze Queue

**Screen:** `app/analyze.tsx`

Queue of properties ready for deep underwriting analysis.

**Features:**
- Priority-based grouping (Hot, High Priority, Review, Low Priority)
- Queue cards with:
  - Property thumbnail
  - Address and location
  - Property tags
  - Status indicators (Analyzing, Ready, Failed, Skip-traced)
  - Distress score badge
  - Analysis snapshot preview (ARV, Equity %, MAO)
- One-tap "Run Analysis" trigger
- Convert to Deal option
- Skip trace integration

---

### 4. Dashboard

**Screen:** `app/(tabs)/index.tsx`

Start-of-day overview with key metrics and quick actions.

**KPI Cards:**
- Active Deals count
- Pipeline Value total
- Closed YTD count
- Avg Days to Close

**Sections:**
- "Hot Leads" - Last 24h captures not yet analyzed
- Quick action buttons (Start Driving, New Deal, Search)
- Workflow action cards (Swipe Triage, Analyze Queue)
- Overdue follow-up alerts
- Recent deals list

---

### 5. Lead Management

**Screen:** `app/(tabs)/leads.tsx`

Comprehensive leads list with filtering and actions.

**Filters:**
- All, New, Pending, Queued, Converted

**Lead Card Display:**
- Address and location
- Status badge (Converted, In Queue, Dismissed, Watching, New)
- Priority dot (hot/high/normal/low)
- Source and capture time
- Capture notes preview
- Lead score

**Features:**
- Auto-geocoding for coordinate-only leads
- Pull-to-refresh
- Quick action buttons (Triage, Analyze, Drive)

---

### 6. Lead Detail & Reach Workflow

**Screen:** `app/lead/[id].tsx`

Full lead information with owner contact workflow.

**Reach Workflow State Machine:**
```
new → intel_pending → intel_ready → skiptrace_pending → outreach_ready → contacted → [nurturing|dead|converted]
```

**Action Row:**
- Enrich (Property Intel via ATTOM)
- Skip Trace (Owner contact lookup)
- Reach (Call/Text/Email owner)

**Readiness Checklist:**
- Property Intel status
- Owner Identified status
- Skip Trace status
- Reach Ready status

**Owner Contact Card:**
- Phone numbers with call/text buttons
- Email addresses with email button
- Owner name display
- Disclaimer about owner vs occupant

**Outcome Recording:**
- No Answer, Voicemail, Answered
- Wrong Number, Not Interested (→ dead)
- Interested, Callback Set (→ nurturing)
- Deal Created (→ converted)

---

### 7. Pipeline Management

**Screen:** `app/(tabs)/pipeline.tsx`

Kanban-style deal tracking through stages.

**Deal Stages:**
1. Lead
2. Researching
3. Evaluating
4. Analyzing
5. Offer Pending
6. Under Contract
7. Due Diligence
8. Closing

**Deal Card Display:**
- Address
- City
- Price (Contract/Offer/Asking)
- Days in current stage
- Stage count badge

---

### 8. Property Detail (150+ Data Points)

**Screen:** `app/property/[assetId].tsx`

Comprehensive property and deal information with full ATTOM API enrichment.

**Core Sections:**
- Deal stage with progression workflow
- Property details (type, sqft, year built, beds/baths)
- Financial information (prices, ARV, equity)
- Underwriting snapshot
- Activity timeline
- Notes

**ATTOM Property Intelligence Sections (Expandable):**

| Section | Data Points |
|---------|-------------|
| **Valuation & Equity** | AVM (value, high, low, confidence), Estimated Equity, LTV Ratio, Rental AVM, Tax Assessment |
| **Owner Information** | Owner name(s), Type (individual/LLC/corporation/trust), Occupancy status, Absentee indicator, Mailing address |
| **Distress Signals** | Foreclosure status, Lis Pendens, Notice of Default, Notice of Sale, Auction date/location, Default amount, Trustee/Lender |
| **Last Sale** | Date, Price, $/sqft, Transaction type, Buyer/Seller names, Mortgage amount, Lender |
| **Construction Details** | Foundation, Roof type/cover, Exterior walls, Heating/Cooling, Fireplaces, Basement, Garage, Pool, Quality/Condition |
| **Tax Information** | Tax year, Annual tax, Assessed value (land + improvements), Market value, Delinquency status |
| **Mortgages** | Position (1st/2nd/3rd), Original amount, Est. balance, Loan type, Interest rate, Rate type, Lender, Origination/Maturity dates |
| **Nearby Schools** | School name, Type, Distance, Rating (1-10), Grade range |
| **Sales History** | Full transaction history with prices and dates |
| **Property Identifiers** | ATTOM ID, APN, FIPS, County, Lat/Long coordinates |

**Navigation Actions:**
- View Comps → Comparables screen
- Market Trends → Market Trends screen
- Start Evaluation
- Share Portal

---

### 9. Comparables (V2 API Auto-Match)

**Screen:** `app/property/comps.tsx`

Auto-matched comparable sales from ATTOM V2 API with ARV analysis.

**Subject Property Summary:**
- Address and location
- Beds/baths/sqft/year built
- Last sale price and date

**ARV Analysis Card:**
- Calculated ARV with confidence level (High/Medium/Low)
- ARV range (low to high)
- Median comp price
- Average $/sqft
- Number of comps used

**Comparable Sales List (per comp):**
- Rank number
- Distance from subject (miles)
- Sale price and $/sqft
- Sale date (days ago)
- Property details (beds/baths/sqft/year)
- Buyer name

**Confidence Scoring:**
- **High**: 5+ comps, spread < 15%
- **Medium**: 3+ comps, spread < 25%
- **Low**: Fewer comps or high price variance

---

### 10. Market Trends (V4 API 5-Year Analysis)

**Screen:** `app/property/trends.tsx`

5-year market price and volume trends from ATTOM V4 API.

**Location Header:**
- Geography name (ZIP/City/County)
- Location type indicator

**Interval Selector:**
- Yearly (default)
- Quarterly
- Monthly

**Key Metrics Cards:**
| Metric | Description |
|--------|-------------|
| Median Price | Current 12-month median with YoY change |
| Avg Price | Average sale price |
| Total Sales | 12-month sales volume |
| Avg DOM | Average days on market |

**Price Trend Chart:**
- Bar chart visualization
- 5-year median price history
- YoY appreciation percentage

**Sales Volume Chart:**
- Bar chart of sales count
- Yearly/quarterly/monthly breakdown

**Historical Data Table:**
- Year
- Median price
- Average price
- Sales count

---

### 11. Deal Search

**Screen:** `app/(tabs)/search.tsx`

Multi-tab search interface.

**Tabs:**
| Tab | Description |
|-----|-------------|
| Deals | Search existing deals by address/name |
| Distressed | Search by distress signals |
| Property | ATTOM property lookup |

**Distress Signal Filters:**
- Pre-Foreclosure
- Tax Delinquent
- Vacant
- Boarded
- Code Violation
- Absentee Owner

**Stage Filters:**
- All, Lead, Prospect, Underwriting, Offer, Contract, Closed

---

### 12. Buy Box Setup

**Screen:** `app/buybox.tsx`

Investment criteria configuration for AI scoring.

**Location Criteria:**
- Target ZIP codes
- Target cities/states
- Exclude ZIP codes

**Property Criteria:**
- Property types (SFR, Multi 2-4, Condo, Townhouse, Land)
- Beds/baths range
- Square footage range
- Max property age
- Min lot size

**Financial Criteria:**
- Max purchase price
- Target profit margin
- Min cash-on-cash return

**Strategy & Preferences:**
- Investment strategies (Flip, BRRRR, Wholesale, Buy & Hold)
- Distress tag preferences
- Risk tolerance (Conservative, Moderate, Aggressive)

---

### 13. User Profile

**Screen:** `app/(tabs)/profile.tsx`

User settings and account management.

**Sections:**
- User avatar and info
- Subscription status badge
- Buy Box settings link
- Saved searches link
- Help center
- Terms of service
- Support contact
- Sign out

---

### 14. Stakeholder Portal

**Screen:** `app/portal/[token].tsx`

Public token-based access for external stakeholders without requiring authentication.

**Use Cases:**
- Lenders reviewing deal packages
- Contractors viewing property photos
- Partners tracking deal progress
- Investors monitoring portfolios

**Features:**
- Token-based URL access (no login required)
- Stakeholder name and type display
- Capability-based permissions:
  - View Overview - See deal summary
  - View Photos - Browse property photos
  - Upload Photos - Add inspection/progress photos
  - Comment - Leave feedback and notes
- Pending requests section
- Secure token validation via RPC

**Access Flow:**
1. User generates portal link from web dashboard
2. Stakeholder receives unique token URL
3. Token validated against `validate_portal_token_v2` RPC
4. Capabilities determined by token permissions
5. Read-only or limited write access based on role

---

### 15. Investor Onboarding ("Train The Mantis")

**Screen:** `src/components/InvestorOnboarding.tsx`

Multi-step wizard to collect investor profile information for personalized AI analysis. Uses FlipMantis branding with scrappy, investor-focused copy.

**Steps (9 total):**

| Step | Title | Subtitle | Purpose |
|------|-------|----------|---------|
| Welcome | Train The Mantis | - | Introduction with "Let's Go" CTA |
| Experience | What's Your Deal Count? | No judgment—we all started somewhere | Experience level & strategies executed |
| Financial | What's Your Firepower? | How much capital can you put to work? | Capital range & funding sources |
| Goals | What's the Play? | What are you optimizing for right now? | Primary goal & investment strategies |
| Time | How Much Bandwidth? | Hours per week you can dedicate to deals | Weekly hours & work style preference |
| Risk | What's Your Risk Appetite? | Be honest—The Mantis won't show you stuff that'll stress you out | Risk tolerance & deal-breakers |
| Team | Who's in Your Corner? | Check anyone you've got on speed dial | Team members & notes |
| Market | Where Are You Hunting? | Your home turf and target zones | Home market, target ZIPs, remote investing |
| Complete | The Mantis Is Ready | Time to hunt | Confirmation with buy box generation |

**Experience Levels:**
- Just Starting ("Learning the ropes")
- Got Some Reps ("1-5 deals under my belt")
- Been Around ("6-20 deals done")
- Seasoned Pro ("20+ deals and counting")

**Capital Ranges:**
- Under $25K, $25K-$50K, $50K-$100K, $100K-$250K, $250K-$500K, $500K+

**Funding Sources:**
- Cash, Hard Money, Private Money, Conventional Loan, HELOC, Partners/JV, Seller Finance

**Primary Goals:**
- Quick Cash ("Flip it, wholesale it, move on")
- Monthly Checks ("Build that rental income")
- Long Game ("Stack equity over time")
- Scale Up ("More doors, more deals")
- Freedom Fund ("Replace the 9-5 eventually")

**Work Styles:**
- Hands-On ("I like being in the weeds")
- Hybrid ("Some of both")
- Delegator ("I oversee, others execute")

**Risk Levels:**
- Play It Safe ("Clean deals only. No surprises.")
- Calculated Risks ("Some hair on it is fine.")
- Swing Big ("If the numbers work, let's go.")

**Risk Aversions (Deal-Breakers):**
- Foundation Issues, Mold/Water Damage, Fire Damage, Structural Problems
- Title Issues, HOA Properties, Flood Zones, High Crime Areas

**Team Members:**
- Contractor/GC ("Someone to swing hammers")
- Real Estate Agent ("Boots on the ground")
- Property Manager ("Handles the tenants")
- Mentor/Coach ("Been there, done that")

**Features:**
- Progress bar with step indicators
- Auto-saves progress at each step
- Skip option ("I'll wing it for now")
- Auto-generates Buy Boxes on completion based on profile
- Loads existing profile if previously started

**Completion Actions:**
1. Marks `onboarding_complete = true`
2. Records `onboarding_completed_at` timestamp
3. Calls `generateBuyBoxesFromProfile()` to auto-create Buy Boxes
4. Displays count of generated Buy Boxes

---

### 17. AI Analysis System

Background AI processing for property scoring and analysis.

**Capabilities:**
- Automatic lead scoring based on distress signals
- Property value estimation
- Comp selection and analysis
- Underwriting automation
- Outreach draft generation

**Job Types:**
| Job Type | Description |
|----------|-------------|
| `score_candidate` | AI scoring for lead prioritization |
| `underwrite_snapshot` | Financial analysis |
| `comp_select` | Comparable property selection |
| `repair_estimate` | Rehab cost estimation |
| `outreach_draft` | Message template generation |
| `portal_summary` | Stakeholder summary generation |
| `intel_enrich` | Property intelligence enrichment |

**Workflow:**
1. Job queued via `enqueueAIJob()`
2. Background processor picks up job
3. Status polling via `getAIJobStatus()`
4. Results stored with cost tracking
5. Lead/deal updated with AI insights

**Cost Tracking:**
- Per-job cost estimates
- Total cost aggregation per lead/deal
- Displayed in AIScoreCard component

---

### 18. Distress Scoring System

Automated scoring algorithm for property distress indicators.

**Distress Signals & Weights:**
| Signal | Score Weight |
|--------|--------------|
| Pre-Foreclosure | +25 |
| Tax Delinquent | +20 |
| Vacant | +15 |
| Absentee Owner | +15 |
| Boarded | +15 |
| Code Violations | +10 |
| High Equity (>50%) | +20 |
| High Equity (30-50%) | +15 |
| High Equity (10-30%) | +10 |

**Score Visualization:**
- **High (70+)**: Red badge - Hot opportunity
- **Medium (40-69)**: Orange badge - Worth investigating
- **Low (<40)**: Green badge - Lower priority

**Quick Score Calculation:**
Tags captured during driving are automatically weighted and summed to produce initial lead score.

---

## UI Components

### Core Components

| Component | File | Description |
|-----------|------|-------------|
| ScreenContainer | `src/components/ScreenContainer.tsx` | Main screen wrapper with safe area |
| ViewContainer | `src/components/ScreenContainer.tsx` | Layout variant |
| CenteredContainer | `src/components/ScreenContainer.tsx` | Centered layout |
| Card, CardHeader, CardBody, CardFooter | `src/components/Card.tsx` | Card component system |
| Button, IconButton | `src/components/Button.tsx` | Button variants |
| Input, Textarea, SearchInput | `src/components/Input.tsx` | Form inputs |
| OfflineBanner | `src/components/OfflineBanner.tsx` | Network status indicator |

### Specialized Components

| Component | File | Description |
|-----------|------|-------------|
| DealRoomMap | `src/components/DealRoomMap.tsx` | Mapbox map with route/pins |
| SkipTraceButton | `src/components/SkipTraceButton.tsx` | Trigger skip trace lookup |
| SkipTraceResults | `src/components/SkipTraceResults.tsx` | Display owner contact info |
| ReachWorkflow | `src/components/ReachWorkflow.tsx` | State machine UI for owner contact |
| OutcomeRecorder | `src/components/OutcomeRecorder.tsx` | Record interaction outcomes |
| ActivityTimeline | `src/components/ActivityTimeline.tsx` | Timeline of lead/deal activities |
| AIScoreCard | `src/components/AIScoreCard.tsx` | Display AI analysis scores |

---

## Integrations

### 1. Skip Trace Service (BatchData API)

**Purpose:** Owner contact information lookup

**Returns:**
- Phone numbers (mobile, landline, VoIP) with type, carrier, validation
- Email addresses (personal, work) with validation
- Current/mailing/previous addresses
- Relatives and associates
- Litigator check (flag and score)
- Bankruptcy indicators
- Data quality scoring
- Overall match score

**Features:**
- Cached results with expiration
- Usage tracking and quota management
- Litigator detection warnings

### 2. ATTOM Property Data (6 API Actions)

**Purpose:** Comprehensive property intelligence with 600+ data points across all APIs.

**API Actions:**

| Action | API Version | Endpoint | Returns |
|--------|-------------|----------|---------|
| `getProperty` | V1 | `/property/expandedprofile` | 150+ property data points (AVM, owner, construction, tax, schools, foreclosure) |
| `getComparables` | V2 | `/salescomparables/propid/{id}` | Auto-matched comps with ARV analysis |
| `searchZip` | V1 | `/property/address` | Properties in ZIP code |
| `getAreaSales` | V1 | `/sale/snapshot` | Recent sales in geography |
| `getSalesTrends` | V4 | `/transaction/salestrend` | 5-year price/volume trends |
| `lookupLocation` | V4 | `/location/lookup` | geoIdV4 for cities/counties/ZIPs |

**Service Methods:**
```typescript
// Core methods
attomService.getProperty({ address, city, state, zip })
attomService.getComparables(attomId)
attomService.searchZip({ postalcode, propertytype, page })
attomService.getAreaSales({ geoIdV4, page })
attomService.getSalesTrends({ geoIdV4, interval, startyear, endyear })
attomService.lookupLocation({ name, geographyType })

// Convenience methods
attomService.getComparablesWithARV(attomId)  // With calculated ARV
attomService.getSalesTrendsByZip(zip, interval)  // Auto-lookup geoIdV4
attomService.get5YearTrends(geoIdV4, interval)  // Pre-configured 5-year range
attomService.getFullPropertyIntel(address, city, state, zip)  // All data at once
```

**Data Coverage:**
| Category | Data Points | Examples |
|----------|-------------|----------|
| Valuation | 6+ | AVM value/high/low/confidence, rental AVM, equity estimate |
| Owner | 10+ | Name, type, occupancy, absentee, mailing address |
| Construction | 14+ | Foundation, roof, HVAC, garage, pool, quality |
| Tax | 8+ | Annual tax, assessed/market values, delinquency |
| Mortgages | 9+ per lien | Amount, balance, rate, lender, dates |
| Schools | 10+ per school | Name, type, rating, distance, grades |
| Foreclosure | 10+ | Status, notices, auction date, default amount |
| Sales History | 10+ per sale | Price, date, buyer/seller, transaction type |

### 3. Supabase

**Authentication:**
- Email/password authentication
- Session persistence via SecureStore
- Entitlement/subscription checking
- Tenant isolation

**Database Tables:**
- `dealroom_deals` - Deal records
- `dealroom_properties` - Property data
- `dealroom_leads` - Captured leads
- `dealroom_lead_media` - Lead photos
- `dealroom_lead_interactions` - Reach interactions
- `dealroom_lead_reach_events` - Reach workflow audit
- `dealroom_activity_events` - Timeline activities
- `dealroom_ai_jobs` - Async analysis jobs

---

## Offline Capabilities

### AsyncStorage-Based Caching

**Cached Data:**
- Deals cache (24hr expiration)
- Property cache per asset
- Evaluation drafts per session
- Map viewport preferences
- User preferences

### Pending Mutations Queue

When offline, these operations are queued for sync:

| Mutation Type | Description |
|--------------|-------------|
| `evaluation_update` | Evaluation form updates |
| `note_create` | New notes on leads/deals |
| `checklist_update` | Checklist item changes |
| `lead_update` | Lead field updates |
| `deal_update` | Deal field updates |
| `reach_transition` | Reach workflow state changes |
| `reach_interaction` | Call/text/email recordings |

### Offline Driving Mode

- GPS points batching (30m distance OR 5s time threshold)
- Batch uploads (50 points at a time)
- Server-side deduplication (10k point limit per session)
- Lead captures queued in AsyncStorage

### Sync Service

- Automatic sync when connectivity restored
- Retry mechanism (max 3 retries)
- Error tracking and reporting
- Manual "Sync Now" option

---

## State Management

### Context Providers

| Context | File | Purpose |
|---------|------|---------|
| AuthContext | `src/contexts/AuthContext.tsx` | User auth, session, entitlements |
| OfflineContext | `src/contexts/OfflineContext.tsx` | Offline status, sync state |

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| useDrivingSession | `src/hooks/useDrivingSession.ts` | Driving session lifecycle, GPS, leads |
| useEvaluationSession | `src/hooks/useEvaluationSession.ts` | Photo evaluation with offline sync |
| useLocation | `src/hooks/useLocation.ts` | GPS tracking, permissions, geocoding |
| useCamera | `src/hooks/useCamera.ts` | Photo capture |

### Service Layer

| Service | File | Purpose |
|---------|------|---------|
| apiService | `src/services/api.ts` | Edge function calls |
| attomService | `src/services/attomService.ts` | ATTOM API (6 actions, 600+ data points) |
| dataService | `src/services/data.ts` | Supabase queries |
| uploadService | `src/services/upload.ts` | File uploads |
| offlineService | `src/services/offline.ts` | AsyncStorage cache |
| syncService | `src/services/sync.ts` | Mutation sync |
| skipTraceService | `src/services/skipTrace.ts` | Skip trace lookups |

---

## Data Models

### Core Types

```typescript
// Deal stages (10 total)
type DealStage =
  | 'prospecting' | 'lead' | 'researching' | 'evaluating' | 'analyzing'
  | 'offer_pending' | 'under_contract' | 'due_diligence' | 'rehab'
  | 'listed' | 'sold' | 'closed' | 'dead'

// Exit strategies
type ExitStrategy =
  | 'flip' | 'brrrr' | 'wholesale' | 'hold'
  | 'subject_to' | 'lease_option' | 'other'

// Reach workflow states
type ReachStatus =
  | 'new' | 'intel_pending' | 'intel_ready' | 'intel_failed'
  | 'skiptrace_pending' | 'skiptrace_ready' | 'skiptrace_failed'
  | 'outreach_ready' | 'contacted' | 'nurturing' | 'dead' | 'converted'

// Triage statuses
type TriageStatus = 'new' | 'queued' | 'dismissed' | 'watching' | 'converted'

// Lead priorities
type LeadPriority = 'low' | 'normal' | 'high' | 'hot'

// Property types
type PropertyType = 'sfr' | 'multi_2_4' | 'condo' | 'townhouse' | 'land' | 'commercial' | 'mixed_use'
```

### Key Interfaces

- `Deal` / `DealWithProperty` - Deal with associated property
- `Property` - Property details
- `Lead` - Captured property lead
- `TriageLead` - Lead with triage data (rank score, distress signals)
- `AnalyzeQueueItem` - Lead with analysis snapshot
- `SkipTraceResult` - Owner contact information
- `BuyBox` - Investment criteria
- `Underwriting` - Analysis and valuation
- `Followup` - Task/reminder
- `ActivityEvent` - Timeline activity
- `AIJob` - Async analysis job

---

## Technical Details

### Build Configuration

- **Framework:** React Native + Expo SDK 52
- **Navigation:** Expo Router (file-based)
- **Maps:** @rnmapbox/maps (Mapbox GL)
- **Storage:** AsyncStorage + SecureStore
- **Backend:** Supabase (Auth, Database, Storage, Edge Functions)

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@rnmapbox/maps` | Native Mapbox GL maps |
| `react-native-gesture-handler` | Swipe gestures for triage |
| `react-native-reanimated` | Smooth animations |
| `expo-image-picker` | Camera & photo library |
| `expo-image-manipulator` | Image compression |
| `expo-file-system` | Local file storage |
| `expo-location` | GPS tracking |
| `expo-secure-store` | Secure credential storage |
| `@react-native-async-storage/async-storage` | Offline data caching |
| `@react-native-community/netinfo` | Network status detection |
| `@supabase/supabase-js` | Backend client |

### Performance Optimizations

- GPS point batching to reduce API calls
- Image compression (0.7 quality)
- Lazy loading of data
- Pagination support
- Caching with expiration
- Native map rendering

### Design System

- **Colors:** Brand blue (#3B82F6), slate grays, semantic colors
- **Typography:** Responsive font scale (xs → 2xl)
- **Spacing:** Consistent spacing scale
- **Shadows:** Soft, small, medium, large variants
- **Touch targets:** 44px minimum for accessibility

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Screens | 18+ |
| Core Features | 18 |
| UI Components | 13+ |
| Services | 7+ |
| Custom Hooks | 4+ |
| API Integrations | 3 (Skip Trace, ATTOM, Supabase) |
| ATTOM API Actions | 6 |
| ATTOM Data Points | 600+ (with comps/trends) |
| Property Detail Sections | 10 |
| Deal Stages | 13 |
| Exit Strategies | 7 |
| Quick Tags | 8 |
| Offline Mutation Types | 7 |
| AI Job Types | 7 |
