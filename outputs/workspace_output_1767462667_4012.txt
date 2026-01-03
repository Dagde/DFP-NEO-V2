# Visual Adjust Dashed Lines Fix

## Issue
When the "Visual Adjust" button was pressed and the user clicked "Continue", the Flight Details modal would reopen showing the updated times, but the dashed adjustment lines would remain visible on the schedule.

## Root Cause
The `handleVisualAdjustEnd` function was setting `setSelectedEvent(event)` which reopened the modal instead of closing it completely.

## Fix Applied
Changed the `handleVisualAdjustEnd` function in `App.tsx`:

**Before:**
```typescript
const handleVisualAdjustEnd = (event: ScheduleEvent) => {
    setIsVisualAdjustMode(false);
    setVisualAdjustEvent(null);
    // Update the selected event so the modal shows the new times
    setSelectedEvent(event);  // ❌ This reopens the modal
    // The event has already been updated in the events array during dragging
};
```

**After:**
```typescript
const handleVisualAdjustEnd = (event: ScheduleEvent) => {
    setIsVisualAdjustMode(false);
    setVisualAdjustEvent(null);
    // Close the modal completely when visual adjust ends
    setSelectedEvent(null);  // ✅ This closes the modal
    // The event has already been updated in the events array during dragging
};
```

## Result
Now when you:
1. Click "Visual Adjust" button
2. Drag the event to adjust times
3. Click "Continue"

The modal closes completely and the dashed lines disappear as expected.

## Build Status
✅ Built successfully  
✅ Copied to deployment directory  
✅ Ready for Git commit and push

## Apology Note
Sorry for the confusion about the purple Edit/Save buttons! I now understand those are from the Next Day Build course management section, not the Settings page.