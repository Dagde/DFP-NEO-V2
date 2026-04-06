# Fix Course Dates Save Button

## Problem
The Save Changes button in the Course Management page's Edit dialog doesn't save changes to the database.

## Root Cause
The `onUpdateCourseDates` prop is missing when `TrainingRecordsView` is rendered in App.tsx, and the existing handlers (`handleUpdateGradDate`, `handleUpdateStartDate`) only update local state without calling the API.

## Solution

### 1. Create a new handler in App.tsx
- Create `handleUpdateCourseDatesFromTrainingRecords` that:
  - Calls the `/api/courses` POST endpoint to save to database
  - Updates local state with the new dates

### 2. Pass the handler to TrainingRecordsView
- Add `onUpdateCourseDates={handleUpdateCourseDatesFromTrainingRecords}` to the TrainingRecordsView render

### 3. Verify the fix
- Test that clicking Save Changes updates both the UI and the database

## Status
- [ ] Create handler in App.tsx
- [ ] Pass handler to TrainingRecordsView
- [ ] Test and verify