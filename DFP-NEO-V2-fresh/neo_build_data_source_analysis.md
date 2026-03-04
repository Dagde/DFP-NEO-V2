# NEO Build Algorithm Data Source Analysis

## Current Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    App.tsx (Main Component)                  │
│                                                               │
│  1. Initial State:                                            │
│     instructorsData = ESL_DATA.instructors (mockdata only)   │
│                                                               │
│  2. useEffect (Database Loading):                             │
│     - Fetches from /api/personnel                             │
│     - Converts to Instructor format                          │
│     - Merges with existing instructorsData                   │
│     - Removes duplicates by idNumber                         │
│     - Updates instructorsData state                          │
│                                                               │
│  3. Staff Page (InstructorListView):                          │
│     - Receives instructorsData as prop                       │
│     - Filters by role (QFI, SIM IP, OFI, Other)              │
│     - Displays grouped by Unit → Rank → Name                 │
│                                                               │
│  4. Staff Combined Data (StaffCombinedDataTable):            │
│     - Receives instructorsData as prop                       │
│     - Separately fetches from /api/personnel                 │
│     - Combines mockdata + database (same as App.tsx)         │
│     - Shows ALL staff regardless of role                    │
│                                                               │
│  5. NEO Build Algorithm (runBuildAlgorithm):                 │
│     - Uses instructorsData state variable                    │
│     - Passes to DfpConfig.instructors                        │
│     - Filters internally by role (QFI, SIM IP only)          │
└─────────────────────────────────────────────────────────────┘
```

## Key Findings

### 1. Current Data Source: ALREADY SHARED ✅

**The NEO Build algorithm ALREADY uses the same data source:**
- App.tsx initializes `instructorsData` with mockdata
- useEffect fetches database staff and merges with mockdata
- This `instructorsData` is used by:
  - Staff Page (InstructorListView) ✓
  - Staff Combined Data Table ✓
  - NEO Build Algorithm ✓

### 2. The Problem is NOT the Data Source

The issue is **NOT** that NEO Build uses different data. The issue is:
- NEO Build uses the same `instructorsData`
- BUT it applies internal filtering that excludes certain staff

### 3. Filtering Locations

**NEO Build Algorithm Filtering:**
```typescript
// Line 2451-2455: FTD events
const simIps = instructors.filter(i => i.role === 'SIM IP');
const qfis = instructors.filter(i => i.role === 'QFI');

// Line 6743: Pilot remedies
const qualifiedPilots = instructorsData.filter(i => i.role === 'QFI');
```

**Staff Page Filtering:**
```typescript
// In InstructorListView.tsx
const qfis = instructorsData.filter(i => i.role === 'QFI' || i.isQFI === true);
const ofis = instructorsData.filter(i => i.role === 'OFI' || i.isOFI === true);
```

## The Real Issue

Alexander Burns has:
- `role = 'OFI'` (or similar) in database
- `isQFI = true` in database
- Appears in Staff Combined Data ✓
- Appears in Staff Page ✓
- Does NOT appear in NEO Build schedule ✗

**Why?** Because NEO Build filters by `i.role === 'QFI'`, not `i.isQFI === true`.

## Can We Point NEO Build to Staff Combined Data Table?

### Answer: NO - This Won't Work

### Reasons:

1. **StaffCombinedDataTable is a UI Component**
   - It's a React component, not a data source
   - It manages its own state (databaseStaff, combinedData)
   - It's meant for display, not data sharing

2. **Component State Isolation**
   - StaffCombinedDataTable's `combinedData` state is private
   - It cannot be accessed from App.tsx
   - React doesn't allow accessing child component state from parent

3. **Data Is Already Shared**
   - Both use the same `instructorsData` from App.tsx
   - The data source is ALREADY the same
   - Pointing to StaffCombinedDataTable wouldn't change anything

4. **The Problem is Filtering, Not Data**
   - Alexander Burns IS in the data
   - The issue is how NEO Build filters that data
   - Changing the data source won't fix the filtering logic

## Alternative Approaches

### Option 1: Update NEO Build Filtering (Recommended)
Change NEO Build to check both `role` and `isQFI`:
```typescript
// Current
const qfis = instructors.filter(i => i.role === 'QFI');

// Proposed
const qfis = instructors.filter(i => i.role === 'QFI' || i.isQFI === true);
```

**Pros:**
- Fixes the root cause
- Minimal code change
- Doesn't break anything else
- Uses the same data source that's already working

**Cons:**
- Need to verify it doesn't break Staff List (as seen in previous attempt)

### Option 2: Create Shared Combined Data State
Move the combined data logic to a shared context or store:
```typescript
// Create a shared context
const StaffDataContext = createContext(combinedData);

// Both components use the same context
<StaffCombinedDataTable data={combinedData} />
<NEOBuild data={combinedData} />
```

**Pros:**
- Centralized data management
- Consistent data across all components
- Easier to maintain

**Cons:**
- Significant refactoring required
- More complex architecture
- Overkill for this specific issue

### Option 3: Pre-process Data for NEO Build
Create a pre-filtered version of instructorsData specifically for NEO Build:
```typescript
const neoBuildInstructors = useMemo(() => {
  return instructorsData.filter(i => 
    i.role === 'QFI' || i.role === 'SIM IP' || i.isQFI === true
  );
}, [instructorsData]);

// Use in NEO Build
const config: DfpConfig = {
  instructors: neoBuildInstructors,
  ...
};
```

**Pros:**
- Clean separation of concerns
- Easy to understand
- Doesn't affect other components

**Cons:**
- Maintains duplicate data
- Need to sync updates

## Recommendation

**DO NOT point NEO Build to Staff Combined Data Table.** It won't work because:

1. It's a UI component, not a data source
2. The data source is already shared (instructorsData)
3. The issue is filtering logic, not data source

**Instead, focus on:**
1. Understanding why the previous filtering fix broke the Staff List
2. Fixing the filtering logic without breaking other components
3. Ensuring consistent filtering across all components

## Root Cause Analysis

The previous attempt to fix NEO Build filtering broke the Staff List because:

1. **InstructorListView.tsx** was modified to check `isQFI` flag
2. **App.tsx** filtering was also modified to check `isQFI` flag
3. The combination of both changes caused an issue

The correct approach is:
- **Only modify App.tsx filtering** (NEO Build algorithm)
- **Leave InstructorListView.tsx as-is** (Staff Page)
- They should have independent filtering logic

## Conclusion

**Answer: NO, we cannot point NEO Build to Staff Combined Data Table.**

The data source is already shared and correct. The issue is the filtering logic in the NEO Build algorithm. The solution is to update the NEO Build filtering to check both `role === 'QFI'` AND `isQFI === true`, but do this ONLY in App.tsx where NEO Build runs, NOT in InstructorListView.tsx where the Staff Page runs.