# Fix Data Initialization - Restore Mock Data Loading

## Problem
- Staff Schedule shows only database entries (Dawe, Dawe, Evans)
- Staff page shows instructors briefly then disappears
- No mock data is loading

## Root Cause
- The Data Source toggle logic was removed during rollback
- `initializeData()` only fetches from API, returns database instructors
- Mock data fallback only triggers when API returns empty (not the case here)

## Tasks
- [ ] Check current localStorage dataSourceSettings state
- [ ] Restore data source settings state management
- [ ] Modify initializeData() to check dataSourceSettings and merge data
- [ ] Test that mock data loads when toggle is ON
- [ ] Deploy and verify fix

## Current State
- API returns 3 database instructors
- Mock data not being loaded
- Need to merge database + mock data when toggle is ON