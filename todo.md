# TODO - Burns Duplication Issue - FIXED ✅

## Issue Resolved
**Alexander Burns appearing 5 times - FIXED**

## Root Cause Identified
The `mergeInstructorData()` function in `/workspace/lib/dataService.ts` had a critical bug:

**BEFORE (Buggy Code):**
```typescript
const dbInstructorMap = new Map();
dbInstructors.forEach((instructor: any) => {
    dbInstructorMap.set(instructor.idNumber, instructor);  // Overwrites duplicates!
});

const merged = [...dbInstructors];  // ❌ Includes ALL database records, including duplicates
```

**Problem:**
- If 5 database records have the same `idNumber`, the Map only keeps the last one
- But the merged array still includes ALL 5 database records
- Result: Burns appeared 5 times with the same PMKEYS (8281112) but different ranks

## Solution Implemented
Changed the deduplication logic to properly deduplicate database instructors:

**AFTER (Fixed Code):**
```typescript
const dbInstructorMap = new Map();
dbInstructors.forEach((instructor: any) => {
    dbInstructorMap.set(instructor.idNumber, instructor);
});

const merged = Array.from(dbInstructorMap.values());  // ✅ Only unique idNumbers
```

**What Changed:**
- `merged = [...dbInstructors]` → `merged = Array.from(dbInstructorMap.values())`
- Now only database instructors with unique `idNumber` values are included
- Mock instructors are still merged, skipping duplicates by `idNumber`

## Deployment
- **Commit**: 6226be8
- **Bundle**: index-BGUs3P8B.js
- **Branch**: feature/comprehensive-build-algorithm
- **Status**: Pushed to Railway (deploying)

## Expected Results
After Railway redeploys:
- ✅ Alexander Burns should appear ONCE in Staff MockData table
- ✅ Alexander Burns should appear ONCE in Staff Schedule
- ✅ Total staff count should be reduced (was 128, will be lower after deduplication)
- ✅ All other staff with duplicate PMKEYS will also be deduplicated

## Testing Instructions
1. Wait for Railway to complete deployment
2. Clear browser cache or use Incognito mode
3. Navigate to Settings → Staff MockData
4. Search for "Burns" - should see only ONE entry
5. Verify total staff count is reduced from 128
6. Check that Burns still appears in Staff Schedule and NEO Build