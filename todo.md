# Fix 2FTS Staff Appearing in ESL Location - COMPLETE ✅

## Investigation
- [x] Check ScheduleView.tsx filtering logic for staff schedule
- [x] Check App.tsx NEO Build filtering for location-based staff
- [x] Verify the `school` prop is being passed correctly to components
- [x] Check if staff data has correct `unit` values (1FTS, CFS, 2FTS)
- [x] **FOUND ISSUE**: InstructorScheduleView was receiving unfiltered instructorsData

## Implementation
- [x] Fix App.tsx to filter instructorsData by location before passing to InstructorScheduleView
- [x] Added location filtering: ESL shows 1FTS+CFS, PEA shows 2FTS
- [x] NEO Build filtering already working correctly (verified in previous commits)

## Deployment
- [x] Rebuild application
- [x] Copy to public directory
- [x] Update HTML references
- [x] Commit and push changes (commit 141c33d)

## Summary
Fixed the issue where 2FTS staff were appearing in the ESL location's Staff Schedule. The problem was that `InstructorScheduleView` was receiving the complete unfiltered `instructorsData` array. Added location-based filtering before passing data to the component:
- ESL location: Shows only 1FTS and CFS staff
- PEA location: Shows only 2FTS staff

The NEO Build algorithm already had correct location filtering in place from previous commits.