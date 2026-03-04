# Alexander Burns Not Being Scheduled - Root Cause Fix

## Problem Statement
Alexander Burns (database staff) appeared in the Staff Combined Data table but was NOT being scheduled in the NEO Build algorithm, even though he displayed as a QFI with `role='QFI'` and `isQFI=true`.

## Root Cause Analysis

### The Issue
The application has **two separate data fetching operations** in `App.tsx` that were conflicting:

1. **First useEffect** (lines ~3243-3279):
   - Directly fetches from `/api/personnel` endpoint
   - Fetches ALL personnel without filtering
   - **Result**: Burns IS included in this data

2. **Second useEffect** (lines 3298-3309):
   - Calls `initializeData()` from `lib/dataService.ts`
   - `initializeData()` calls `fetchInstructors()` from `lib/api.ts`
   - `fetchInstructors()` uses `/personnel?role=INSTRUCTOR` query
   - **Result**: Burns is FILTERED OUT because his role is 'OFI', not 'INSTRUCTOR'

The second useEffect **overwrites** the instructorsData state from the first useEffect, losing Burns in the process.

### Why Burns Was Filtered
- Burns has `role='OFI'` in the database
- `isQFI=true` (boolean flag indicating he's a Qualified Flying Instructor)
- The API query `/personnel?role=INSTRUCTOR` only returns personnel with `role='INSTRUCTOR'`
- This excluded Burns and other OFIs, SIM IPs, etc.

## The Fix

### Changed File: `/workspace/lib/api.ts`

**Before:**
```typescript
export async function fetchInstructors(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel?role=INSTRUCTOR');
  if (result.success && result.data?.personnel) {
    return result.data.personnel;
  }
  return [];
}
```

**After:**
```typescript
export async function fetchInstructors(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel');
  if (result.success && result.data?.personnel) {
    return result.data.personnel;
  }
  return [];
}
```

### Why This Works
- Now fetches ALL personnel from the database
- The `mergeInstructorData()` function in `lib/dataService.ts` handles the merging logic
- Appropriate filtering happens during the merge process based on actual instructor attributes
- All instructor types (QFIs, OFIs, SIM IPs, etc.) are now included

## Deployment

**Commit**: dac449a  
**Bundle**: index-CFQyEHFp.js  
**Branch**: feature/comprehensive-build-algorithm

## Testing Instructions

1. **Clear browser cache** or use Incognito/Private window
2. **Navigate to the application**
3. **Go to Settings → Staff Combined Data** - verify Burns still appears
4. **Run NEO Build** for 2026-01-18 or any future date
5. **Check console logs** for:
   - Instructor count should be > 41 (previous count without Burns)
   - Burns should appear in the instructor list
6. **Verify build output** - Burns should be scheduled for events

## Expected Results

- ✅ Burns appears in Staff Combined Data (already working)
- ✅ Burns appears in NEO Build instructor configuration
- ✅ Burns is scheduled for flight events as a QFI
- ✅ All other OFIs, SIM IPs, etc. are also properly included

## Impact

This fix ensures that ALL instructor types are included in the NEO Build algorithm:
- QFIs (Qualified Flying Instructors)
- OFIs (Operational Flying Instructors)
- SIM IPs (Simulator Instructors)
- Any other instructor roles with appropriate qualifications

The fix is minimal and surgical - it only changes the API query to fetch all personnel, letting the existing merge logic handle filtering appropriately.