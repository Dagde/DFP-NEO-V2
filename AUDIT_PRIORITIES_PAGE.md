# Audit System - Priorities Page Integration

## Overview
Added comprehensive audit logging to the Priorities page to track all configuration changes made by users.

## Implementation Date
December 29, 2024

## What's Being Logged

### 1. Course Priority Changes
**Action**: Dragging courses to reorder priority
**Log Entry Example**:
```
Action: Edit
Description: Updated course priority order
Changes: Moved Course 302 from position 2 to position 1
```

### 2. Course Percentage Changes
**Action**: Clicking +/- buttons to adjust course percentages
**Log Entry Example**:
```
Action: Edit
Description: Updated course percentage for Course 301
Changes: 45% → 50%
```

### 3. Flying Window Settings
**Fields Tracked**:
- Available Aircraft Count
- Flying Start Time
- Flying End Time
- Allow Night Flying (checkbox)
- Commence Night Flying Time
- Cease Night Flying Time

**Log Entry Examples**:
```
Action: Edit
Description: Updated available aircraft count
Changes: 20 → 22
```

```
Action: Edit
Description: Updated flying start time
Changes: 7 → 7.5
```

```
Action: Edit
Description: Updated allow night flying
Changes: false → true
```

### 4. Build Configuration
**Fields Tracked**:
- Program with Primaries (checkbox)
- Preferred Duty Period
- Max Crew Duty Period

**Log Entry Examples**:
```
Action: Edit
Description: Updated program with primaries
Changes: false → true
```

```
Action: Edit
Description: Updated preferred duty period
Changes: 10 → 12
```

### 5. Turnaround Times
**Fields Tracked**:
- Flight Turnaround
- FTD Turnaround
- CPT Turnaround

**Log Entry Examples**:
```
Action: Edit
Description: Updated flight turnaround time
Changes: 1.2 → 1.5
```

```
Action: Edit
Description: Updated FTD turnaround time
Changes: 0.5 → 0.75
```

## Technical Implementation

### Approach
Used inline audit logging in onChange handlers to capture changes immediately when they occur.

### Example Implementation
```typescript
onChange={(e) => { 
  logAudit(
    "Priorities", 
    "Edit", 
    "Updated available aircraft count", 
    `${availableAircraftCount} → ${parseInt(e.target.value)}`
  ); 
  onUpdateAircraftCount(parseInt(e.target.value)); 
}}
```

### Fields Modified
All onChange handlers in the Priorities page now include audit logging:
- Course priority drag-and-drop
- Course percentage adjustments
- Aircraft count input
- Flying time selects
- Night flying checkbox and times
- Program with primaries checkbox
- Duty period inputs
- Turnaround time selects

## Complete Coverage

### Windows Tracked
1. ✅ **Course Priority** - Drag-and-drop reordering
2. ✅ **Course Percentages** - +/- adjustments
3. ✅ **Flying Window** - All time and aircraft settings
4. ✅ **Build Configuration** - Duty periods and primaries
5. ✅ **Turnaround Times** - Flight, FTD, CPT

### Not Tracked (Future Enhancement)
- SCT Requests table changes
- Remedial Requests
- Priority Events table changes
- Unavailabilities (handled in separate window)

## Testing

### Test Scenarios

1. **Test Course Priority**
   - Drag a course to a new position
   - Check audit log shows the move

2. **Test Course Percentage**
   - Click + or - on any course
   - Check audit log shows percentage change

3. **Test Aircraft Count**
   - Change the available aircraft number
   - Check audit log shows the change

4. **Test Flying Times**
   - Change start or end time
   - Check audit log shows the change

5. **Test Night Flying**
   - Toggle night flying checkbox
   - Change commence/cease times
   - Check audit log shows all changes

6. **Test Turnaround Times**
   - Change any turnaround time
   - Check audit log shows the change

## Benefits

1. **Configuration Tracking**: Complete history of all priority settings
2. **Troubleshooting**: Easy to identify when settings were changed
3. **Accountability**: Clear record of who changed what
4. **Compliance**: Audit trail for configuration management
5. **Training**: Review history to understand scheduling decisions

## Files Modified

- `components/PrioritiesView.tsx`: Added logAudit import and inline logging to all onChange handlers

## Commit Information

**Branch**: main
**Commit Message**: "Add comprehensive audit logging to Priorities page"