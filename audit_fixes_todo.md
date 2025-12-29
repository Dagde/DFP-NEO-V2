# Audit Logging Fixes

## Issues to Fix

1. ✅ Syllabus page - Not recording changes to LMP
2. ✅ Course Progress page - Not recording who viewed
3. ✅ Remove audit button from Program Data
4. ✅ Staff Profile page - Not recording views and changes

## Implementation Plan

### 1. Syllabus Page (SyllabusView.tsx)
- Add logging for pre/post flight time changes (already has onUpdateItem handler)
- Add view logging when page opens

### 2. Course Progress Page (CourseProgressView.tsx)
- Add view logging when page opens
- Grad date and start date changes should already be logged in App.tsx

### 3. Program Data Page (ProgramDataView.tsx)
- Remove audit button completely

### 4. Staff Profile Page (InstructorProfileFlyout.tsx)
- Add view logging when profile opens
- Changes should already be logged (we just added this)
- Verify logging is working correctly