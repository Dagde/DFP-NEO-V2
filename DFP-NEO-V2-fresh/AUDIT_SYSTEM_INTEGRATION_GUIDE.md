# Audit System Integration Guide

## Current Status

### ✅ What's Working
1. **Audit Button UI** - Buttons display correctly in sidebar
2. **Audit Flyout** - Opens without errors, displays logs
3. **Audit Logger Utility** - Functions exist to log, retrieve, and export audit data
4. **Test Data** - Sample audit logs are seeded on first load

### ❌ What's Missing
**Real-time audit logging is NOT integrated yet.** The system can display logs, but nothing is actually calling `logAudit()` when users make changes.

## Why You See 2 Buttons

There are intentionally **2 separate audit buttons** in the sidebar:
1. **"Program Schedule"** - Shows audit logs for the DFP page
2. **"Next Day Build"** - Shows audit logs for the Next Day Build page

Each button opens the audit flyout filtered to show only logs for that specific page.

## How to Integrate Real Audit Logging

### Step 1: Import the Logger

In any component where you want to log actions:

```typescript
import { logAudit } from '../utils/auditLogger';
```

### Step 2: Call logAudit() When Actions Occur

The `logAudit()` function signature:

```typescript
logAudit(
  page: string,           // Page name (e.g., "Program Schedule")
  action: AuditAction,    // 'View' | 'Add' | 'Edit' | 'Delete' | 'Archive' | 'Restore'
  description: string,    // Human-readable description
  changes?: string        // Optional: Details of what changed
)
```

### Step 3: Integration Examples

#### Example 1: Log When Adding a Flight Event

In `App.tsx`, find the `handleSaveEvents` function:

```typescript
const handleSaveEvents = (events: ScheduleEvent[]) => {
  // Existing code to save events...
  
  // ADD THIS: Log the action
  events.forEach(event => {
    logAudit(
      'Program Schedule',
      'Add',
      `Added ${event.type} event for ${event.student || event.pilot || 'unknown'}`,
      `Event: ${event.syllabusItem}, Time: ${event.startTime}, Duration: ${event.duration}hrs`
    );
  });
  
  // Rest of existing code...
};
```

#### Example 2: Log When Editing an Event

```typescript
const handleUpdateEvent = (eventId: string, updates: Partial<ScheduleEvent>) => {
  // Existing code to update event...
  
  // ADD THIS: Log the action
  const oldEvent = events.find(e => e.id === eventId);
  const changes = Object.entries(updates)
    .map(([key, value]) => `${key}: ${oldEvent?.[key]} → ${value}`)
    .join(', ');
  
  logAudit(
    'Program Schedule',
    'Edit',
    `Modified event ${eventId}`,
    changes
  );
  
  // Rest of existing code...
};
```

#### Example 3: Log When Deleting an Event

```typescript
const handleDeleteEvent = (eventId: string) => {
  const event = events.find(e => e.id === eventId);
  
  // ADD THIS: Log before deleting
  logAudit(
    'Program Schedule',
    'Delete',
    `Deleted ${event?.type} event`,
    `Event: ${event?.syllabusItem}, Time: ${event?.startTime}`
  );
  
  // Existing code to delete event...
};
```

#### Example 4: Log When Viewing a Page

```typescript
useEffect(() => {
  // Log when user navigates to a page
  if (activeView === 'Program Schedule') {
    logAudit(
      'Program Schedule',
      'View',
      `Viewed schedule for ${date}`,
      null
    );
  }
}, [activeView, date]);
```

#### Example 5: Log When Changing Priorities

In `PrioritiesView.tsx`:

```typescript
const handleCoursePriorityChange = (newOrder: string[]) => {
  // Existing code...
  
  // ADD THIS: Log the change
  logAudit(
    'Priorities',
    'Edit',
    'Updated course priority order',
    `New order: ${newOrder.join(', ')}`
  );
};
```

#### Example 6: Log When Publishing Schedule

```typescript
const handlePublish = () => {
  // Existing code to publish...
  
  // ADD THIS: Log the action
  logAudit(
    'Program Schedule',
    'Edit',
    `Published schedule for ${date}`,
    `Total events: ${events.length}`
  );
};
```

## Where to Add Logging

### High Priority Pages (Add logging here first)

1. **Program Schedule (ScheduleView)**
   - Add event
   - Edit event (drag, resize, modify details)
   - Delete event
   - Publish schedule
   - View schedule

2. **Next Day Build (NextDayBuildView)**
   - Run NEO-Build algorithm
   - Add/edit/delete events
   - Publish to DFP

3. **Priorities (PrioritiesView)**
   - Change course priority order
   - Change instructor priority order
   - Update flying window times
   - Modify turnaround times

### Medium Priority Pages

4. **Instructors**
   - Add instructor
   - Edit instructor details
   - Archive instructor

5. **Trainees**
   - Add trainee
   - Edit trainee details
   - Archive trainee

6. **Syllabus**
   - Add syllabus item
   - Edit syllabus item
   - Delete syllabus item

### Low Priority Pages

7. **Settings**
   - Change SCT events
   - Modify system settings

## Testing the Audit System

### View Test Logs

1. Open the application
2. Click either audit button in the sidebar
3. You should see sample logs that were seeded on first load

### Clear Test Logs

To clear all logs and start fresh:

```typescript
import { clearAuditLogs } from './utils/auditLogger';

// Call this in browser console or add a button:
clearAuditLogs();
```

### Verify Logging Works

1. Add a `logAudit()` call to any action
2. Perform that action in the UI
3. Click the audit button
4. Verify the new log appears in the flyout

## Audit Log Features

### Viewing Logs
- **Filtered by page** - Each audit button shows only logs for that page
- **Sortable columns** - Click column headers to sort
- **Color-coded actions** - Different colors for View, Add, Edit, Delete, etc.

### Exporting Logs
- **CSV Export** - Click "Export CSV" button to download logs
- **Print** - Click "Print" button for print-friendly view

### Storage
- **localStorage** - Logs stored in browser (max 1000 entries)
- **Ready for backend** - Easy to switch to API calls later

## Future Enhancements

### Phase 2: Backend Integration
Replace localStorage with API calls:

```typescript
// Instead of:
localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));

// Use:
await fetch('/api/audit-logs', {
  method: 'POST',
  body: JSON.stringify(newLog)
});
```

### Phase 3: Advanced Features
- User authentication integration
- Real-time log streaming
- Advanced filtering (date range, user, action type)
- Log retention policies
- Audit log search

## Summary

**Current State:**
- ✅ UI components working
- ✅ Test data visible
- ❌ Real logging not integrated

**Next Steps:**
1. Add `logAudit()` calls to key actions (see examples above)
2. Test that logs appear in the audit flyout
3. Expand to more pages and actions
4. Consider backend integration for production

**Quick Win:**
Start with just the "Add Event" action in Program Schedule. Once that works, expand to other actions and pages.