# Audit Button Implementation TODO

## Phase 1: Core Components ✅
- [x] Create audit type definitions (types/audit.ts)
- [x] Create audit logger utility (utils/auditLogger.ts)
- [x] Create AuditButton component
- [x] Create AuditFlyout component

## Phase 2: Daily Flying Program (DFP)
- [ ] Add to Program Schedule (ScheduleView) - Bottom left, between Name and Course numbers
- [ ] Add to Flight Details Window (EventDetailModal) - Bottom left corner of footer
- [ ] Add to Post Flight Sub-Window (PostFlightView/PostFlightModal) - Top right in header

## Phase 3: Personnel Management
- [ ] Add to Staff Profile (InstructorListView) - Bottom of each Unit's staff list
- [ ] Add to Instructor Profile Window (InstructorProfileFlyout) - Bottom right under Close button
- [ ] Add to Archived Instructors Window (ArchivedInstructorsFlyout) - Bottom right corner
- [ ] Add to Trainee Profile (CourseRosterView) - Bottom of each Course trainee list
- [ ] Add to Add Course Window (AddCourseFlyout)
- [ ] Add to Archive Course Window (RemoveCourseFlyout)
- [ ] Add to Restore Course Window (RestoreCourseConfirmation)
- [ ] Add to Trainee Profile Window (TraineeProfileFlyout) - Bottom right under Close button

## Phase 4: Training & Grading
- [ ] Add to Syllabus (SyllabusView) - Header, next to course select
- [ ] Add to PT-051 Assessment (PT051View) - Header, next to Save button
- [ ] Add to Individual LMP (TraineeLmpView) - Header, next to Back button

## Phase 5: Settings & Configuration
- [ ] Add to Scoring Matrix Window (ScoringMatrixFlyout) - Top right, next to Edit button
- [ ] Add to Location Window - Top right, next to Edit button
- [ ] Add to Units Window - Top right, next to Edit button
- [ ] Add to SCT Events Window - Top right, next to Edit button
- [ ] Add to Currencies Window - Top right, next to Edit button
- [ ] Add to Events Limits Window - Top right, next to Edit button
- [ ] Add to Data Storage Window - Header, top right

## Phase 6: Integration & Testing
- [ ] Add audit logging calls to all edit/save operations
- [ ] Test print functionality
- [ ] Test CSV export
- [ ] Test sorting and filtering
- [ ] Verify all buttons are consistently styled
- [ ] Test on all target pages

## Phase 7: Documentation
- [ ] Create user guide for audit functionality
- [ ] Document audit log data structure
- [ ] Create admin guide for audit log management