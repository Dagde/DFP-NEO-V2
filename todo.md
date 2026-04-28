# Todo List

## Change Bar Investigation
- [x] Find where `isChanged` prop is calculated/passed to FlightTile
- [x] Understand how original published time is tracked
- [x] Identify why change bar isn't showing for published Daily DFP events
- [ ] Fix the isChanged logic for published Daily DFP
- [ ] Build and test the changes

## Problem Found
- `baselineSchedules` only initialized for "today" when empty
- For published Daily DFP on other dates, `baselineSchedules[date]` is undefined
- This causes `checkIsChanged` to return false

## Solution
- Initialize `baselineSchedules[date]` when loading published Daily DFP for any date
- Ensure baseline is preserved when navigating between dates