# Audit Button Implementation - Remaining Pages

## Current Status
- ✅ Phase 1 Complete: DFP, NDB, Priorities pages with full logging
- ✅ Phase 2 Complete: All 17 audit button locations implemented
- 📋 Phase 3 Pending: Additional logging implementation for remaining actions

## Implementation Plan

### 1. Course & Personnel Management

#### A. CourseRosterView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Add new trainee
  - [ ] Edit trainee details
  - [ ] Archive/restore trainee
  - [ ] Navigate to trainee views

#### B. InstructorListView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Add new instructor
  - [ ] Edit instructor details
  - [ ] Archive/restore instructor
  - [ ] Bulk update instructors

#### C. TraineeLmpView.tsx (Individual LMP)
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] View Individual LMP
  - [ ] Navigate to related views

### 2. Training & Assessment Pages

#### A. PT051View.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Save assessment changes (already implemented)
  - [ ] Update element scores
  - [ ] Update comments
  - [ ] Change overall assessment

#### B. HateSheetView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] View hate sheet
  - [ ] Navigate to assessments

#### C. PostFlightView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Save post-flight data
  - [ ] Update defects/issues

### 3. Syllabus & Training Management

#### A. SyllabusView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Add new LMP items
  - [ ] Edit LMP item details
  - [ ] Delete LMP items
  - [ ] Change pre/post flight times (already implemented)

#### B. CurrencyView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Update currency status
  - [ ] View currency details

### 4. Schedule Views (Instructor/Trainee)

#### A. InstructorScheduleView.tsx
- [x] Audit button in sidebar (already implemented)
- [x] Logging already handled by App.tsx

#### B. TraineeScheduleView.tsx
- [x] Audit button in sidebar (already implemented)
- [x] Logging already handled by App.tsx

#### C. NextDayInstructorScheduleView.tsx
- [x] Audit button in sidebar (already implemented)
- [x] Logging already handled by App.tsx

#### D. NextDayTraineeScheduleView.tsx
- [x] Audit button in sidebar (already implemented)
- [x] Logging already handled by App.tsx

### 5. Settings & Configuration

#### A. SettingsView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Location management
  - [ ] Unit management
  - [ ] SCT Events configuration (already implemented)
  - [ ] Bulk imports
  - [ ] Event limits configuration

#### B. CurrencyBuilderView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Create currency
  - [ ] Edit currency
  - [ ] Delete currency

### 6. Dashboard & Reports

#### A. ProgramDataView.tsx
- [x] Add audit button to page header (top-right)
- [ ] View-only, minimal logging needed

#### B. CourseProgressView.tsx
- [x] Add audit button to page header (top-right)
- [ ] Add logging for:
  - [ ] Update grad dates (already implemented)
  - [ ] Update start dates (already implemented)

#### C. LogbookView.tsx
- [x] Add audit button to page header (top-right)
- [ ] View-only, minimal logging needed

### 4. Implementation Steps

1. **Add AuditButton component to each page** ✅
   - [x] Import AuditButton
   - [x] Place in header (top-right corner)
   - [x] Pass appropriate pageName prop

2. **Add audit logging to action handlers** (Partially Complete)
   - [x] Import logAudit function where needed
   - [x] Add logging calls for DFP, NDB, Priorities
   - [x] Include before/after values for edits
   - [x] Use descriptive action descriptions
   - [ ] Add logging for remaining views (personnel, training, settings)

3. **Test each implementation** (In Progress)
   - [x] Verify buttons appear correctly
   - [ ] Test audit log creation for all actions
   - [ ] Check log details are accurate
   - [ ] Verify no UI/layout issues

### 5. Testing Checklist
- [x] All audit buttons visible and accessible
- [x] All buttons open audit flyout correctly
- [x] Audit logs show correct page names
- [x] DFP/NDB/Priorities actions are being logged
- [ ] Personnel management actions are being logged
- [ ] Training management actions are being logged
- [ ] Settings actions are being logged
- [x] No console errors
- [x] No layout/styling issues

### 6. Documentation
- [x] Update AUDIT_BUTTON_IMPLEMENTATION_PLAN.md
- [x] Create AUDIT_BUTTONS_COMPLETE.md
- [x] Update audit_implementation_todo.md with completion status

## Priority Order
1. Personnel View (most frequently used)
2. Individual LMP View (critical for training tracking)
3. Syllabus View (important for configuration)
4. PT-051 View (assessment tracking)
5. Settings View (configuration changes)
6. Training Records View (read-only, lower priority)