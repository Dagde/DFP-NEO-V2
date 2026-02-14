# Fix Scrolling and Ordering Issues on Staff and Trainee Pages

## 1. Staff Schedule Tab - Add Vertical Scrolling
- [x] Identify the container structure in InstructorScheduleView.tsx
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [x] Add 100px bottom padding to ensure full visibility

## 2. Staff Schedule Tab - Implement Proper Ordering
- [x] Create sorting function for staff by Role, Unit, Rank, then Surname
- [x] Define rank order: WGCDR, SQNLDR, FLTLT, FLGOFF, PLTOFF
- [x] Implement unit color coding for visual distinction (already exists via PersonnelColumn)
- [x] Apply sorting to instructors array before rendering
- [x] Move SIM IPs to bottom of list (after all QFIs)

## 3. Trainee Schedule Tab - Add Vertical Scrolling
- [x] Identify the container structure in TraineeScheduleView.tsx
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [x] Add 100px bottom padding to ensure full visibility

## 4. Trainee Profile Page - Add Vertical Scrolling
- [x] Identify the container structure in CourseRosterView.tsx
- [x] Verify overflow-y-auto is working correctly (already present on line 265)
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [x] Add bottom padding (pb-24) to ensure full visibility

## 5. Staff Profile Page - Add Vertical Scrolling
- [x] Add bottom padding (pb-24) to InstructorListView to ensure full visibility

## 6. Build and Deploy
- [x] Build the application
- [x] Copy to deployment directories
- [x] Update HTML bundle references (index-DXTeOJfc.js)
- [x] Restore button colors (#a0a0a0)
- [x] Commit and push changes (commit 77dd6ad)