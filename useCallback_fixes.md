# useCallback Fixes to Stop Render Loop

## Context
InstructorListView was re-rendering 60+ times because callback function props were changing on every App.tsx render, creating infinite re-render loop.

## Root Cause
Inline arrow functions in App.tsx were creating new function references on every render:
- `onClose={() => handleNavigation('Program Schedule')}`
- `onArchiveInstructor={(id) => { ... }}`
- `onProfileOpened={() => setSelectedPersonForProfile(null)}`
- etc.

## Solution
Wrap all callback functions with `useCallback` to stabilize their references across renders.

## Callback Functions Created
1. `handleCloseStaffView` - Navigation to Program Schedule
2. `handleProfileOpened` - Set selected person to null
3. `handleProfileTabConsumed` - Clear profile initial tab
4. `handleRequestSct` - Request SCT certificate
5. `handleArchiveInstructor` - Archive instructor
6. `handleRestoreInstructor` - Restore instructor

## Next Steps
- Update InstructorListView JSX in App.tsx (lines 11418-11510) to use these memoized callbacks
- Check TraineeView component branch for similar fixes
- Build, commit, and push the changes