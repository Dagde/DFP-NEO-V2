# SCT Events Configuration Feature

## Overview
Added a new "SCT Events" configuration window to the Settings page that allows users to manage SCT (Standards Check Training) event types with persistent storage.

## Feature Details

### Location
- **Page**: Settings
- **Position**: Between "Units" window and "Currencies" window

### Default SCT Events
The system comes pre-configured with the following SCT event types:
1. SCT GF
2. SCT IF
3. SCT Form
4. SCT Nav

### Functionality

#### View Mode (Default)
- Displays all configured SCT event types in a list
- Shows description: "Configured SCT event types"
- Read-only view with gray background for each item
- "Edit" button in the header to enter edit mode

#### Edit Mode
- Activated by clicking the "Edit" button
- Features:
  - **Add New Events**: Text input field with "+" button
  - **Remove Events**: Each event has a red "×" button for deletion
  - **Save Changes**: Blue "Save" button to persist changes
  - **Cancel Changes**: Gray "Cancel" button to discard changes

### User Interface

#### Window Structure
```
┌─────────────────────────────────┐
│ SCT Events              [Edit]  │
├─────────────────────────────────┤
│ Configured SCT event types.     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SCT GF                      │ │
│ │ SCT IF                      │ │
│ │ SCT Form                    │ │
│ │ SCT Nav                     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Edit Mode Structure
```
┌─────────────────────────────────┐
│ SCT Events        [Save][Cancel]│
├─────────────────────────────────┤
│ Manage SCT event types.         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SCT GF                  [×] │ │
│ │ SCT IF                  [×] │ │
│ │ SCT Form                [×] │ │
│ │ SCT Nav                 [×] │ │
│ └─────────────────────────────┘ │
│                                 │
│ [New SCT event name...    ] [+] │
└─────────────────────────────────┘
```

### Technical Implementation

#### State Management (App.tsx)
```typescript
const [sctEvents, setSctEvents] = useState<string[]>([
    'SCT GF', 
    'SCT IF', 
    'SCT Form', 
    'SCT Nav'
]);
```

#### Props Passed to SettingsView
- `sctEvents`: Current list of SCT events
- `onUpdateSctEvents`: Callback to update the list

#### Local State (SettingsView.tsx)
- `isEditingSctEvents`: Boolean flag for edit mode
- `tempSctEvents`: Temporary array for editing
- `newSctEvent`: Input field value for new events

#### Event Handlers
1. **handleEditSctEvents()**: Enters edit mode, copies current events to temp
2. **handleSaveSctEvents()**: Saves changes and exits edit mode
3. **handleCancelSctEvents()**: Discards changes and exits edit mode
4. **handleAddSctEvent()**: Adds new event to temp list (prevents duplicates)
5. **handleRemoveSctEvent(event)**: Removes event from temp list

### Data Persistence
- Changes are saved to the parent component's state (App.tsx)
- State persists during the application session
- **Note**: Currently uses in-memory state. For permanent persistence across sessions, consider:
  - localStorage integration
  - Database storage
  - Configuration file

### Styling
- Consistent with existing Settings windows
- Dark theme: Gray-800 background, Gray-700 borders
- Hover effects on buttons and list items
- Responsive scrolling for long lists (max-height: 40)
- Color scheme:
  - Save button: Sky-600 (blue)
  - Cancel button: Gray-600
  - Add button: Green-600
  - Remove button: Red-400 on hover

### Validation
- **Duplicate Prevention**: Cannot add an event that already exists
- **Empty Input**: Add button only works with non-empty input
- **Input Clearing**: Input field clears after successful addition

### User Experience
1. User navigates to Settings page
2. Sees "SCT Events" window with default events
3. Clicks "Edit" to modify
4. Can add new events using the input field and "+" button
5. Can remove events by clicking the "×" button
6. Clicks "Save" to persist changes or "Cancel" to discard
7. Changes are immediately reflected in the application

### Integration Points
The `sctEvents` array can be used throughout the application for:
- Dropdown menus in event creation
- Filtering SCT-related events
- Validation of event types
- Reporting and analytics

### Future Enhancements
1. **Persistent Storage**: Save to localStorage or database
2. **Event Metadata**: Add descriptions, categories, or colors to each event
3. **Reordering**: Drag-and-drop to reorder events
4. **Import/Export**: Bulk import/export of SCT event configurations
5. **Validation Rules**: Add constraints on event naming conventions
6. **Usage Tracking**: Show which events are actively used in schedules

## Files Modified

### 1. App.tsx
- Added `sctEvents` state with default values
- Passed `sctEvents` and `setSctEvents` to SettingsView component

### 2. components/SettingsView.tsx
- Updated `SettingsViewProps` interface with new props
- Added local state for editing SCT events
- Implemented event handlers for add/remove/save/cancel
- Added SCT Events window JSX between Units and Currencies windows

## Testing Checklist
- [ ] Default events display correctly
- [ ] Edit button enters edit mode
- [ ] Add button adds new events
- [ ] Remove button deletes events
- [ ] Duplicate events are prevented
- [ ] Save button persists changes
- [ ] Cancel button discards changes
- [ ] Empty input is handled gracefully
- [ ] List scrolls properly with many events
- [ ] Styling matches other Settings windows

## Deployment Notes
- No database migrations required
- No API changes required
- Frontend-only feature
- Compatible with existing codebase
- No breaking changes

---

**Status**: ✅ Implemented and Ready for Testing
**Version**: 1.0
**Date**: 2024-11-29