# Audit System - 3-Second Debouncing Implementation

## Overview
Implemented debouncing for audit logging to prevent flooding the audit log with intermediate changes. The system now waits 3 seconds after the last change before recording it to the audit trail.

## Implementation Date
December 29, 2024

## What's Debounced

### ✅ Tile Movement (DFP & NDB)
**Status**: IMPLEMENTED
- Dragging tiles horizontally (time changes)
- Dragging tiles vertically (resource changes)
- Dragging tiles diagonally (both changes)
- **Behavior**: Records only the final position after user stops dragging for 3 seconds

**Example**:
- User drags tile from Time 8 → 9 → 10 → 11
- Only logs: "Time: 8 → 11" (after 3 seconds of no movement)

### ⏳ Priorities Page Changes
**Status**: PENDING
- Course priority reordering
- Course percentage adjustments
- Flying window settings
- Build configuration
- Turnaround times

**Note**: These will be implemented in a future update to avoid file corruption issues.

## Technical Implementation

### Debounce Utility
Created `utils/auditDebounce.ts` with:
- `debouncedAuditLog()` - Main debouncing function
- `cancelPendingAudit()` - Cancel specific pending audit
- `flushPendingAudits()` - Flush all pending audits immediately

### How It Works

```typescript
// Instead of immediate logging:
logAudit("Program Schedule", "Edit", description, changes);

// Now uses debounced logging:
debouncedAuditLog(
  `schedule-move-${eventId}`,  // Unique key
  {
    page: "Program Schedule",
    action: "Edit",
    description: description,
    changes: changes
  },
  logAudit  // Actual logging function
);
```

### Key Features

1. **3-Second Delay**: Waits 3 seconds after last change
2. **Unique Keys**: Each change type has a unique key to track separately
3. **Timer Reset**: Each new change resets the timer
4. **Final Value**: Only logs the final value after user stops making changes

## Benefits

### Before Debouncing
```
08:00:01 - Moved flight event, Time: 8 → 9
08:00:02 - Moved flight event, Time: 9 → 10
08:00:03 - Moved flight event, Time: 10 → 11
08:00:04 - Moved flight event, Time: 11 → 12
```
**Result**: 4 audit entries for one action

### After Debouncing
```
08:00:07 - Moved flight event, Time: 8 → 12
```
**Result**: 1 audit entry with start and end values

## User Experience

### Tile Movement
1. User drags a tile
2. Tile moves in real-time (no delay)
3. User releases the tile
4. System waits 3 seconds
5. If no further movement, logs the change
6. If user moves it again within 3 seconds, timer resets

### What Users See
- **Immediate**: Tile moves on screen instantly
- **Delayed**: Audit log entry appears 3 seconds after final position
- **Clean**: Only one audit entry per drag session

## Implementation Status

### Completed ✅
- [x] Created debounce utility
- [x] Implemented for DFP tile movement
- [x] Implemented for NDB tile movement
- [x] Tested and verified working

### Pending ⏳
- [ ] Priorities page course priority reordering
- [ ] Priorities page percentage adjustments
- [ ] Priorities page flying window settings
- [ ] Priorities page build configuration
- [ ] Priorities page turnaround times
- [ ] Event modal field changes (if needed)

## Testing

### Test Tile Movement Debouncing

1. **Open DFP or Next Day Build**
2. **Drag a tile multiple times quickly**:
   - Drag to time 9
   - Drag to time 10
   - Drag to time 11
   - Stop dragging
3. **Wait 3 seconds**
4. **Check audit log**
5. **Verify**: Only ONE entry showing Time: 8 → 11

### Expected Behavior
- ✅ Tile moves immediately on screen
- ✅ No lag or delay in UI
- ✅ Audit log shows only final position
- ✅ Only one audit entry per drag session

## Future Enhancements

### Phase 2: Priorities Page
Once file structure issues are resolved, implement debouncing for:
- Course priority drag-and-drop
- Percentage +/- buttons
- All input fields and selects

### Phase 3: Modal Changes
Consider debouncing for:
- Event modal field changes
- Bulk edits
- Form submissions

## Files Modified

- `utils/auditDebounce.ts` - NEW: Debouncing utility
- `App.tsx` - Updated tile movement handlers to use debounced logging

## Commit Information

**Branch**: main
**Commit Message**: "Add 3-second debouncing for tile movement audit logging"