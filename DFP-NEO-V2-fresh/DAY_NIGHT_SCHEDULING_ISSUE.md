# Day/Night Scheduling Violation Analysis

## Issue
Staff and trainees are being scheduled for BOTH day AND night events, violating the basic rule that personnel should only be scheduled for either day OR night events, not both.

## Investigation Findings

### Phase 1: Day/Night Definition ✅
- [x] **Night Flying Window**: `commenceNightFlying` (18:30 / 18.5) to `ceaseNightFlying` (23:30 / 23.5)
- [x] **Day Flying**: Any event OUTSIDE the night window
- [x] **Night Events**: BNF (Basic Night Flying) events scheduled within the night window
- [x] **Location**: App.tsx lines 2689-2690

### Phase 2: Build Algorithm Logic ✅
- [x] **Function**: `isPersonScheduledForNightEvents()` (App.tsx line 985)
- [x] **Purpose**: Checks if a person is scheduled for night events
- [x] **Logic**: 
  - Checks if BNF events are scheduled (nextEventLists.bnf.length >= 2)
  - Checks if person has events in night window (commenceNightFlying to ceaseNightFlying)
  - Checks intendedNightStaff set
- [x] **Enforcement**: Used to filter instructors from day events if they're scheduled for night

### Phase 3: Validation Logic ❌
- [x] **FOUND THE PROBLEM**: `detectConflictsForEvent()` function (App.tsx line 3151)
- [x] **Missing Check**: NO validation for day/night separation conflicts
- [x] **Current Checks**:
  1. Turnaround conflicts
  2. Resource conflicts (same resource, overlapping time)
  3. Personnel conflicts (same person, overlapping booking windows)
- [x] **MISSING**: Day/Night separation check (person scheduled for both day AND night)

### Phase 4: Manual Scheduling ❌
- [ ] FlightDetailModal has NO day/night validation
- [ ] No warnings when assigning to wrong period
- [ ] No UI indication of day/night status

## ROOT CAUSE IDENTIFIED

The `detectConflictsForEvent()` function is missing a check for day/night separation. It only checks:
1. Turnaround time violations
2. Resource double-booking
3. Personnel double-booking (overlapping times)

But it does NOT check if a person is being scheduled for BOTH day AND night events.

## The Fix Implemented ✅

Added day/night separation validation to `detectConflictsForEvent()`:

### Changes Made:
1. **Updated return type** to include 'day-night' conflict type
2. **Added day/night separation check**:
   - Gets personnel from target event
   - Checks if target event is in night window (commenceNightFlying to ceaseNightFlying)
   - For each other event with common personnel:
     - Checks if that event is in night window
     - If one is day and one is night → CONFLICT
3. **Returns conflict** with:
   - conflictType: 'day-night'
   - conflictedPersonnel: name of person scheduled for both
   - conflictingEventId: ID of the conflicting event

### How It Works:
- When validating events, system now checks if personnel are scheduled for both day AND night
- If a person has a day event (before 18:30 or after 23:30) AND a night event (18:30-23:30), it's flagged as a conflict
- The conflict will be highlighted in the UI when validation is enabled
- Prevents manual scheduling violations

### Files Modified:
- App.tsx: detectConflictsForEvent function (added day-night separation check)