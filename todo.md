# Trainee Roster Edit Course - Bug Fix

## Issue
Course unit changes are not being reflected after save.

## Root Causes Identified
1. **Flyout doesn't close after unit update** - `onUpdateCourseUnit` callback doesn't call `setCourseToEdit(null)`
2. **Props not synced to state** - CourseEditFlyout uses `useState` with initial props but no `useEffect` to sync when props change
3. **Wrong parameter passed** - `onUpdateCourseUnit(newCourseNumber, newUnit)` passes `newCourseNumber` instead of `courseName`
4. **Wrong build being served** - The build was going to `public/flight-school-app/` but Railway was serving from `dfp-neo-platform/assets/` with old index files

## Fixes Applied
- [x] Add `useEffect` to sync props to state in CourseEditFlyout
- [x] Close flyout after unit update in CourseRosterView
- [x] Pass `courseName` instead of `newCourseNumber` to `onUpdateCourseUnit`
- [x] Copy new build files to `dfp-neo-platform/assets/`
- [x] Update `dfp-neo-platform/index.html` to point to new build
- [x] Rebuild and push

## Status: Complete ✓
Pushed to `feature/comprehensive-build-algorithm` branch (commits: `4896d342`, `15b5866c`)