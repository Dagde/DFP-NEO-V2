# Audit Logging Implementation - Remaining Pages

## Overview
Add audit logging with 3-second debouncing to capture final state changes rather than every keystroke/click.

## Pages Requiring Logging Implementation

### 1. CourseRosterView (Trainee Roster)
- [x] Add trainee (immediate logging) - Implemented in TraineeProfileFlyout
- [x] Edit trainee details (3-second debounce) - Implemented for name, rank, course, unit, location
- [ ] Archive trainee (immediate logging)
- [ ] Restore trainee (immediate logging)

### 2. InstructorListView (Staff)
- [x] Add instructor (immediate logging) - Implemented in InstructorProfileFlyout
- [x] Edit instructor details (3-second debounce) - Implemented for name, rank, role
- [ ] Archive instructor (immediate logging)
- [ ] Restore instructor (immediate logging)
- [ ] Bulk update instructors (immediate logging)

### 3. PT051View (PT-051 Assessment)
- [x] Save assessment (already implemented with auto-save)
- [ ] Add 3-second debounce for field changes

### 4. HateSheetView (Performance History)
- [ ] View hate sheet (immediate logging on open)
- [ ] Navigate to assessment (immediate logging)

### 5. PostFlightView (Post-Flight)
- [x] Save post-flight data (immediate logging) - Implemented in handleSave
- [x] Update result (3-second debounce) - Implemented for DCO/DPCO/DNCO changes
- [ ] Update times (3-second debounce) - Can be added if needed
- [ ] Update defects (3-second debounce) - Can be added if needed

### 6. SyllabusView (Master LMP)
- [x] Pre/post flight times (already implemented)
- [ ] Add LMP item (immediate logging)
- [ ] Edit LMP item (3-second debounce)
- [ ] Delete LMP item (immediate logging)
- [ ] Reorder LMP items (immediate logging)

### 7. CurrencyView (Currency Status)
- [ ] Update currency status (immediate logging)
- [ ] Update currency dates (3-second debounce)

### 8. CurrencyBuilderView (Currency Builder)
- [ ] Create currency (immediate logging)
- [ ] Edit currency details (3-second debounce)
- [ ] Delete currency (immediate logging)

### 9. SettingsView (Settings)
- [x] SCT Events (already implemented)
- [ ] Add location (immediate logging)
- [ ] Edit location (3-second debounce)
- [ ] Delete location (immediate logging)
- [ ] Add unit (immediate logging)
- [ ] Edit unit (3-second debounce)
- [ ] Delete unit (immediate logging)
- [ ] Bulk import instructors (immediate logging)
- [ ] Bulk import trainees (immediate logging)
- [ ] Update event limits (3-second debounce)

### 10. TraineeLmpView (Individual LMP)
- [ ] View LMP (immediate logging on open)

### 11. LogbookView (Logbook)
- [ ] View logbook (immediate logging on open)
- [ ] Generate PDF (immediate logging)

### 12. ProgramDataView (Program Data)
- [ ] View program data (immediate logging on open)

### 13. CourseProgressView (Course Progress)
- [x] Update grad dates (already implemented)
- [x] Update start dates (already implemented)

## Implementation Strategy

### Immediate Logging (No Debounce)
Use for actions that are:
- Single-click operations (add, delete, archive, restore)
- Navigation events (view, open)
- Final save operations

```tsx
import { logAudit } from '../utils/auditLogger';

logAudit({
    action: 'Add',
    description: 'Added new trainee',
    changes: `${rank} ${name} - ${course}`,
    page: 'Trainee Roster'
});
```

### Debounced Logging (3-Second Delay)
Use for actions that are:
- Text input changes
- Dropdown selections
- Slider adjustments
- Any rapid-fire changes

```tsx
import { debouncedAuditLog } from '../utils/auditDebounce';

// On change handler
const handleFieldChange = (field: string, newValue: any) => {
    // Update state immediately
    setData(prev => ({ ...prev, [field]: newValue }));
    
    // Log with debounce (waits 3 seconds after last change)
    debouncedAuditLog(
        `trainee-${traineeId}-${field}`, // Unique key
        'Edit',
        `Updated trainee ${field}`,
        `${field}: ${oldValue} → ${newValue}`,
        'Trainee Roster'
    );
};
```

## Priority Order

1. **High Priority** (Most frequently used)
   - CourseRosterView (Trainee management)
   - InstructorListView (Staff management)
   - PostFlightView (Post-flight data)

2. **Medium Priority**
   - SyllabusView (LMP management)
   - SettingsView (Configuration)
   - CurrencyView (Currency tracking)

3. **Low Priority** (View-only or less frequent)
   - TraineeLmpView
   - HateSheetView
   - LogbookView
   - ProgramDataView

## Next Steps

1. Start with high-priority pages
2. Implement immediate logging first (easier)
3. Add debounced logging for edit operations
4. Test each implementation
5. Document any special cases