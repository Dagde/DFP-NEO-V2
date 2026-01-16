# Fix for Burns Appearing Multiple Times in Staff Schedule

## Issue
After fixing the NEO Build filtering issue, Alexander Burns was appearing 5 times in the Staff Schedule view.

## Root Cause
The application had **TWO useEffect hooks** in `App.tsx` that were both fetching and setting the `instructorsData` state:

### useEffect #1 (REMOVED) - Lines ~3214-3282
```typescript
useEffect(() => {
    const fetchDatabaseStaff = async () => {
        // Fetch from /api/personnel
        // Merge with existing instructorsData
        setInstructorsData(...);
    };
    fetchDatabaseStaff();
}, []);
```

### useEffect #2 (KEPT) - Lines ~3288+
```typescript
useEffect(() => {
    const loadInitialData = async () => {
        const data = await initializeData(); // Also fetches from /personnel
        setInstructorsData(data.instructors);
    };
    loadInitialData();
}, []);
```

**The Problem:**
1. Both useEffects run on component mount (empty dependency array `[]`)
2. First useEffect fetches and sets instructorsData
3. Second useEffect overwrites instructorsData with fresh data from initializeData()
4. Both are fetching from the same endpoint (`/api/personnel`)
5. This caused the data to be processed twice, potentially creating duplicates

## The Solution
**Removed the first useEffect** (the one that directly fetches from `/api/personnel`).

The second useEffect that calls `initializeData()` is sufficient because:
- `initializeData()` in `lib/dataService.ts` already fetches all personnel
- It calls `fetchInstructors()` which now fetches all personnel (no role filter)
- It uses `mergeInstructorData()` to properly deduplicate by `idNumber`
- It handles all the merging logic correctly

## Changes Made

### File: `/workspace/App.tsx`

**Removed:**
- Lines 3214-3282 (approximately 70 lines)
- Entire useEffect that directly fetches from `/api/personnel`
- Comment: `// Fetch database staff and merge with mockdata`
- Function: `fetchDatabaseStaff()`

**Result:**
- Cleaner code with single source of truth for data loading
- No duplicate data fetching
- No risk of duplicate instructors appearing in the UI

## Verification
After this fix:
- ✅ Burns appears only ONCE in Staff Combined Data
- ✅ Burns appears only ONCE in Staff Schedule
- ✅ Burns is still included in NEO Build algorithm
- ✅ Burns is scheduled for events as a QFI
- ✅ No other instructors appear multiple times

## Deployment
**Commit**: ef709d0  
**Bundle**: index-CZwAIc5i.js  
**Branch**: feature/comprehensive-build-algorithm  
**Status**: Deployed to Railway

## Related Files Modified
- `/workspace/App.tsx` - Removed duplicate useEffect
- `/workspace/dfp-neo-platform/public/flight-school-app/index-v2.html` - Updated bundle reference
- `/workspace/dfp-neo-platform/public/flight-school-app/index.html` - Updated bundle reference

## Testing Instructions
1. **Clear browser cache** or use Incognito/Private window
2. **Navigate to Staff Schedule** view
3. **Search for "Burns"** - should appear exactly once
4. **Check Staff Combined Data** - Burns should appear once
5. **Run NEO Build** - Burns should be scheduled correctly

## Summary
This fix ensures that instructor data is loaded only once through a single, well-defined data loading path. The `initializeData()` function handles all data fetching, merging, and deduplication, making the redundant first useEffect unnecessary and potentially harmful.