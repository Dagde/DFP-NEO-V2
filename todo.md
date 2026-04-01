# Currency Panel - Wiring currentUserId/currentUserName + MyDashboard Fix

## Status: ALL COMPLETE

## Completed Tasks

### Task 1: Wire currentUserId/currentUserName through InstructorListView ✅
- [x] Add currentUserId/currentUserName to InstructorListViewProps interface
- [x] Add to component destructuring
- [x] Pass to InstructorProfileFlyout

### Task 2: Wire currentUserId/currentUserName through CourseRosterView ✅
- [x] Add currentUserId/currentUserName to CourseRosterViewProps interface
- [x] Add to component destructuring
- [x] Pass to TraineeProfileFlyout

### Task 3: Pass props from App.tsx ✅
- [x] Pass getCurrentUserId()/currentUserName to InstructorListView
- [x] Pass getCurrentUserId()/currentUserName to CourseRosterView

### Task 4: MyDashboard "My Currency" → open profile with currency tab ✅
- [x] Already correctly implemented: handleSelectMyCurrency sets selectedPersonForProfile + profileInitialTab='currency' + navigates to 'Instructors'

### Task 5: Build and deploy ✅
- [x] npm run build: 786 modules, no TS errors
- [x] Git commit a988cc9f pushed to Railway