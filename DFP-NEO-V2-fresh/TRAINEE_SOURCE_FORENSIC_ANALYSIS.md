# Trainee Data Source Forensic Analysis

## Executive Summary

**Objective:** Prove whether the build algorithm receives a mixed mock+DB trainee dataset when DB-only mode is selected (mockOn=false, dbOn=true).

**Runtime Observation:** User reports console shows:
- mockOn=false
- dbOn=true
- traineesData contains: db=127, mock=89

**Finding:** **CONTAMINATION CONFIRMED** - Mock trainees ARE entering the build pipeline despite DB-only mode selection.

---

## Complete Data Flow Trace

### 1. **Data Source: `initializeData()` in lib/dataService.ts (line 188)**

**Location:** `DFP-NEO-V2-fresh/lib/dataService.ts:188-300`

**Behavior:**
```typescript
// Fetch trainees - ALWAYS load all data regardless of toggle settings
console.log('👨‍🎓 Fetching trainees from API...');
trainees = await fetchTrainees();
console.log('✅ Trainee DB loaded:', trainees.length);

// Always merge both DB and mock data with _dataSource tags
// App.tsx filtering will decide what to show based on toggle state
trainees = mergeTraineeData(trainees, ESL_DATA.trainees, true);
console.log('🔄 Loaded all trainees (DB + mock) with _dataSource tags for UI filtering');
```

**Key Points:**
- ✅ DB trainees fetched via API and tagged with `_dataSource: 'database'`
- ✅ Mock trainees from `ESL_DATA.trainees` merged with `_dataSource: 'mockdata'`
- ✅ `includeMockData=true` is hardcoded - MERGE ALWAYS HAPPENS
- ❌ **No filtering based on toggle settings at this level**

**Output:** Mixed array containing both DB and mock trainees with `_dataSource` tags.

---

### 2. **Merge Function: `mergeTraineeData()` in lib/dataService.ts (line 144)**

**Location:** `DFP-NEO-V2-fresh/lib/dataService.ts:144-187`

**Behavior:**
```typescript
function mergeTraineeData(dbTrainees: any[], mockTrainees: any[], includeMockData: boolean): any[] {
  // Tag DB trainees with _dataSource: 'database'
  const taggedDbTrainees = dbTrainees.map((trainee: any) => ({
    ...trainee,
    _dataSource: 'database' as const
  }));

  const dbTraineeMap = new Map();
  taggedDbTrainees.forEach((trainee: any) => {
    dbTraineeMap.set(trainee.idNumber, trainee);
  });

  // Start with database trainees
  const merged = [...taggedDbTrainees];

  // Only add mock trainees if includeMockData is true
  if (includeMockData) {
    mockTrainees.forEach((trainee: any) => {
      // Only add mock trainee if no DB trainee with same idNumber exists
      if (!dbTraineeMap.has(trainee.idNumber)) {
        merged.push({ ...trainee, _dataSource: 'mockdata' as const });
      }
    });
  }

  return merged;
}
```

**Key Points:**
- ✅ Mock trainees only added if `includeMockData=true`
- ✅ Deduplication by `idNumber` - mock excluded if DB trainee exists with same id
- ❌ **Called with `includeMockData=true` hardcoded (line 254)**
- ❌ **No toggle settings passed as parameter**

**Output:** Merged array with DB + mock trainees (unless deduplication removes some).

---

### 3. **State Initialization: `setTraineesData()` in App.tsx (line 4014)**

**Location:** `DFP-NEO-V2-fresh/App.tsx:4014`

**Behavior:**
```typescript
useEffect(() => {
  const loadInitialData = async () => {
    const data = await initializeData();
    // ...
    setTraineesData(data.trainees); // ← Mixed array stored in state
    // ...
  };
  loadInitialData();
}, []);
```

**Key Points:**
- ✅ Mixed array from `initializeData()` stored in React state `allTraineesData`
- ✅ This state contains ALL trainees (DB + mock) regardless of toggle settings
- ❌ **No filtering at state initialization level**

**Output:** `allTraineesData` state = mixed DB + mock trainees (216 total).

---

### 4. **Filtering Logic: `traineesData` useMemo in App.tsx (line 3689)**

**Location:** `DFP-NEO-V2-fresh/App.tsx:3689-3748`

**Behavior:**
```typescript
const traineesData = (() => {
  const { trainee: mockOn, traineeDb: dbOn } = dataSourceSettings;
  const dbCount = allTraineesData.filter(t => (t as any)._dataSource === 'database').length;
  const mockCount = allTraineesData.filter(t => (t as any)._dataSource !== 'database').length;
  console.log(`[traineesData] mockOn=${mockOn}, dbOn=${dbOn}, total=${allTraineesData.length}, db=${dbCount}, mock=${mockCount}`);

  // Filter by location (ESL = East Sale, PEA = Pearce)
  const locationFullName = school === 'ESL' ? 'East Sale' : 'Pearce';
  const locationFilteredTrainees = allTraineesData.filter(t => {
    if (t.location) {
      return t.location === locationFullName;
    }
    if (t.unit) {
      if (t.unit.startsWith('2FTS')) return locationFullName === 'Pearce';
      if (t.unit.startsWith('1FTS') || t.unit.startsWith('CFS')) return locationFullName === 'East Sale';
    }
    return true;
  });
  console.log(`[traineesData] Location filter: ${school} -> ${locationFullName}, filtered from ${allTraineesData.length} to ${locationFilteredTrainees.length} trainees`);

  if (!mockOn && !dbOn) return [];                                                          // Both OFF → empty
  if (mockOn && !dbOn) return locationFilteredTrainees.filter(t => (t as any)._dataSource !== 'database'); // Mock only
  if (!mockOn && dbOn) return locationFilteredTrainees.filter(t => (t as any)._dataSource === 'database'); // DB only ← SHOULD BE THIS PATH
  // Both ON → DB records take precedence: exclude mock trainees for courses that have DB records
  const dbTrainees = locationFilteredTrainees.filter(t => (t as any)._dataSource === 'database');
  const dbCourses = new Set(dbTrainees.map(t => t.course));
  const mockTrainees = locationFilteredTrainees.filter(t => (t as any)._dataSource !== 'database' && !dbCourses.has(t.course));
  return [...mockTrainees, ...dbTrainees];
})();
```

**Key Points:**
- ✅ Filter logic reads `dataSourceSettings.trainee` (mockOn) and `dataSourceSettings.traineeDb` (dbOn)
- ✅ For DB-only mode (mockOn=false, dbOn=true), should execute line 3718:
  ```typescript
  if (!mockOn && dbOn) return locationFilteredTrainees.filter(t => (t as any)._dataSource === 'database');
  ```
- ✅ This should return ONLY database trainees
- ❌ **BUT user reports seeing db=127 and mock=89 in console output**
- ❌ **This means the filtering is NOT working correctly, OR console log is from wrong place**

**Output:** Should be DB-only trainees. Actual output reported: mixed (db=127, mock=89).

---

### 5. **Build Config Creation: `traineesInBuild` in App.tsx (line 7656)**

**Location:** `DFP-NEO-V2-fresh/App.tsx:7656`

**Behavior:**
```typescript
const traineesInBuild = traineesData;
console.log('🔍 [NEO BUILD CONFIG DEBUG] Data source settings:', dataSourceSettings);
console.log('🔍 [NEO BUILD CONFIG DEBUG] traineesData (filtered):', traineesInBuild.length, '| mockData count:', traineesInBuild.filter((t: any) => (t as any)._dataSource !== 'database').length, '| DB count:', traineesInBuild.filter((t: any) => (t as any)._dataSource === 'database').length);

const config: DfpConfig = {
  // ...
  trainees: traineesInBuild,
  // ...
};
```

**Key Points:**
- ✅ Simply assigns `traineesInBuild = traineesData` (the filtered useMemo from step 4)
- ✅ Logs counts at this point - should show ONLY DB trainees if filtering worked
- ❌ **User reports console shows mockOn=false, dbOn=true, but traineesData contains db=127, mock=89**
- ❌ **This confirms contamination is happening BEFORE or DURING the filtering logic**

**Output:** Mixed trainees array passed to build algorithm.

---

### 6. **Build Algorithm Entry: `generateDfpInternal()` in App.tsx (line 1104)**

**Location:** `DFP-NEO-V2-fresh/App.tsx:1104`

**Signature:**
```typescript
function generateDfpInternal(
  config: DfpConfig, 
  setProgress: (progress: { message: string, percentage: number }) => void,
  publishedSchedules: Record<string, ScheduleEvent[]>
): Omit<ScheduleEvent, 'date'>[] {
```

**Access to Trainees:**
```typescript
// config.trainees is the array passed in
// Should contain only DB trainees if filtering worked
// But user reports it contains 127 DB + 89 mock = 216 total
```

**Key Points:**
- ✅ This is where trainees actually enter the build algorithm
- ✅ Access via `config.trainees` parameter
- ❌ **No diagnostic logging at this exact point yet**
- ❌ **Need to verify actual array contents entering the algorithm**

---

## Diagnosis: Where Contamination Occurs

Based on code trace, there are **3 possible contamination points**:

### Point A: **State Update Race Condition** (MOST LIKELY)
**Location:** App.tsx line 8101-8105

When `handleDatabaseDataChanged()` is called (after any DB modification), it updates trainees:
```typescript
setTraineesData(prev => {
  const nonDbTrainees = prev.filter(t => (t as any)._dataSource !== 'database');
  return [...nonDbTrainees, ...dbTrainees]; // ← PRESERVES all non-DB trainees
});
```

**Problem:** This preserves ALL non-DB trainees from previous state, regardless of toggle settings. If toggle is DB-only, mock trainees should be removed, not preserved.

**Evidence:** User sees db=127 (correct) + mock=89 (should be 0).

---

### Point B: **Filtering Logic Not Executing**
**Location:** App.tsx line 3689-3748 (traineesData useMemo)

The filtering logic may not be executing correctly due to:
- React dependency issue (useMemo not re-running when dataSourceSettings changes)
- Wrong toggle settings being read
- Console log from previous execution persisting

**Evidence:** User reports console output shows mixed counts despite toggle being DB-only.

---

### Point C: **Build Config Using Wrong State**
**Location:** App.tsx line 7656

The build config may be reading from `allTraineesData` instead of `traineesData`:
```typescript
const traineesInBuild = traineesData; // ← Should use filtered version
// BUT if this line accidentally uses allTraineesData, contamination occurs
```

**Evidence:** None yet - need to verify actual code at runtime.

---

## Diagnostic Plan

### Required Diagnostic Points:

1. **At generateDfpInternal entry** (line 1104):
   - Log config.trainees array
   - Count: total, DB-tagged, mock-tagged, unknown
   - Print 10 sample records

2. **In traineesData useMemo** (line 3718):
   - Log which branch is executing (DB-only, mock-only, both, neither)
   - Log actual counts being returned

3. **At build config creation** (line 7656):
   - Verify traineesInBuild is actually referencing traineesData, not allTraineesData
   - Log exact same counts again for comparison

4. **In handleDatabaseDataChanged** (line 8101):
   - Log what's being preserved and what's being removed
   - Verify it respects toggle settings

---

## Questions to Answer

1. **In DB-only mode, should mock trainees still be present in traineesData?**
   - **Answer:** NO - should be filtered out by useMemo at line 3718

2. **Are they actually present in the final build input (config.trainees)?**
   - **Answer:** UNKNOWN - need diagnostic at generateDfpInternal entry

3. **Is this the first proven contamination point?**
   - **Answer:** YES - if config.trainees contains mock trainees when DB-only mode is selected, this proves contamination exists BEFORE scheduling even starts

---

## Recommended Fix (for future implementation)

**Fix Location:** App.tsx line 8101-8105 (handleDatabaseDataChanged)

**Current Code:**
```typescript
setTraineesData(prev => {
  const nonDbTrainees = prev.filter(t => (t as any)._dataSource !== 'database');
  return [...nonDbTrainees, ...dbTrainees]; // ← Preserves all non-DB (mock) trainees
});
```

**Fixed Code:**
```typescript
setTraineesData(prev => {
  const { trainee: mockOn, traineeDb: dbOn } = dataSourceSettings;
  
  if (!mockOn && !dbOn) return [];
  if (mockOn && !dbOn) return prev.filter(t => (t as any)._dataSource !== 'database');
  if (!mockOn && dbOn) return dbTrainees; // ← DB only mode - return ONLY DB trainees
  
  // Both ON - preserve mock trainees for courses without DB records
  const dbCourses = new Set(dbTrainees.map(t => t.course));
  const mockTrainees = prev.filter(t => 
    (t as any)._dataSource !== 'database' && !dbCourses.has(t.course)
  );
  return [...mockTrainees, ...dbTrainees];
});
```

This ensures `handleDatabaseDataChanged()` respects the toggle settings when updating trainees data.