# Staff and Trainee Section Restructuring

## Analysis Complete
- [x] Identified current structure
- [x] Located view components
- [x] Understood routing logic

## Implementation Plan

### 1. Create New Tabbed Components
- [ ] Create StaffView.tsx with tabs (Staff Profile + Staff Schedule)
- [ ] Create TraineeView.tsx with tabs (Trainee Profile + Trainee Schedule)
- [ ] Implement tab switching logic
- [ ] Preserve all existing functionality

### 2. Update Sidebar Navigation
- [ ] Remove Staff Profile and Staff Schedule sub-buttons
- [ ] Remove Trainee Profile and Trainee Schedule sub-buttons
- [ ] Update Staff button to navigate to new StaffView
- [ ] Update Trainee button to navigate to new TraineeView

### 3. Update App.tsx Routing
- [ ] Add cases for 'Staff' and 'Trainee' views
- [ ] Keep existing 'Instructors', 'InstructorSchedule', 'CourseRoster', 'TraineeSchedule' for compatibility
- [ ] Update navigation handlers

### 4. Testing & Verification
- [ ] Test Staff Profile tab functionality
- [ ] Test Staff Schedule tab functionality
- [ ] Test Trainee Profile tab functionality
- [ ] Test Trainee Schedule tab functionality
- [ ] Verify all filters work
- [ ] Verify all data displays correctly
- [ ] Test navigation between tabs
- [ ] Test state persistence

### 5. Build and Deploy
- [ ] Build application
- [ ] Deploy to both repositories
- [ ] Update HTML files
- [ ] Commit and push changes

## Current View Mapping
- Staff Profile → InstructorListView (case 'Instructors')
- Staff Schedule → InstructorScheduleView (case 'InstructorSchedule')
- Trainee Profile → CourseRosterView (case 'CourseRoster')
- Trainee Schedule → TraineeScheduleView (case 'TraineeSchedule')