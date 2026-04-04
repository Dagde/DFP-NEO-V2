## MockData Removal - Steps 1-4 Complete (restored to 53c95828)

### Step 1: Fix Merge Logic (COMPLETE - commit f40fdf53)
- [x] Snapshot: snapshot/pre-mockdata-removal-step1
- [x] Remove permissions inheritance from mock to real DB instructors
- [x] Fix staff mock data toggle (was hardcoded true, now respects setting)
- [x] Fix catch block fallback to tag mock data with _dataSource
- [x] Build succeeded, pushed

### Step 2: Fix School Switcher and Course Unarchiver (COMPLETE - commit 579f9b2b)
- [x] Snapshot: snapshot/pre-mockdata-removal-step2
- [x] Remove useEffect that reset events/courses to mock data on school switch
- [x] Fix course unarchiver to not use ESL_DATA.courses as template
- [x] Build succeeded, pushed

### Step 3A+3B: Replace mock initial states + add courses DB (COMPLETE - commit 2e2ee49c)
- [x] Snapshot: snapshot/pre-mockdata-removal-step3
- [x] Replace all 10 mock data initial states with empty values
- [x] Add GET/POST/DELETE /api/courses to server.js
- [x] Add fetchCourses/saveCourse/deleteCourse to lib/api.ts
- [x] Add courses fetch to initializeData() in dataService.ts
- [x] Load DB courses into App state on startup
- [x] Build succeeded, pushed

### Step 4: Course management UI saves to database (COMPLETE - commit 53c95828)
- [x] Updated handleAddCourseFromTrainingRecords to save to DB
- [x] Updated handleDeleteCourseFromTrainingRecords to delete from DB
- [x] Updated handleUnarchiveCourseFromArchivedView to restore to DB
- [x] Updated handleDeleteCourseFromArchivedView to delete from DB
- [x] Build succeeded, pushed
- [x] CONFIRMED WORKING BY USER

## Archive/Delete Dialog Fix (COMPLETE - commit fee1030e)
- [x] Surgical patch of working bundle from 53c95828 (NOT a rebuild)
- [x] Patch 1: Added showChoiceDialog useState(false) state variable
- [x] Patch 2: handlePinSubmit now calls setShowChoiceDialog(true) after correct PIN  
- [x] Patch 3: Added choice dialog JSX with Cancel/Archive/Delete Permanently buttons
- [x] Working bundle markers preserved: loadInitialData, ESL_DATA, 54 useState([]) calls
- [x] Committed and pushed as fee1030e
- [ ] Verify on Railway: staff/trainees/courses visible AND dialog shows 3 buttons after PIN (pending Railway redeploy)

## Course DB Persistence Fix (COMPLETE - commit becea787)
- [x] Patch A: handleAddCourseFromTrainingRecords now calls PUT /api/courses
- [x] Patch B: handleDeleteCourseFromTrainingRecords calls DELETE /api/courses/:name
- [x] Patch C: handleUnarchiveCourseFromArchivedView calls PUT /api/courses (removed ESL_DATA fallback)
- [x] Patch D: handleDeleteCourseFromArchivedView calls DELETE /api/courses/:name
- [x] server.js: Added DELETE /api/courses/:name endpoint
- [x] lib/api.ts: Fixed saveCourse from POST to PUT (matches server)
- [x] Safety: 54 useState([]) count preserved, loadInitialData intact
- [ ] Verify on Railway: add course, hard refresh → course persists

## NOTES
- All attempts after 53c95828 broke the app (staff/trainee/courses not visible)
- Root cause: rebuilt bundles have 59 useState([]) vs 54 in working bundle (extra empty states from Step 3 App.tsx)
- Solution: surgically patch the working bundle bytes directly instead of rebuilding
- Archive/Delete dialog fix applied via surgical patch in fee1030e