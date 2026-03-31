# Currency Panel - Wiring currentUserId/currentUserName + MyDashboard Fix

## Status
All CurrencyPanel, button styling, audit flyout code is already done.
Need to wire props through and fix MyDashboard "My Currency" navigation.

## Pending Tasks

### Task 1: Wire currentUserId/currentUserName through InstructorListView
- [x] Read InstructorListView props interface (line ~36-56)
- [ ] Add currentUserId/currentUserName to InstructorListViewProps interface
- [ ] Add to component destructuring
- [ ] Pass to InstructorProfileFlyout at line ~564

### Task 2: Wire currentUserId/currentUserName through CourseRosterView
- [ ] Add currentUserId/currentUserName to CourseRosterViewProps interface
- [ ] Add to component destructuring
- [ ] Pass to TraineeProfileFlyout at line ~386

### Task 3: Pass props from App.tsx
- [ ] Pass authUser?.userId (currentUserId) and currentUserName to InstructorListView (~line 11442)
- [ ] Pass authUser?.userId (currentUserId) and currentUserName to CourseRosterView (~line 10611)

### Task 4: Fix MyDashboard "My Currency" → open profile with currency tab
- [ ] Read handleSelectMyCurrency in App.tsx
- [ ] Modify to set selectedPersonForProfile and profileInitialTab='currency' instead of navigating to CurrencyView

### Task 5: Build and deploy
- [ ] Run npm run build
- [ ] Git commit and push to Railway