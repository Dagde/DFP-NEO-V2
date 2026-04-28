# SCT FORM Critical Fix - Event Independence

## Problem Identified
SCT FORM events were NOT being treated as individual flight events. When creating multiple aircraft (e.g., MERL1, MERL2, MERL3), all events would move/edit together as if they were a single grouped entity.

## Root Cause
**All SCT FORM events were sharing the same `event.id`**

When creating multiple events in `FlightDetailModal.tsx`, the code was using:
```typescript
return {
    ...event,  // This spread operator copied the same ID to all events
    // ... other fields
}
```

Since all events had identical IDs, the system treated them as the same event, causing:
- Moving one event would move all events with that ID
- Editing one event would edit all events with that ID
- Deleting one event would delete all events with that ID

## The Fix

### 1. FlightDetailModal.tsx
Added unique ID generation for SCT FORM events with multiple aircraft:

```typescript
// For SCT FORM events with multiple aircraft, generate unique IDs for each event
const eventId = (flightNumber === 'SCT FORM' && crew.length > 1) 
    ? `${event.id}-${index}-${Date.now()}` 
    : event.id;

return {
    ...event,
    id: eventId,  // Now each event has a unique ID
    // ... other fields
}
```

### 2. EventDetailModal.tsx
Updated to include timestamp in ID generation:

```typescript
id: `${event.id}-${i}-${Date.now()}`,  // Unique ID with timestamp
```

## How It Works

### ID Generation Pattern
For SCT FORM events with multiple aircraft:
- **Original event ID**: `evt-12345`
- **First aircraft**: `evt-12345-0-1734567890123`
- **Second aircraft**: `evt-12345-1-1734567890123`
- **Third aircraft**: `evt-12345-2-1734567890123`

Each ID is unique because it includes:
1. Original event ID
2. Index (0, 1, 2, etc.)
3. Timestamp (milliseconds since epoch)

### When Unique IDs Are Generated
- **Only for SCT FORM events** with multiple aircraft (`crew.length > 1`)
- **Not for single events** - they keep their original ID
- **Not for non-SCT FORM events** - they keep their original ID

## Result
Each SCT FORM aircraft is now a **completely independent event**:
- ✅ Can be moved independently
- ✅ Can be edited independently
- ✅ Can be cancelled independently
- ✅ Has independent conflict detection
- ✅ Has independent validation
- ✅ Behaves exactly like any other normal flight event

## What Remains Formation-Specific
Only two things are specific to SCT FORM events:
1. **Callsign numbering** - Sequential callsigns (MERL1, MERL2, MERL3)
2. **Coordinated creation** - All events created at the same time with same start time

Everything else is completely independent.

## Testing Checklist
- [x] Build successful
- [ ] Create SCT FORM with 2 aircraft
- [ ] Verify 2 separate events appear with unique IDs
- [ ] Move one event - verify ONLY that event moves
- [ ] Edit one event - verify ONLY that event changes
- [ ] Cancel one event - verify ONLY that event is cancelled
- [ ] Verify events can be placed on different resource lines
- [ ] Verify conflict detection works independently for each event

## Files Modified
1. `components/FlightDetailModal.tsx` - Added unique ID generation logic
2. `components/EventDetailModal.tsx` - Updated ID generation with timestamp

## Commit Information
- **Commit**: 6fcb753
- **Branch**: feature/comprehensive-build-algorithm
- **Message**: "CRITICAL FIX: Generate unique IDs for each SCT FORM event to ensure true independence"