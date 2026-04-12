# Mock Data Analysis - Deep Dive

**Analysis Date**: April 7, 2026  
**Branch**: feature/comprehensive-build-algorithm  
**Repository**: Dagde/DFP-NEO-V2

---

## Executive Summary

The Flight School Scheduler application has **extensive mock data infrastructure** that is **still actively used** in production. Mock data serves as a **fallback mechanism** and **development tool**, but it is **NOT safe to remove at this time**. The system has a sophisticated dual-data-source architecture allowing users to toggle between mock data and database data via a Settings interface.

---

## 1. Mock Data Structure

### Primary Mock Data File: `mockData.ts`
- **Location**: `/workspace/DFP-NEO-V2-fresh/mockData.ts`
- **Size**: 2,270 lines
- **Size**: 101,873 bytes (~100 KB)

### Exports from mockData.ts

1. **ESL_DATA** - English as Second Language location data
   - `instructors`: Array of instructor objects
   - `trainees`: Array of trainee objects
   - `aircraft`: Array of aircraft data
   - `events`: Array of schedule events
   
2. **PEA_DATA** - Pilot Education Academy location data
   - `instructors`: Array of instructor objects
   - Similar structure to ESL_DATA
   
3. **INITIAL_SYLLABUS_DETAILS** - Syllabus configuration
   - Complete syllabus items for all courses
   - Used as default syllabus template
   - **This is NOT mock data in the traditional sense** - it's configuration data

4. **DEFAULT_PHRASE_BANK** - Communication phrases
   - Default phrases for radio communication
   - **This is NOT mock data** - it's configuration/reference data

---

## 2. Current Mock Data Usage

### Files Importing Mock Data

| File | Purpose | Mock Data Used |
|------|---------|----------------|
| `App.tsx` | Main application | ESL_DATA, PEA_DATA, INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK |
| `App_remote.tsx` | Remote app version | Same as App.tsx |
| `lib/dataService.ts` | Data loading service | ESL_DATA, PEA_DATA (for fallback) |
| `components/DataSourcesSettings.tsx` | Settings UI | ESL_DATA (for migration) |

### Migration Scripts (Historical/One-time Use)
- `migration-scripts/migrate-personnel-and-trainees.ts`
- `migration-scripts/migrate-personnel.ts`
- These import mock data to populate the database

---

## 3. Data Source Architecture

### Dual-Source System

The application implements a **sophisticated data source toggle system** controlled via user settings:

#### Data Source Settings (localStorage key: `dataSourceSettings`)
```typescript
interface DataSourceSettings {
  staff: boolean;        // Staff MockData ON/OFF
  trainee: boolean;      // Trainee MockData ON/OFF
  staffDb: boolean;      // Staff Database ON/OFF
  traineeDb: boolean;    // Trainee Database ON/OFF
}
```

#### Default Settings
```typescript
default: {
  staff: true,         // Mock data ON
  trainee: true,       // Mock data ON
  staffDb: true,       // Database ON
  traineeDb: true,     // Database ON
}
```

**This means mock data is ENABLED by default alongside database data!**

---

## 4. Data Merging Logic

### Instructor Data Flow (`lib/dataService.ts`)

1. **Load from Database**: Fetches instructors from PostgreSQL via Prisma
2. **Load Mock Data**: Loads ESL_DATA and PEA_DATA instructors
3. **Merge & Deduplicate**: 
   - Uses `idNumber` for deduplication
   - Tags each record with `_dataSource: 'database'` or `_dataSource: 'mockdata'`
   - Database records take precedence
4. **Filter Based on Settings**:
   - If `staff: false` and `staffDb: true` → Show only database
   - If `staff: true` and `staffDb: false` → Show only mock
   - If both true → Merge both (database first)
   - If both false → Show nothing

### Trainee Data Flow (`lib/dataService.ts`)

Similar logic with these differences:
- Only uses ESL_DATA trainees (no PEA trainees)
- Deduplicates by `name` instead of `idNumber`
- Mock trainees are added only if their course doesn't exist in database

---

## 5. Fallback Mechanism

### API Failure Fallback

In `lib/dataService.ts`, there's a critical fallback mechanism:

```typescript
// If API returned no data, fallback to mock data
if (instructors.length === 0) {
  instructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors].map(
    (i) => ({ ...i, _dataSource: 'mockdata' })
  );
}

if (trainees.length === 0) {
  trainees = ESL_DATA.trainees.map(
    (t) => ({ ...t, _dataSource: 'mockdata' })
  );
}
```

**If the database API fails or returns no data, the app automatically falls back to mock data!**

### Catch-All Error Fallback

```typescript
catch (error) {
  console.error('Failed to load data from API:', error);
  return {
    instructors: ESL_DATA.instructors.map((i) => ({ ...i, _dataSource: 'mockdata' })),
    trainees: ESL_DATA.trainees.map((t) => ({ ...t, _dataSource: 'mockdata' })),
    // ... other mock data
  };
}
```

---

## 6. Settings Interface

### DataSourcesSettings Component

Located at: `components/DataSourcesSettings.tsx`

**Features**:
1. **4 Toggle Switches**:
   - Staff MockData
   - Trainee MockData  
   - Staff Database
   - Trainee Database

2. **Migration Tool**:
   - Button to migrate mock staff to database
   - Shows migration results (inserted, skipped, errors)

3. **Integration**:
   - Accessible via Settings → Data Sources menu
   - Settings persisted to localStorage
   - Changes reflect immediately in UI

### Mock Data Viewing Components

1. **StaffMockDataTable** (`components/StaffMockDataTable.tsx`)
   - Displays mock staff members
   - Allows deletion from mock data display only
   - Used in Settings → Staff MockData tab

2. **TraineeMockDataTable** (`components/TraineeMockDataTable.tsx`)
   - Displays mock trainees
   - Allows deletion from mock data display only
   - Used in Settings → Trainee MockData tab

---

## 7. Database Schema

### Personnel Table
```prisma
model Personnel {
  id          String   @id @default(cuid())
  userId      String?  @unique  // ← Real DB staff have userId
  name        String
  idNumber    Int?     // ← Used for deduplication
  // ... many other fields
}
```

**Key Insight**: Real database staff have `userId`, mock data imported to DB has `userId: null`

### Trainee Table
```prisma
model Trainee {
  id          String   @id @default(cuid())
  userId      String?  @unique
  idNumber    Int      @unique
  name        String
  course      String?
  // ... other fields
}
```

---

## 8. Mock Data Types

### Used in Production (Active)

1. **Staff/Trainee Mock Data**: 
   - **Status**: ACTIVE
   - **Purpose**: Development, testing, fallback, complementing real data
   - **Can be removed**: ❌ NO - Still actively used

2. **Aircraft Mock Data**:
   - **Status**: ACTIVE
   - **Purpose**: Aircraft configuration
   - **Can be removed**: ❌ NO - Used when DB returns empty

3. **Events Mock Data**:
   - **Status**: ACTIVE (fallback only)
   - **Purpose**: Schedule event template
   - **Can be removed**: ⚠️ MEDIUM RISK - Only used as fallback

### Configuration Data (Not Mock Data)

1. **INITIAL_SYLLABUS_DETAILS**:
   - **Status**: CONFIGURATION
   - **Purpose**: Syllabus structure/template
   - **Can be removed**: ❌ NO - This is application configuration, not mock data
   - **Should be**: Moved to database or separate config files

2. **DEFAULT_PHRASE_BANK**:
   - **Status**: REFERENCE DATA
   - **Purpose**: Radio communication phrases
   - **Can be removed**: ❌ NO - This is reference data, not mock data
   - **Should be**: Moved to database or separate config files

---

## 9. Components Relying on Mock Data

### Direct Dependencies

1. **App.tsx**
   - Imports ESL_DATA, PEA_DATA
   - Uses for initial data population
   - Filtering logic depends on `_dataSource` field

2. **lib/dataService.ts**
   - **CRITICAL DEPENDENCY**
   - Merges mock data with database data
   - Fallback mechanism relies on mock data
   - Cannot function without mock data imports

3. **components/DataSourcesSettings.tsx**
   - Uses ESL_DATA for migration to database
   - Toggle UI for mock data sources

4. **components/StaffMockDataTable.tsx**
   - Displays mock staff only
   - Purpose: View/manage mock data in Settings

5. **components/TraineeMockDataTable.tsx**
   - Displays mock trainees only
   - Purpose: View/manage mock data in Settings

6. **components/SettingsViewWithMenu.tsx**
   - Integrates mock data tables
   - Filter logic for mock vs database data

### Indirect Dependencies

Any component that loads data via `dataService.ts` indirectly depends on mock data for:

1. **Fallback if database fails**
2. **Additional data when mock data is enabled**
3. **Development/testing scenarios**

---

## 10. Production Environment Assessment

### Railway Deployment

- **Database**: PostgreSQL (Railway-hosted)
- **Application**: React + Next.js
- **Data Source**: Mixed (Database + Mock Data by default)

### Default Production State

Based on code analysis, the **default state is**:
- ✅ Database queries: ENABLED
- ✅ Mock data sources: ENABLED
- ✅ Both sources merged together
- ✅ User can toggle via Settings

**This means mock data IS being used in production!**

---

## 11. Risk Assessment

### Removing Mock Data - Risk Level: ⚠️ **HIGH**

#### Critical Risks

1. **Application Failure on Database Issues**
   - If database is down, slow, or returns empty
   - Current behavior Falls back to mock data (graceful degradation)
   - Without mock data: **Complete application failure**

2. **Loss of Development/Test Data**
   - No test data for new features
   - Cannot test scenarios not present in production database
   - Slower development cycle

3. **Configuration Data Removal**
   - INITIAL_SYLLABUS_DETAILS is NOT mock data but tagged with it
   - Removing mockData.ts would break syllabus initialization
   - DEFAULT_PHRASE_BANK would also be lost

4. **Existing User Settings**
   - Users may have mock data enabled in localStorage
   - Breaking change affecting all users

5. **Migration Tool Dependency**
   - DataSourcesSettings component uses ESL_DATA for migration
   - Would need complete rewrite of migration functionality

#### Medium Risks

1. **Incomplete Database Data**
   - If database is partial (e.g., only some locations have data)
   - Mock data fills gaps for other locations
   - Without it: Incomplete data display

2. **Testing Scenarios**
   - Cannot test edge cases not in production DB
   - Cannot test with empty database scenarios

---

## 12. Recommendations

### Immediate Actions

1. **❌ DO NOT Remove Mock Data**
   - Too many dependencies
   - High risk of breaking production
   - Benefits don't outweigh risks

2. **✅ Separate Configuration from Mock Data**
   - Move `INITIAL_SYLLABUS_DETAILS` to: `config/syllabus.ts` or database
   - Move `DEFAULT_PHRASE_BANK` to: `config/phrases.ts` or database
   - Update imports

3. **✅ Document Mock Data Purpose**
   - Add JSDoc comments explaining fallback mechanism
   - Document which data is mock vs configuration

### Medium-Term Improvements

1. **Add Database Migration for Configuration**
   - Migrate syllabus details to database
   - Migrate phrase bank to database
   - Load from DB, use mock only as fallback

2. **Improve Error Handling**
   - Add explicit error messages when both DB and mock fail
   - Add retry logic for database queries
   - Add health check endpoint

3. **Add Feature Flags**
   - Add deployment-level feature flag for mock data
   - Disable mock data in production deployments (optional)
   - Keep mock data for development/staging

### Long-Term Strategy

1. **Phase Out Mock Data Gracefully**
   - Ensure database is populated with all necessary data
   - Add monitoring to ensure DB returns data
   - Gradually disable mock data per location

2. **Create Dedicated Test Data Setup**
   - Separate test data from production mock data
   - Create seeding scripts for development
   - Use fixtures for unit tests

3. **Data Validation**
   - Add validation for database data
   - Ensure all required fields are present
   - Add data quality checks

---

## 13. Migration Path (If Removal is Required)

### Phase 1: Preparation (1-2 weeks)
1. Separate configuration data from mock data
2. Create database migration for syllabus/phrases
3. Add comprehensive error handling
4. Add monitoring and health checks

### Phase 2: Database Populaton (2-4 weeks)
1. Ensure all locations have complete data in database
2. Run data quality checks
3. Verify all mock data scenarios covered by DB
4. Add data seeding scripts

### Phase 3: Feature Flagging (1 week)
1. Add environment variable: `ENABLE_MOCK_DATA=false`
2. Deploy with flag set to `true` initially
3. Monitor production
4. Test with flag set to `false` in staging

### Phase 4: Gradual Rollout (2-4 weeks)
1. Set `ENABLE_MOCK_DATA=false` in production
2. Monitor errors and performance
3. Roll back if issues occur
4. Keep code available for quick rollback

### Phase 5: Cleanup (1 week)
1. Remove mock data imports from production code
2. Remove data source toggle UI
3. Remove fallback logic
4. Update documentation

**Total Timeline: 7-12 weeks**

---

## 14. Code References

### Key Files to Modify (for removal)

1. `/workspace/DFP-NEO-V2-fresh/mockData.ts` - DELETE or split
2. `/workspace/DFP-NEO-V2-fresh/lib/dataService.ts` - Remove fallback logic
3. `/workspace/DFP-NEO-V2-fresh/App.tsx` - Remove mock data imports
4. `/workspace/DFP-NEO-V2-fresh/App_remote.tsx` - Remove mock data imports
5. `/workspace/DFP-NEO-V2-fresh/components/DataSourcesSettings.tsx` - REMOVE component
6. `/workspace/DFP-NEO-V2-fresh/components/StaffMockDataTable.tsx` - DELETE component
7. `/workspace/DFP-NEO-V2-fresh/components/TraineeMockDataTable.tsx` - DELETE component
8. `/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx` - Remove mock data tabs

### Lines of Code Impact

| File | Lines to Remove | Reason |
|------|-----------------|--------|
| `mockData.ts` | 2,270 | Entire file (or split to keep config) |
| `dataService.ts` | ~150 | Fallback and merge logic |
| `App.tsx` | ~50 | Mock data imports and filtering |
| `DataSourcesSettings.tsx` | 360 | Entire component |
| `StaffMockDataTable.tsx` | 157 | Entire component |
| `TraineeMockDataTable.tsx` | 160 | Entire component |
| `SettingsViewWithMenu.tsx` | ~100 | Mock data UI sections |
| **Total** | **~3,200+ lines** | Significant codebase reduction |

---

## 15. Conclusion

### Current State: ❌ **NOT SAFE TO REMOVE**

**Mock data is deeply integrated** into the Flight School Scheduler application:

1. ✅ **Active in Production**: Default settings enable mock data alongside database
2. ✅ **Critical Fallback**: App relies on mock data when DB fails
3. ✅ **User-Facing Feature**: Settings UI allows users to toggle data sources
4. ✅ **Development Tool**: Essential for testing and development
5. ⚠️ **Configuration Mixed In**: Syllabus and phrase data incorrectly tagged as "mock"

### Recommendation: ✅ **KEEP FOR NOW**

**Keep mock data** and focus on these improvements instead:

1. **Separate configuration data** from actual mock data
2. **Improve database reliability** to reduce fallback needs
3. **Add feature flags** for optional mock data in production
4. **Document purpose** clearly for future developers
5. **Create test data strategy** separate from mock data

### When Can It Be Removed?

Mock data can be safely removed only when:
- ✅ Database is 100% reliable and complete
- ✅ All configuration data moved to database
- ✅ Comprehensive error handling in place
- ✅ Feature flags implemented for testing
- ✅ Monitoring shows no fallback needed for 30+ days
- ✅ Test data strategy implemented separately

**Estimated Timeline**: 7-12 weeks with proper migration path

---

## Appendix: Quick Reference

### Mock Data Files
- **Primary**: `mockData.ts` (2,270 lines)
- **Imports**: App.tsx, App_remote.tsx, lib/dataService.ts, DataSourcesSettings.tsx

### Key Functions
- `mergeInstructorData()` - Merges DB and mock instructors
- `mergeTraineeData()` - Merges DB and mock trainees
- Falls back to ESL_DATA on API failure

### Database Tables
- `Personnel` - Staff (real + mock imports)
- `Trainee` - Trainees (real + mock imports)

### Settings Keys
- `localStorage.dataSourceSettings` - User preferences

### Components
- `DataSourcesSettings` - Toggle UI (360 lines)
- `StaffMockDataTable` - View mock staff (157 lines)
- `TraineeMockDataTable` - View mock trainees (160 lines)

### Configuration vs Mock Data
| Data | Type | Should Remove? |
|------|------|----------------|
| ESL/PEA Instructors | Mock | ⚠️ Eventually |
| ESL/PEA Trainees | Mock | ⚠️ Eventually |
| Aircraft | Mock | ⚠️ Eventually |
| Events | Mock | ⚠️ Eventually |
| INITIAL_SYLLABUS_DETAILS | Config | ❌ Move to DB |
| DEFAULT_PHRASE_BANK | Config | ❌ Move to DB |