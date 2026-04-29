# Todo List

## Change Bar Investigation
- [x] Find where `isChanged` prop is calculated/passed to FlightTile
- [x] Understand how original published time is tracked
- [x] Identify why change bar isn't showing for published Daily DFP events
- [x] Fix the isChanged logic for published Daily DFP
- [x] Build and test the changes
- [x] Deploy and verify change bar works

## Problem Found
- `baselineSchedules` only initialized for "today" when empty
- For published Daily DFP on other dates, `baselineSchedules[date]` is undefined
- This causes `checkIsChanged` to return false

## Solution Implemented
- Updated useEffect to initialize `baselineSchedules[date]` for any date when viewing published Daily DFP
- This enables change bar detection for all published DFP dates, not just today
- Removed temporary red verification banner

## Deployment
- Changes committed and pushed to feature/comprehensive-build-algorithm
- Railway build triggered - awaiting deployment completion