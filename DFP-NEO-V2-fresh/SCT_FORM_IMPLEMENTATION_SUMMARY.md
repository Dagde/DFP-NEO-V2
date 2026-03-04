# SCT FORM Logic Implementation Summary

## Overview
This document summarizes the implementation of the new SCT FORM logic that creates independent flight events with sequential callsign numbering.

## Changes Made

### 1. Type Definition Updates (`types.ts`)
- **Added**: `callsign?: string` field to `ScheduleEvent` interface
- **Purpose**: Store the formation callsign (e.g., MERL1, MERL2, MERL3) directly on each event

### 2. FlightDetailModal Component (`components/FlightDetailModal.tsx`)
- **Updated**: `handleSave` function to generate and store callsign for SCT FORM events
  - Callsign format: `${formationType}${index + 1}` (e.g., MERL1, MERL2, MERL3)
  - No spaces in callsign (MERL1 not "MERL 1")
  - `formationId` explicitly set to `undefined` to ensure events are independent
  
- **Updated**: `formationCallsign` display logic
  - Changed from `${formationType} ${index + 1}` to `${formationType}${index + 1}`
  - Removed space between base callsign and number

### 3. EventDetailModal Component (`components/EventDetailModal.tsx`)
- **Updated**: SCT FORM event creation to include:
  - `formationType`: Base callsign (MERL, VANG, COBR, HAWK)
  - `formationPosition`: Sequential position number (1, 2, 3, etc.)
  - `callsign`: Complete callsign without spaces (MERL1, MERL2, MERL3)
  - `formationId`: Set to `undefined` for independent events

### 4. FlightTile Component (`components/FlightTile.tsx`)
- **Updated**: Callsign display logic to prioritize stored callsign
  - First checks `event.callsign` (for SCT FORM events)
  - Falls back to pilot callsign if no stored callsign exists
  - Removed computed formation callsign logic

## Key Features

### Independent Events
- Each SCT FORM aircraft is a completely separate, independent flight event
- No `formationId` linking events together
- Each event can be:
  - Moved independently
  - Edited independently
  - Cancelled independently
  - Validated independently

### Callsign Handling
- User enters formation callsign base in Flight Details (e.g., MERL)
- System automatically generates sequential callsigns:
  - First event: MERL1
  - Second event: MERL2
  - Third event: MERL3
  - etc.
- Callsign is stored directly on the event (not computed)
- No spaces in callsign format

### Scheduling Placement
- All SCT FORM events created with:
  - Same start time
  - Same duration
  - Same timing rules as chosen event
- Events are automatically stacked vertically on resource lines
- Vertical stacking handled by existing `findAvailableResourceId` function with `alreadyAssigned` array

### Consistency
- Callsign numbering and stacked scheduling applied consistently across:
  - Initial event creation
  - Event editing
  - Event display on tiles
  - All views (Schedule, Next Day Build, etc.)

## Technical Implementation Details

### Resource Assignment
The existing `findAvailableResourceId` function in `App.tsx` handles vertical stacking:
1. When multiple events are saved together, they are processed sequentially
2. Each event is added to an `alreadyAssigned` array
3. Subsequent events check against both existing events and `alreadyAssigned` events
4. This ensures events are placed on consecutive resource lines (PC-21 1, PC-21 2, PC-21 3, etc.)

### Event Independence
By setting `formationId: undefined`, we ensure:
- No special formation-specific behavior
- Events behave exactly like any other normal flight event
- All standard validation, conflict detection, and controls apply
- Only formation-specific aspects are callsign numbering and coordinated creation timing

## Testing Checklist
- [ ] Create SCT FORM event with 2 aircraft - verify MERL1, MERL2 callsigns
- [ ] Create SCT FORM event with 3 aircraft - verify MERL1, MERL2, MERL3 callsigns
- [ ] Verify events appear stacked vertically on consecutive resource lines
- [ ] Move one event independently - verify others don't move
- [ ] Edit one event - verify others aren't affected
- [ ] Cancel one event - verify others remain
- [ ] Test conflict detection on individual events
- [ ] Verify callsigns display correctly on event tiles
- [ ] Test with different formation types (MERL, VANG, COBR, HAWK)
- [ ] Verify behavior consistent across Schedule and Next Day Build views

## Files Modified
1. `types.ts` - Added callsign field
2. `components/FlightDetailModal.tsx` - Updated handleSave and display logic
3. `components/EventDetailModal.tsx` - Updated SCT FORM event creation
4. `components/FlightTile.tsx` - Updated callsign display logic

## Backward Compatibility
- Existing events without callsign field will fall back to pilot callsign display
- No breaking changes to existing functionality
- Formation-related fields (formationType, formationPosition) retained for reference but not used for grouping