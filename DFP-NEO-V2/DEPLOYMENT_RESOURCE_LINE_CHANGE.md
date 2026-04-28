# Deployment Resource Line Implementation

## Summary
Modified the deployment tile behavior so that when a deployment is added, the bottom PC-21 resource line transforms into a "DEPLOYMENT" resource line, and the deployment tile appears on that line instead of creating a separate resource.

## Changes Made

### 1. App.tsx - Dynamic Resource Line Transformation and Resource Assignment
**Modified `buildResources` useMemo hook:**
- Added logic to detect if any deployment events exist in the schedule
- When deployment exists, the last PC-21 resource line is renamed to "DEPLOYMENT"
- When no deployment exists, all PC-21 lines remain numbered normally
- Added `events` to the dependency array to trigger re-calculation when events change

**Before:**
```typescript
const buildResources = useMemo(() => {
    const pc21Count = Math.max(20, availableAircraftCount);
    return [
        ...Array.from({ length: pc21Count }, (_, i) => `PC-21 ${i + 1}`),
        // ... other resources
    ];
}, [ftdCount, availableAircraftCount]);
```

**After:**
```typescript
const buildResources = useMemo(() => {
    const pc21Count = Math.max(20, availableAircraftCount);
    
    // Check if there are any deployment events in the schedule
    const hasDeployment = events.some(event => event.type === 'deployment');
    
    // Build PC-21 resources, replacing the last one with DEPLOYMENT if needed
    const pc21Resources = Array.from({ length: pc21Count }, (_, i) => {
        if (hasDeployment && i === pc21Count - 1) {
            return 'DEPLOYMENT';
        }
        return `PC-21 ${i + 1}`;
    });
    
    return [
        ...pc21Resources,
        // ... other resources
    ];
}, [ftdCount, availableAircraftCount, events]);
```

**Modified `findAvailableResourceId` function:**
- Added check at the beginning to handle deployment events
- Deployment events always return 'DEPLOYMENT' as their resourceId
- This ensures deployments are never assigned to regular PC-21 lines

**Modified `handleSaveEvents` function:**
- Changed resource assignment logic to preserve existing resourceIds
- Only assigns new resourceId if event doesn't already have one
- This prevents deployment tiles from being overwritten with PC-21 resourceIds

### 2. FlightDetailModal.tsx - Deployment Tile Resource Assignment
**Modified deployment tile creation:**
- Changed `resourceId` from `DEPLOYMENT-${deploymentStartDate}` to simply `DEPLOYMENT`
- This ensures the deployment tile is placed on the renamed PC-21 resource line

**Before:**
```typescript
resourceId: `DEPLOYMENT-${deploymentStartDate}`,
```

**After:**
```typescript
resourceId: 'DEPLOYMENT',
```

## Behavior

### Without Deployment
- PC-21 lines numbered: PC-21 1, PC-21 2, ..., PC-21 20 (or more if availableAircraftCount > 20)
- All lines available for regular flight events

### With Deployment
- PC-21 lines numbered: PC-21 1, PC-21 2, ..., PC-21 19, **DEPLOYMENT**
- The last line is reserved for deployment tiles
- Deployment tiles appear on the "DEPLOYMENT" resource line
- Regular flight events can still use PC-21 1 through PC-21 19

## Visual Impact
- The resource line label changes from "PC-21 20" to "DEPLOYMENT" when a deployment exists
- The deployment tile appears on this renamed line
- The line transforms back to "PC-21 20" when all deployments are removed
- This provides clear visual separation between regular flights and deployments

## Bug Fixes

### Issue 1: Deployment ResourceId Being Overwritten
**Problem:** When saving events, the code was overwriting ALL events' resourceIds with the same value, including deployment tiles that already had 'DEPLOYMENT' set.

**Solution:** Modified the forEach loops in `handleSaveEvents` to only assign resourceId if the event doesn't already have one:
```typescript
eventsToSave.forEach(e => {
    // Only assign resourceId if the event doesn't already have one
    if (!e.resourceId) {
        e.resourceId = newResourceId;
    }
});
```

### Issue 2: Deployment Events Not Recognized in Resource Assignment
**Problem:** The `findAvailableResourceId` function didn't handle deployment type events, causing them to fall through to default logic.

**Solution:** Added explicit check at the beginning of the function:
```typescript
if (eventToPlace.type === 'deployment') {
    return 'DEPLOYMENT';
}
```

## Technical Details

### Resource Line Calculation
1. System checks if any events have `type === 'deployment'`
2. If true, the last PC-21 resource (index = pc21Count - 1) is renamed to "DEPLOYMENT"
3. The `buildResources` array is recalculated whenever events change
4. React's useMemo ensures efficient re-rendering

### Deployment Tile Assignment
1. When user creates a deployment in Flight Details modal
2. System creates a deployment tile with `resourceId: 'DEPLOYMENT'`
3. The tile is automatically placed on the DEPLOYMENT resource line
4. Multiple deployments can share the same DEPLOYMENT line (if time slots don't overlap)

## Benefits
1. **Clearer Organization**: Deployments are visually separated from regular flights
2. **Consistent Resource Usage**: Uses existing PC-21 resource infrastructure
3. **Dynamic Behavior**: Resource line automatically transforms based on deployment presence
4. **No Orphaned Resources**: When deployments are removed, the line reverts to PC-21 numbering

## Testing Recommendations
- ✅ Verify last PC-21 line changes to "DEPLOYMENT" when deployment is added
- ✅ Verify deployment tile appears on DEPLOYMENT line
- ✅ Verify line reverts to "PC-21 20" when deployment is deleted
- ✅ Verify multiple deployments can coexist on DEPLOYMENT line
- ✅ Verify regular flights still work on PC-21 1-19
- ✅ Verify resource line count adjusts correctly with availableAircraftCount changes

## Build Status
✅ Application compiles successfully with no TypeScript errors
✅ All deployment functionality preserved
✅ No breaking changes to existing features