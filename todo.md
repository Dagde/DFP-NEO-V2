# Fix 2FTS Staff Appearing in ESL Location - FIXED ✅

## Investigation
- [x] Check ScheduleView.tsx filtering logic for staff schedule
- [x] Check App.tsx NEO Build filtering for location-based staff
- [x] Verify the `school` prop is being passed correctly to components
- [x] Check if staff data has correct `unit` values (1FTS, CFS, 2FTS)
- [x] **FOUND ISSUE 1**: InstructorScheduleView was receiving unfiltered instructorsData
- [x] **FOUND ISSUE 2**: First fix placed filtering code in wrong location (unreachable code after return statement)

## Implementation
- [x] ATTEMPT 1 (commit 141c33d): Added filtering code but placed it AFTER 'Program Schedule' return statement (unreachable)
- [x] ATTEMPT 2 (commit 865299b): Correctly placed filtering code INSIDE 'InstructorSchedule' case at line 7881
- [x] Removed unreachable code from wrong location
- [x] Added debug logging to verify filtering is working

## Deployment
- [x] Rebuild application
- [x] Copy to public directory
- [x] Update HTML references
- [x] Commit and push changes (commit 865299b)

## Summary
Fixed the issue where 2FTS staff were appearing in the ESL location's Staff Schedule. The problem had two parts:
1. `InstructorScheduleView` was receiving unfiltered `instructorsData`
2. First fix attempt placed the filtering code in the wrong location (after a return statement, making it unreachable)

Final fix correctly places the filtering inside the 'InstructorSchedule' case:
- ESL location: Shows only 1FTS and CFS staff
- PEA location: Shows only 2FTS staff

Console logs added to verify filtering is working correctly.