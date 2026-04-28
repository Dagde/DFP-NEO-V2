# Audit System - Debounced Logging (3-Second Delay)

## Overview
Implemented debounced audit logging to prevent the audit log from being flooded with intermediate changes. The system now waits 3 seconds after the last change before recording it to the audit trail.

## Implementation Date
December 29, 2024

## Problem Solved
**Before**: Every mouse click, drag movement, or slider adjustment was immediately logged, creating hundreds of audit entries for a single action.

**After**: The system waits 3 seconds after the last change, then logs only the final state with before → after values.

## How It Works

### Debounce Utility
Created `utils/auditDebounce.ts` with:
- `debouncedAuditLog()` - Waits 3 seconds after last change before logging
- `cancelPendingAudit()` - Cancel a pending audit (useful for cleanup)
- `flushPendingAudits()` - Immediately log all pending audits (for critical actions)

### Implementation Pattern
```typescript
// Instead of immediate logging:
logAudit("Program Schedule", "Edit", "Moved event", "Time: 8 → 10");

// Use debounced logging:
debouncedAuditLog(
  `schedule-move-${eventId}`,  // Unique key
  {
    page: "Program Schedule",
    action: "Edit",
    description: "Moved event",
    changes: "Time: 8 → 10"
  },
  logAudit
);
```

## What's Debounced

### ✅ Tile Drag/Move Operations
**DFP (Program Schedule)**:
- Dragging tiles horizontally (time changes)
- Dragging tiles vertically (resource changes)
- Dragging tiles diagonally (both changes)
- Waits 3 seconds after tile stops moving before logging

**Next Day Build**:
- Same debouncing for all tile movements
- Records final position only

### Example Behavior

**User Action**: Drags a tile from 8:00 to 10:00, pausing at 8:30 and 9:00 along the way

**Without Debouncing** (old behavior):
```
08:00:01 - Moved event, Time: 8 → 8.5
08:00:02 - Moved event, Time: 8.5 → 9
08:00:03 - Moved event, Time: 9 → 9.5
08:00:04 - Moved event, Time: 9.5 → 10
```

**With Debouncing** (new behavior):
```
08:00:07 - Moved event, Time: 8 → 10
```
(Single entry logged 3 seconds after the last movement)

## Benefits

1. **Cleaner Audit Log**: Only final changes recorded, not intermediate states
2. **Better Performance**: Reduces database/storage writes
3. **More Meaningful**: Shows actual intent, not every mouse movement
4. **Easier to Review**: Audit log is concise and actionable
5. **Accurate Tracking**: Still captures the complete before → after change

## Technical Details

### Unique Keys
Each debounced action uses a unique key to track pending audits:
- Tile movements: `schedule-move-${eventId}` or `ndb-move-${eventId}`
- This allows multiple tiles to be moved simultaneously with independent timers

### Timer Management
- Each change resets the 3-second timer
- Only the last change in a series gets logged
- Timers are automatically cleaned up after logging

### Memory Management
- Pending audits are stored in a Map
- Automatically removed after logging
- No memory leaks from abandoned timers

## Future Enhancements

### Priorities Page (Planned)
The same debouncing should be applied to:
- Course priority drag-and-drop
- Course percentage adjustments (+/- clicks)
- Flying time selectors
- Turnaround time selectors
- All numeric inputs

### Modal Edits (Not Needed)
Modal-based edits (changing instructor, LMP event, area, etc.) don't need debouncing because:
- User makes all changes in the modal
- Only one "Save" action occurs
- Already captures complete before → after state

## Files Modified

1. **utils/auditDebounce.ts** - New debounce utility
2. **App.tsx** - Updated handleScheduleUpdate and handleNextDayScheduleUpdate to use debounced logging

## Testing

### Test Tile Movement Debouncing

1. **Open DFP or Next Day Build**
2. **Drag a tile multiple times**:
   - Drag it to 9:00
   - Wait 1 second
   - Drag it to 10:00
   - Wait 1 second
   - Drag it to 11:00
   - Stop and wait 3 seconds
3. **Check audit log**:
   - Should show ONE entry
   - Should show original time → final time (e.g., "8 → 11")
   - Should NOT show intermediate positions

### Test Multiple Tiles

1. **Drag multiple tiles quickly**
2. **Each tile should have its own 3-second timer**
3. **Each tile logs independently after 3 seconds**

## Commit Information

**Branch**: main
**Commit Message**: "Implement 3-second debounced audit logging for tile movements"