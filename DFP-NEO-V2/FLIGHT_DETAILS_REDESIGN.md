# Flight Details Window Redesign - Implementation Plan

## Overview
Redesigning the Flight Details modal to display fields progressively based on event type selection.

## New Structure

### Header (Always Visible)
- Delete button (right side)
- "Add Deployment" checkbox (right side, only for flight events)

### Event Type Selection (New - Always Visible After Header)
Four mutually exclusive buttons:
1. **LMP Event** - Standard training events from Master LMP
2. **LMP Currency** - Currency events (appended with "-CUR")
3. **SCT** - Standards Check Training events
4. **Staff CAT** - Staff Continuation and Advancement Training

### Progressive Field Display

#### Common Fields (All Event Types)
- Syllabus Item (source varies by type)
- Area
- Start Time (24-hour format without colon)
- Duration

#### Type-Specific Fields

**LMP Event:**
- Type (Dual/Solo from Master LMP)
- Instructor
- Trainee OR Group

**LMP Currency:**
- Type (Dual/Solo from Master LMP)
- Instructor (staff only, grouped by Unit)
- Trainee OR Group
- Special handling: Appends "-CUR" to event name in Individual LMP

**SCT Event:**
- Type (default Solo)
- Instructor (staff only, grouped by Unit)
- Crew (if Dual, staff only, grouped by Unit)

**Staff CAT:**
- Type (Dual/Solo from Staff CAT LMP)
- Instructor (staff only, grouped by Unit)
- Crew (if Dual, staff only, grouped by Unit)

## Implementation Steps

1. Add event category state (`eventCategory`)
2. Create event type selector buttons
3. Implement progressive field rendering
4. Update syllabus item filtering based on category
5. Update instructor filtering (staff only for certain types)
6. Handle time format (remove colons)
7. Add CUR suffix logic for currency events

## Data Sources

- **LMP Event**: `syllabusDetails` filtered by Master LMP
- **LMP Currency**: `syllabusDetails` filtered by Master LMP
- **SCT**: `sctEvents` from Settings
- **Staff CAT**: `syllabusDetails` filtered by Staff CAT LMP

## UI Changes

### Before
```
[Header with Delete and Add Deployment]
[All fields visible at once]
```

### After
```
[Header with Delete and Add Deployment]
[Event Type Selector: LMP Event | LMP Currency | SCT | Staff CAT]
[Progressive fields based on selection]
```

## Files to Modify

1. **components/FlightDetailModal.tsx** - Main redesign
2. **App.tsx** - Pass sctEvents prop to modal
3. **types.ts** - Add eventCategory field if needed

---

**Status**: Planning Complete
**Next**: Implementation