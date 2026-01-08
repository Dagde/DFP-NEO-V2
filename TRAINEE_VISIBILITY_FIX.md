# Trainee Visibility Fix

## Problem
Users reported that trainees were not visible in the flight school app, even though instructors were showing.

## Root Cause
The `lib/api.ts` file was using TypeScript types `TraineeRank` and `SeatConfig` in the `convertPersonnelToTrainee` function, but these types were never imported from `../types`. This caused a **temporal dead zone error**:

```
ReferenceError: Cannot access 'u' before initialization
    at rO (dataService.ts:84:18)
```

The error occurred because:
1. `convertPersonnelToTrainee` referenced `TraineeRank` type
2. `TraineeRank` was not imported from `../types`
3. When the code was compiled/bundled, the type reference couldn't be resolved
4. This caused a runtime error when trying to fetch trainees

## Solution
Updated the import statement in `/workspace/lib/api.ts` to include the missing types:

### Before
```typescript
import { Instructor, Trainee, Aircraft, ScheduleEvent } from '../types';
```

### After
```typescript
import { Instructor, Trainee, Aircraft, ScheduleEvent, TraineeRank, SeatConfig } from '../types';
```

## Changes Made
- **File**: `/workspace/lib/api.ts`
- **Line**: 1
- **Change**: Added `TraineeRank` and `SeatConfig` to imports

## Verification
After the fix:
1. Build completed successfully ✅
2. No TypeScript errors ✅
3. App deployed to production ✅
4. Railway deployment triggered ✅

## Testing Instructions
Once Railway deployment completes (2-5 minutes):

1. Open https://dfp-neo.com/flight-school-app/
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Navigate to Course Roster view
4. Verify trainees are visible (should show 117 trainees)
5. Check browser console for "✅ Data loaded from API" with trainees count
6. Test switching between ESL and PEA schools
7. Test NEO build feature

## Expected Results
- **Instructors**: 82 (74 QFI + 8 SIM IP)
- **Trainees**: 117
- **Total**: 199 personnel records

## Git Commit
- **Commit**: `255cd99`
- **Message**: "Fix trainee visibility - add missing type imports (TraineeRank, SeatConfig)"
- **Branch**: `feature/comprehensive-build-algorithm`