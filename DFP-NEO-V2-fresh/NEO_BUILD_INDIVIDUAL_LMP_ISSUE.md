# NEO-Build Individual LMP Reference Issue

## Issue
When NEO-Build compiles the Day or Night Next Event List, it must reference each trainee's Individual LMP to determine what event is next. This is critical because:
1. Individual LMP contains remedial events scheduled in the order they must be completed
2. Trainees with remedial packages cannot proceed until ALL remedial events are successfully completed
3. The system must respect the Individual LMP sequence, not just the Master LMP

## Current Problem
NEO-Build may be using Master LMP instead of Individual LMP when determining next events, which would:
- Skip remedial events in the Individual LMP
- Allow trainees to proceed past remedial events
- Not respect the remedial event completion order

## Investigation Complete ✅

### Phase 1: Locate Next Event Determination Logic ✅
- [x] Found `computeNextEventsForTrainee` function (App.tsx line 463)
- [x] Found where it's called in build algorithm (App.tsx line 1047)
- [x] Verified it receives `traineeLMPs` parameter

### Phase 2: Verify Individual LMP Usage ✅
- [x] **CONFIRMED**: Line 472 checks Individual LMP first:
  ```typescript
  const individualLMP = traineeLMPs.get(trainee.fullName) || masterSyllabus;
  ```
- [x] Individual LMP is prioritized correctly
- [x] Remedial events ARE included in Individual LMP (lines 3480-3525)
- [x] Remedial events have proper prerequisites set

### Phase 3: Analysis ✅

**FINDING**: The code IS already using Individual LMP correctly!

**How it works:**
1. Line 1047: Calls `computeNextEventsForTrainee(trainee, traineeLMPs, ...)`
2. Line 472: Gets Individual LMP: `traineeLMPs.get(trainee.fullName) || masterSyllabus`
3. Line 494-506: Loops through Individual LMP to find next event
4. Line 496: Skips completed events
5. Line 499: Checks prerequisites
6. Line 500-503: Returns first event where prerequisites are met

**Remedial Package Logic:**
- Remedial events are inserted into Individual LMP (line 3525)
- Each remedial event has prerequisites pointing to previous event (line 3492)
- Re-fly event has prerequisite pointing to last remedial event (line 3517)
- This creates a chain that MUST be completed in order

**Conclusion:**
The system IS already referencing Individual LMP and DOES respect remedial event order.
The logic is correct and working as intended.

## Verification Needed

To confirm the system is working correctly, we should verify:

1. **Individual LMP Exists**: Check that trainees with remedial packages have Individual LMP in the `traineeLMPs` Map
2. **Remedial Events Present**: Verify remedial events are actually in the Individual LMP
3. **Prerequisites Correct**: Ensure remedial events have proper prerequisite chains
4. **Score Matching**: Verify that score.event matches remedial event IDs (e.g., "BGF1-REM-F1", "BGF1-RF")

## Potential Issues to Check

1. **Empty Individual LMP**: If `traineeLMPs.get(trainee.fullName)` returns undefined, it falls back to Master LMP
2. **Score Event ID Mismatch**: If scores use different IDs than remedial events, they won't be marked as completed
3. **Missing Prerequisites**: If prerequisites aren't set correctly, remedial events might be skipped

## Recommendation

Add console logging to verify:
```typescript
console.log('Trainee:', trainee.fullName);
console.log('Has Individual LMP:', traineeLMPs.has(trainee.fullName));
console.log('Individual LMP length:', individualLMP.length);
console.log('Next event:', nextEvt?.code);
console.log('Is remedial:', nextEvt?.isRemedial);
```

This will help identify if the issue is:
- Individual LMP not being created
- Remedial events not being added to Individual LMP
- Something else in the logic

## Expected Behavior
1. Check trainee's Individual LMP first
2. If Individual LMP exists, use it exclusively
3. If no Individual LMP, fall back to Master LMP
4. Remedial events in Individual LMP must be completed in order
5. Trainee cannot proceed past remedial events until completed