# Fix Scrolling and Ordering Issues on Staff and Trainee Pages

## 1. Staff Schedule Tab - Add Vertical Scrolling
- [x] Identify the container structure in InstructorScheduleView.tsx
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [ ] Test scrolling with long staff lists

## 2. Staff Schedule Tab - Implement Proper Ordering
- [x] Create sorting function for staff by Unit, then Rank, then Surname
- [x] Define rank order: WGCDR, SQNLDR, FLTLT, FLGOFF, PLTOFF
- [x] Implement unit color coding for visual distinction (already exists via PersonnelColumn)
- [x] Apply sorting to instructors array before rendering
- [ ] Test sorting stability

## 3. Trainee Schedule Tab - Add Vertical Scrolling
- [x] Identify the container structure in TraineeScheduleView.tsx
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [ ] Test scrolling with long trainee lists

## 4. Trainee Profile Page - Add Vertical Scrolling
- [x] Identify the container structure in CourseRosterView.tsx
- [x] Verify overflow-y-auto is working correctly (already present on line 265)
- [x] Fix parent container to use flex-col (was blocking child overflow-auto)
- [ ] Test scrolling with multiple courses and trainees

## 5. Testing and Verification
- [ ] Test all scrolling functionality across different screen sizes
- [ ] Verify sorting is stable and consistent
- [ ] Ensure no data or functionality is lost
- [ ] Test on different resolutions

## 6. Build and Deploy
- [ ] Build the application
- [ ] Copy to deployment directories
- [ ] Update HTML bundle references
- [ ] Restore button colors
- [ ] Commit and push changes