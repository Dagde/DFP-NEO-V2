# Staff Database Enhancement - Fetch Real Database Data

## Current State
- StaffDatabaseTable.tsx currently filters by hardcoded IDs: [8207939, 8207938, 8201111]
- Only shows static mockdata for these IDs from props
- Need to fetch actual database data from PostgreSQL API

## Tasks
[ ] Investigate API endpoints for real database staff data
[ ] Update StaffDatabaseTable to fetch from API instead of using props
[ ] Add proper data fetching logic with loading/error states
[ ] Ensure only real database staff are displayed (not mockdata)
[ ] Test the data fetching
[ ] Build and commit changes
[ ] Push to Railway for deployment