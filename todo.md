# Fix 2FTS Staff Appearing in ESL Location

## Investigation
- [x] Check ScheduleView.tsx filtering logic for staff schedule
- [x] Check App.tsx NEO Build filtering for location-based staff
- [x] Verify the `school` prop is being passed correctly to components
- [x] Check if staff data has correct `unit` values (1FTS, CFS, 2FTS)
- [x] **FOUND ISSUE**: InstructorScheduleView was receiving unfiltered instructorsData

## Implementation
- [x] Fix App.tsx to filter instructorsData by location before passing to InstructorScheduleView
- [x] Added location filtering: ESL shows 1FTS+CFS, PEA shows 2FTS
- [ ] Verify NEO Build filtering is still working correctly
- [ ] Test that 2FTS staff don't appear in ESL location
- [ ] Test that 1FTS and CFS staff appear in ESL location
- [ ] Test that 2FTS staff appear in PEA location

## Deployment
- [x] Rebuild application
- [x] Copy to public directory
- [x] Update HTML references
- [x] Commit and push changes