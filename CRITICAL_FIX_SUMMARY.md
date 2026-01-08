# CRITICAL FIX: Scores Loading Disabled

## Problem
The app was completely non-functional because the scores API endpoint (371KB JSON response with 1,612 records) was causing the browser to hang indefinitely during JSON parsing.

## Root Cause
- Scores endpoint returns 371KB of JSON data
- Browser receives the response successfully
- Browser hangs during `JSON.parse()` of the large response
- No timeout can prevent this because parsing happens after fetch completes
- `Promise.race()` and `AbortController` cannot cancel ongoing JSON parsing

## Solution Implemented
**Completely disabled scores loading** in the initial data fetch.

The app will now:
- ✅ Load instructors (82 records)
- ✅ Load trainees (117 records)
- ✅ Load schedule (0 records)
- ❌ Skip scores (would cause hang)

## Impact
**Positive:**
- App will now load successfully
- Staff and trainees will be visible
- Basic functionality will work

**Negative:**
- NEO Build will not have historical score data
- Trainees will appear to have no completed events
- Build algorithm will treat all trainees as "at start of syllabus"

## Next Steps Required
To restore full functionality, we need to:

1. **Reduce scores response size:**
   - Remove unnecessary fields (details array, notes)
   - Only return essential data (event, score, date)
   - This could reduce size from 371KB to ~50KB

2. **Implement pagination:**
   - Load scores in batches (e.g., 20 trainees at a time)
   - Load scores on-demand when viewing specific trainee

3. **Implement caching:**
   - Cache scores in localStorage after first successful load
   - Only fetch new/updated scores on subsequent loads

4. **Use compression:**
   - Enable gzip compression on API responses
   - This could reduce 371KB to ~50-100KB

## Temporary Workaround
The app is now functional but with limited NEO Build capability. Users can:
- View staff and trainees
- Manually create schedules
- Use other features

But NEO Build will not work properly without score data.

## Files Modified
- `/workspace/lib/dataService.ts` - Disabled scores fetch
- Commit: `95a31e8` - "CRITICAL FIX: Skip scores loading entirely to prevent browser hang"