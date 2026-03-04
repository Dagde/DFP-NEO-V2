# Deep Analysis: SCT FORM Drag Collapse Issue

## Issue Description
When dragging any SCT FORM event, ALL formation events collapse onto each other instead of moving independently.

## ROOT CAUSE IDENTIFIED ✅

### The Problem
All SCT FORM events were being created with the **SAME resourceId** (inherited from the original event).

### Why This Happened
1. In `FlightDetailModal.tsx`, when creating multiple SCT FORM events:
   ```typescript
   let resourceId = event.resourceId; // All events get the same resourceId!
   ```

2. In `App.tsx`, `findAvailableResourceId` is only called when:
   ```typescript
   if (!e.resourceId || e.type === 'deployment')
   ```

3. Since SCT FORM events HAD a resourceId, this condition was FALSE
4. `findAvailableResourceId` was never called
5. All events kept the same resourceId
6. All events rendered on the same resource line (collapsed on top of each other)

### The Fix
Clear the resourceId for SCT FORM events with multiple aircraft:
```typescript
// For SCT FORM events with multiple aircraft, clear resourceId 
// so findAvailableResourceId assigns them to different lines
if (flightNumber === 'SCT FORM' && crew.length > 1) {
    resourceId = '';
}
```

Now when events are saved:
1. Each SCT FORM event has `resourceId = ''` (empty)
2. The condition `!e.resourceId` is TRUE
3. `findAvailableResourceId` is called for each event
4. Each event gets assigned to a different resource line
5. Events display on separate lines (vertically stacked)

## Verification Steps
- [x] Identified root cause
- [x] Implemented fix
- [ ] Build and test
- [ ] Verify events appear on different resource lines
- [ ] Verify events can be dragged independently