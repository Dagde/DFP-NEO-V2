# Deployed Resource Line Implementation

## Summary
Implemented complete deployment resource line behavior where the bottom PC-21 line dynamically transforms into a "Deployed" resource line when deployment tiles are present for the active day, and reverts back to a normal PC-21 line when no deployments exist.

## Implementation Details

### 1. Dynamic Resource Line Transformation (App.tsx)

**Modified `buildResources` useMemo hook:**
- Checks for deployment events specific to the current date/view
- For Daily Flying Program views: Checks `publishedSchedules[date]`
- For Next Day Build views: Checks `nextDayBuildEvents`
- When deployments exist: Last PC-21 line becomes "Deployed"
- When no deployments: All PC-21 lines remain numbered (PC-21 1, PC-21 2, ..., PC-21 20)

```typescript
// Check if there are any deployment events for the current date in the active view
let hasDeploymentForDate = false;

if (activeView === 'DailyFlyingProgram' || activeView === 'InstructorSchedule' || activeView === 'TraineeSchedule') {
    // For published schedules, check the current date
    const eventsForDate = publishedSchedules[date] || [];
    hasDeploymentForDate = eventsForDate.some(event => event.type === 'deployment');
} else if (['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView)) {
    // For next day build, check if any deployment exists in nextDayBuildEvents
    hasDeploymentForDate = nextDayBuildEvents.some(event => event.type === 'deployment');
}

// Build PC-21 resources, replacing the last one with "Deployed" if needed
const pc21Resources = Array.from({ length: pc21Count }, (_, i) => {
    if (hasDeploymentForDate && i === pc21Count - 1) {
        return 'Deployed';
    }
    return `PC-21 ${i + 1}`;
});
```

**Updated dependencies:**
- Added `date`, `activeView`, `publishedSchedules`, `nextDayBuildEvents` to dependency array
- Ensures resource list updates when date changes or deployments are added/removed

### 2. Deployment Tile Resource Assignment

**FlightDetailModal.tsx:**
- Deployment tiles created with `resourceId: 'Deployed'`
- Ensures tiles appear on the Deployed resource line

**App.tsx - findAvailableResourceId:**
- Deployment events always return 'Deployed' as resourceId
- Prevents deployments from being assigned to regular PC-21 lines

```typescript
if (eventToPlace.type === 'deployment') {
    return 'Deployed';
}
```

### 3. Date-Specific Event Saving

**Modified `setPublishedSchedules` in handleSaveEvents:**
- Groups events by their individual dates before saving
- Deployment tiles with different dates are saved to their correct dates
- Ensures multi-day deployments work correctly

```typescript
// Group events by their date (deployment tiles may have different dates)
const eventsByDate = new Map<string, ScheduleEvent[]>();
eventsToSave.forEach(event => {
    const eventDate = event.date;
    if (!eventsByDate.has(eventDate)) {
        eventsByDate.set(eventDate, []);
    }
    eventsByDate.get(eventDate)!.push(event);
});

// Save each group of events to their respective dates
eventsByDate.forEach((events, eventDate) => {
    const currentScheduleForDate = newSchedules[eventDate] || [];
    const existingEventIds = new Set(events.map(e => e.id));
    const otherEvents = currentScheduleForDate.filter(e => !existingEventIds.has(e.id));
    newSchedules[eventDate] = [...otherEvents, ...events];
});
```

## Behavior Specifications

### Resource Line Transformation
1. **Without Deployments:**
   - Resource lines: PC-21 1, PC-21 2, ..., PC-21 20 (or more based on availableAircraftCount)
   - All lines available for regular flight events

2. **With Deployments:**
   - Resource lines: PC-21 1, PC-21 2, ..., PC-21 19, **Deployed**
   - Last line is dedicated to deployment tiles only
   - Regular flight events use PC-21 1 through PC-21 19

3. **Automatic Reversion:**
   - When last deployment is deleted from the day
   - Resource line automatically reverts to "PC-21 20"
   - Line becomes available for regular flight events again

### Deployment Tile Display Rules
1. **Exclusive Placement:**
   - ALL deployment tiles for the day appear ONLY on the Deployed resource line
   - Deployment tiles NEVER appear on regular PC-21 lines
   - Even if associated with PC-21 pilots/aircraft in data model

2. **Multi-Day Deployments:**
   - Deployment tiles can span multiple days
   - Each day's view shows the deployment on its Deployed line
   - Duration calculation accounts for multi-day periods

### Conflict Detection (Unchanged)
**Important:** The Deployed resource line is a UI/display choice only and does NOT affect conflict detection:

1. **Resource Conflicts:**
   - Deployment tiles reserve their associated resources (trainees, instructors, aircraft)
   - Conflicts detected when other events use same resources with overlapping protected windows
   - Detection works regardless of which visual line events are on

2. **Personnel Conflicts:**
   - Booking windows still calculated: Pre-Flight + Duration + Post-Flight
   - Personnel conflicts detected when same person is double-booked
   - Deployment tiles participate in all conflict checks

3. **Protected Windows:**
   - Deployment periods create protected windows for their resources
   - Other events overlapping these windows trigger conflicts
   - Conflict logic remains unchanged from previous implementation

## View-Specific Behavior

### Daily Flying Program View
- Checks `publishedSchedules[date]` for deployments
- Resource line transforms based on current date's deployments
- Each date has independent Deployed line status

### Next Day Build View
- Checks `nextDayBuildEvents` for deployments
- Resource line transforms for build date
- Allows planning deployments before publishing

### Instructor/Trainee Schedule Views
- Same logic as Daily Flying Program
- Deployed line appears when deployments exist for viewed date
- Maintains consistency across all views

## Technical Implementation Notes

### State Management
- `buildResources` recalculates when relevant state changes
- React's useMemo ensures efficient re-rendering
- Dependency array includes all relevant state variables

### Resource Assignment
- Deployment tiles get `resourceId: 'Deployed'` at creation
- `findAvailableResourceId` preserves this assignment
- `handleSaveEvents` doesn't overwrite pre-assigned resourceIds

### Date Handling
- Deployment tiles can have different dates than parent flight events
- Events grouped by date before saving to publishedSchedules
- Ensures correct display across multiple days

## Testing Checklist
- ✅ Bottom PC-21 line changes to "Deployed" when deployment added
- ✅ Deployment tile appears on Deployed line
- ✅ Line reverts to "PC-21 20" when deployment deleted
- ✅ Multiple deployments can coexist on Deployed line
- ✅ Regular flights still work on PC-21 1-19
- ✅ Conflict detection still works for deployment resources
- ✅ Multi-day deployments display correctly
- ✅ Resource line updates when changing dates
- ✅ Works correctly in all views (DFP, Next Day Build, Instructor, Trainee)

## Files Modified
1. `DFP---NEO/App.tsx` - Resource line transformation and event saving logic
2. `DFP---NEO/components/FlightDetailModal.tsx` - Deployment tile creation with 'Deployed' resourceId

## Build Status
✅ Application compiles successfully with no TypeScript errors
✅ All deployment functionality working as specified
✅ No breaking changes to existing features
✅ Conflict detection logic preserved and functional