# Audit System - Detailed Field-Level Change Tracking

## Overview
Enhanced the audit logging system to track specific field-level changes when editing events, providing granular visibility into what exactly was modified.

## Implementation Date
December 29, 2024

## Enhanced Tracking

### What's Now Tracked

When an event is edited through the modal, the system now detects and logs changes to:

1. **Personnel Changes**
   - Instructor changes
   - Pilot changes (for SCT/Staff CAT events)
   - Student/Trainee changes

2. **Event Details**
   - LMP Event/Syllabus Item changes
   - Flight Number changes
   - Area changes

3. **Timing & Resources**
   - Start time changes
   - Duration changes
   - Resource/Aircraft changes
   - Event type changes

### Before vs After Comparison

**Before Enhancement:**
```
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: Event: BGF5, Time: 8, Duration: 1.2hrs, Resource: PC-21 1
```

**After Enhancement:**
```
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: Instructor: SQNLDR Jones → FLTLT Brown, Area: ESL → PEA, Time: 8 → 9
```

## Examples

### Example 1: Changing Instructor
**User Action:** Opens event modal, changes instructor from "SQNLDR Jones" to "FLTLT Brown"

**Audit Log Entry:**
```
Who: Current User
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: Instructor: SQNLDR Jones → FLTLT Brown
Date: 2024-12-29 14:30:15
Page: Program Schedule
```

### Example 2: Changing LMP Event
**User Action:** Opens event modal, changes syllabus item from "BGF5" to "BGF6"

**Audit Log Entry:**
```
Who: Current User
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: LMP Event: BGF5 → BGF6
Date: 2024-12-29 14:32:20
Page: Program Schedule
```

### Example 3: Changing Area
**User Action:** Opens event modal, changes area from "ESL" to "PEA"

**Audit Log Entry:**
```
Who: Current User
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: Area: ESL → PEA
Date: 2024-12-29 14:35:45
Page: Program Schedule
```

### Example 4: Multiple Changes
**User Action:** Opens event modal, changes instructor, area, and time

**Audit Log Entry:**
```
Who: Current User
Action: Edit
Description: Modified flight event for PLTOFF Smith
Changes: Instructor: SQNLDR Jones → FLTLT Brown, Area: ESL → PEA, Time: 8 → 9
Date: 2024-12-29 14:38:10
Page: Program Schedule
```

### Example 5: Dragging Tile (Time/Resource Change)
**User Action:** Drags event tile to new time or resource

**Audit Log Entry:**
```
Who: Current User
Action: Edit
Description: Moved flight event for PLTOFF Smith
Changes: Time: 8 → 10, Resource: PC-21 1 → PC-21 3
Date: 2024-12-29 14:40:25
Page: Program Schedule
```

## Technical Implementation

### Change Detection Logic

The system compares the edited event with the original event stored in `publishedSchedules` or `nextDayBuildEvents`:

```typescript
const originalEvent = publishedSchedules[event.date]?.find(e => e.id === event.id) || 
                     nextDayBuildEvents.find(e => e.id === event.id);

if (originalEvent) {
    const changesList: string[] = [];
    
    // Compare each field
    if (event.instructor !== originalEvent.instructor) {
        changesList.push(`Instructor: ${originalEvent.instructor} → ${event.instructor}`);
    }
    // ... more field comparisons
    
    // Only log if there are actual changes
    if (changesList.length > 0) {
        logAudit(pageName, 'Edit', description, changesList.join(', '));
    }
}
```

### Fields Monitored

| Field | Description | Example Change |
|-------|-------------|----------------|
| `instructor` | Instructor name | SQNLDR Jones → FLTLT Brown |
| `pilot` | Pilot name (SCT/Staff CAT) | FLTLT Smith → SQNLDR Davis |
| `student` | Student/Trainee name | PLTOFF Brown → PLTOFF Green |
| `syllabusItem` | LMP Event/Syllabus Item | BGF5 → BGF6 |
| `flightNumber` | Flight Number | BGF5 → BGF6 |
| `area` | Training area | ESL → PEA |
| `startTime` | Event start time | 8 → 9 |
| `duration` | Event duration | 1.2hrs → 1.5hrs |
| `resourceId` | Aircraft/Resource | PC-21 1 → PC-21 3 |
| `type` | Event type | flight → ftd |

### Smart Logging

- **Only logs actual changes**: If no fields changed, no audit entry is created
- **Handles null/undefined**: Shows "None" for empty values
- **Multiple changes**: Combines all changes into a single audit entry
- **Separate tracking**: Drag operations logged separately from modal edits

## Benefits

1. **Accountability**: Clear record of who changed what
2. **Troubleshooting**: Easy to identify when and why changes were made
3. **Compliance**: Detailed audit trail for regulatory requirements
4. **Training**: Review history to understand scheduling decisions
5. **Quality Control**: Identify patterns of errors or corrections

## Testing

### Test Scenarios

1. **Test Instructor Change**
   - Open any flight event
   - Change the instructor
   - Save
   - Check audit log for instructor change

2. **Test LMP Event Change**
   - Open any flight event
   - Change the syllabus item
   - Save
   - Check audit log for LMP event change

3. **Test Area Change**
   - Open any flight event
   - Change the area
   - Save
   - Check audit log for area change

4. **Test Multiple Changes**
   - Open any flight event
   - Change instructor, area, and time
   - Save
   - Check audit log shows all three changes

5. **Test Drag Operation**
   - Drag an event to a new time or resource
   - Check audit log for time/resource change

## Files Modified

- `App.tsx`: Enhanced `handleSaveEvents` with field-level change detection

## Commit Information

**Branch**: main
**Commit Message**: "Add detailed field-level change tracking to audit system"