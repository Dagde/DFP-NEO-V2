# TWR DI Event Display Fixes

## Summary
Fixed two issues related to TWR DI event category handling and Add Flight Tile modal header positioning.

## Changes Made

### 1. TWR DI Event Display in FlightTile

**Files Modified:**
- `components/FlightTile.tsx`
- `DFP-NEO-V2-fresh/components/FlightTile.tsx`

**Changes:**
1. Added check for TWR DI events: `const isTwrDiEvent = event.eventCategory === 'twr_di';`
2. Updated three instances where `event.flightNumber` is displayed to show "TWR DI" instead when `isTwrDiEvent` is true:
   - Top right event display (duration + event name)
   - Co-pilot/student name display (bottom of tile)

**Code Changes:**
```typescript
// Added this check
const isTwrDiEvent = event.eventCategory === 'twr_di';

// Updated display logic (3 locations)
// Before: {event.flightNumber}
// After: {isTwrDiEvent ? 'TWR DI' : event.flightNumber}

// For student/co-pilot name display
// Before: {typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig}</> : studentDisplay}
// After: {isTwrDiEvent ? 'TWR DI' : typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig}</> : studentDisplay}
```

### 2. TWR DI Event Display in AddFlightTileModal

**Files Modified:**
- `components/AddFlightTileModal.tsx`
- `DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx`

**Changes:**

#### a. Updated `eventContent()` function
```typescript
const eventContent = () => {
  const displayEvent = eventCategory === 'twr_di' ? 'TWR DI' : flightNumber;
  return (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={58}>
        <span style={{ fontSize: 18, color: displayEvent ? WHITE_FULL : WHITE_GHOST, lineHeight: 1 }}>
          {displayEvent || 'EVENT'}
        </span>
      </Oval>
    </div>
  );
};
```

**Purpose:** Displays "TWR DI" in the top-right event field instead of the flight number when event category is 'twr_di'.

#### b. Updated `coPilotContent()` function
```typescript
const coPilotContent = () => {
  if (eventCategory === 'twr_di') {
    return <span style={{ fontSize: 22, color: WHITE_DIM, lineHeight: 1.25 }}>TWR DI</span>;
  }
  return flightType === 'Dual' ? (
    <PersonDropdown ... />
  ) : (
    <span>SOLO</span>
  );
};
```

**Purpose:** Displays "TWR DI" in the bottom co-pilot field instead of showing the PersonDropdown or SOLO label when event category is 'twr_di'.

### 3. Add Flight Tile Header Positioning Fix

**Files Modified:**
- `components/AddFlightTileModal.tsx`
- `DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx`

**Changes:**
```typescript
// Before
<div style={{ width: '90vw', maxWidth: 720, maxHeight: '92vh' }} ...>

// After
<div style={{ width: '90vw', maxWidth: 720, maxHeight: '95vh' }} ...>

// Content container
<div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ minHeight: 0 }}>
```

**Purpose:**
- Increased modal max height from `92vh` to `95vh` to provide more vertical space
- Added `style={{ minHeight: 0 }}` to content container to ensure proper flexbox behavior
- This ensures the "Add Flight Tile" header is fully visible and not cut off

## Behavior Changes

### For TWR DI Events:
1. **Event Type Display** (top-right): Shows "TWR DI" instead of flight number
2. **Co-pilot Display** (bottom): Shows "TWR DI" instead of student name or SOLO label

### For All Other Events:
- No changes in behavior
- Flight tiles continue to display normally

### Add Flight Tile Modal:
- Header is now fully visible at the top of the modal
- Modal is slightly taller (95vh vs 92vh) to accommodate content
- Better scrolling behavior with minHeight: 0 on content container

## Testing Recommendations

1. **TWR DI Event Display Test:**
   - Add a flight tile with event category set to 'twr_di'
   - Verify top-right shows "TWR DI"
   - Verify bottom shows "TWR DI"
   - Verify both locations ignore flight number and student/co-pilot values

2. **Regular Event Display Test:**
   - Add regular flight tiles (other categories)
   - Verify they display normally (flight number in top-right, student name at bottom)
   - Verify SOLO/DUAL buttons still work correctly

3. **Modal Header Test:**
   - Open Add Flight Tile modal
   - Verify "Add Flight Tile" header is fully visible at the top
   - Verify no content overlaps the header
   - Verify scrolling works properly if content exceeds viewport

## Files Updated

1. `components/FlightTile.tsx`
2. `components/AddFlightTileModal.tsx`
3. `DFP-NEO-V2-fresh/components/FlightTile.tsx`
4. `DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx`

All changes are backward compatible and do not affect existing functionality for non-TWR DI events.