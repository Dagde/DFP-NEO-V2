# Aircraft Availability Fix Tasks

## Current Issues
1. Average still changes when aircraft availability is updated outside flying window (fix not working)
2. Commit hash in header is one commit behind

## Tasks
- [x] Investigate why the after-window fix isn't working
  - **ROOT CAUSE 1**: The duplicate event check was calling `recalculateDailySummary` unconditionally
  - **ROOT CAUSE 2 (NEW)**: Timezone mismatch - server uses its local time but compares against user's flying window time
- [x] Check the commit display logic in the header
  - The commit hash is baked into the build at compile time via Vite using `__COMMIT_HASH__`
  - The issue is Railway serving pre-built static assets (the "pin" issue)
- [x] Fix the duplicate event bypass issue
  - Moved the after-window check to the BEGINNING of the POST handler
- [ ] Fix the timezone mismatch issue
  - Server should either:
    a. Use the timestamp from the event (which is in user's timezone)
    b. Or accept the user's timezone from the request
  - Need to compare event timestamp against the flying window end

## Summary of Issues Found

### Issue 1: After-Window Check Was Being Bypassed (FIXED)
The previous fix added a check at the end of the POST handler, but there was a duplicate event check earlier that called `recalculateDailySummary` unconditionally.

### Issue 2: Timezone Mismatch (NEW - ROOT CAUSE)
The server compares:
- `now.getHours() * 60 + now.getMinutes()` - Server's local time
- `parseWindowTime(flyingWindowEnd, 17)` - User's local time (e.g., 17:00 in Australia)

If the server is in UTC and user is in UTC+10:
- User at 11 PM Australia = 1 PM UTC
- Server sees 13:00 UTC < 17:00 → thinks it's still within window!
- This causes recalculation even though it's after window in user's timezone

### Fix 2: Commit Display Lag
The commit hash is embedded in the frontend build at compile time via Vite's `define` option. Railway may be serving cached/pinned static assets that don't reflect the latest build.