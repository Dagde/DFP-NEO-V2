# Fix Render Loop and Currency Data Persistence

## Problem
- InstructorListView and TraineeListView were re-rendering 60+ times in a loop
- Currency data was disappearing immediately after save due to background sync overwriting it during re-renders
- Root cause: Inline callback functions in App.tsx were creating new function references on every render

## Fixes Applied

### useCallback Wrappers Added
[x] Wrap handleNavigateToCurrency in useCallback
[x] Wrap handleViewLogbook in useCallback  
[x] Wrap handleCloseStaffView in useCallback
[x] Wrap handleProfileOpened in useCallback
[x] Wrap handleProfileTabConsumed in useCallback
[x] Wrap handleRequestSct in useCallback
[x] Wrap handleArchiveInstructor in useCallback
[x] Wrap handleRestoreInstructor in useCallback
[x] Wrap handleArchiveTrainee in useCallback
[x] Wrap handleRequestSctForTrainee in useCallback

### Inline Callbacks Replaced in Instructors Case
[x] Replace onClose={() => handleNavigation('Program Schedule')} with onClose={handleCloseStaffView}
[x] Replace onArchiveInstructor inline function with onArchiveInstructor={handleArchiveInstructor}
[x] Replace onRestoreInstructor inline function with onRestoreInstructor={handleRestoreInstructor}
[x] Replace onProfileOpened={() => setSelectedPersonForProfile(null)} with onProfileOpened={handleProfileOpened}
[x] Replace onRequestSct inline function with onRequestSct={handleRequestSct}

### Inline Callbacks Replaced in Trainees Case
[x] Replace onClose={() => handleNavigation('Program Schedule')} with onClose={handleCloseStaffView}
[x] Replace onArchiveTrainee inline function with onArchiveTrainee={handleArchiveTrainee}
[x] Replace onRequestSct inline function with onRequestSct={handleRequestSctForTrainee}

### Deployment
[x] Build successfully (774 modules transformed)
[x] Commit source code changes (46a8e6d3) and push
[x] Commit build assets and push

## Phase 2 - Fix Currency Not Saving to Database
[x] Identify root cause: CurrencyView only updated React state, never saved to DB
[x] Add PATCH /api/personnel/:id endpoint in server.js to save currencyStatus to qualifications field
[x] Update App.tsx onUpdateCurrencyStatus to call PATCH API after state update
[x] Update selectedPersonForCurrency after save so CurrencyView shows fresh data immediately
[x] Fix lib/dataService.ts to extract currencyStatus from qualifications JSON on load
[x] Fix trainee dedup in mergeTraineeData to prefer records with currencyStatus data
[x] Build successfully (774 modules, 10.32s)
[x] Commit (9c734097) and push all changes

## Phase 4 - Complete Rebuild: New CurrencyStatusPage
[x] Create /api/currency/:personId GET endpoint (load from DB)
[x] Create /api/currency/:personId POST endpoint (save to DB)
[x] Create new CurrencyStatusPage.tsx - fetches from DB on mount, saves to DB on save
[x] Wire CurrencyStatusPage into App.tsx Currency case (replaced old CurrencyView)
[x] Build (774 modules, index-D3048PZa.js) - verified api/currency call in bundle
[x] Deploy: copy to public/assets/, update public/index.html
[x] Commit (f4adc7dc) and push to Railway

## Phase 3 - Deploy New Build with localCurrencyStatus Fix
[x] Rebuild from source (774 modules, index-f8gvwvVI.js)
[x] Verify new build contains [n.idNumber] pattern (localCurrencyStatus fix confirmed)
[x] Remove stale old build files (DKn79Frj, DhBqNexs, I8v0n7XR) from public/assets/
[x] Copy new build (f8gvwvVI) to public/assets/
[x] Update public/index.html to reference new build
[x] Commit (109788b9) and push to Railway

## Previous Completed Tasks
[x] Add rounded-md class to Currency header buttons (Edit, Close, Save, Audit) in InstructorProfileFlyout
[x] Add rounded-md class to Currency header buttons (Edit, Close, Save, Audit) in TraineeProfileFlyout  
[x] Add rounded-md class to AuditButton component
[x] Commit source code (bdffc104) and push
[x] Commit build assets (653ffafd) and push