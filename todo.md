# Aircraft Availability Average Fix Tasks

## Issues to Fix

### Issue 1: Wrong Average Calculation (Server-side)
**Current behavior**: Divides weighted sum by total window duration (e.g., 540 minutes for 08:00-17:00)
**Correct behavior**: Should divide by **elapsed time in the flying window**

Example:
- If it's 13:00 (1 PM) and window started at 08:00
- Elapsed time = 5 hours = 300 minutes
- Average = weightedSum / 300, NOT weightedSum / 540

### Issue 2: After-Window Check Should Use Vertical Time Line
**Current behavior**: Uses `new Date()` when the event is sent to check if after flying window
**Correct behavior**: Should use the **vertical time line value** from the Daily Schedule, which represents the current local time displayed in the UI

The vertical time line is calculated from `new Date()` in the frontend, but the issue is:
- When user changes availability at night (e.g., 11 PM), the event is sent with that timestamp
- The check should compare the **event's time** against the flying window end
- If the event time is after window end, skip recalculation

### Issue 3: Day Flying Window Only
**Requirement**: Only look at Day flying window for average calculation, ignore Night flying window

## Implementation Plan

### Step 1: Fix Server-Side Average Calculation
- Modify `recalculateDailySummary` to accept a "current time" parameter
- Calculate elapsed time = min(current time, window end) - window start
- Divide weighted sum by elapsed time, not total window duration

### Step 2: Use Event Timestamp for After-Window Check
- The event already has a `timestamp` field
- Use this timestamp (in local time) to compare against flying window end
- If event timestamp is after window end, skip recalculation

### Step 3: Ensure Day Flying Window Only
- Verify that `flyingWindowStart` and `flyingWindowEnd` refer to Day flying window
- These should already be `flyingStartTime` and `flyingEndTime` from the app

## Code Locations

- **Server calculation**: `/workspace/DFP-NEO-V2-fresh/server.js` - `recalculateDailySummary` function (lines 936-1100)
- **Frontend utility**: `/workspace/DFP-NEO-V2-fresh/utils/aircraftAvailabilityUtils.ts` - `calculateDailyAverageAvailability` (already has correct logic)
- **After-window check**: `/workspace/DFP-NEO-V2-fresh/server.js` - POST handler (lines 844-855)

## Tasks
- [ ] Fix server-side average calculation to use elapsed time
- [ ] Fix after-window check to use event timestamp correctly
- [ ] Test the fixes