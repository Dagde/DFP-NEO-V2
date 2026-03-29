# PT-051 Score Fix Instructions

## Problem Identified

The Performance History table in the Individual LMP is still showing `BIF FTD1*` and `BIF FTD3*` with asterisks. This is because:

1. **Individual LMP table**: Already fixed - has `BIF FTD1` and `BIF FTD3` (no asterisks)
2. **PT-051 Score records**: Still have asterisks - these are displayed directly in the Performance History table

## Root Cause

The Performance History table displays PT-051 Score records directly from the database (not from the Individual LMP). These Score records were created with asterisks in the event field and need to be updated.

## Solution Implemented

Created a new API endpoint: `POST /api/fix-pt051-scores`

This endpoint:
- Finds all Score records with `BIF FTD1*` or `BIF FTD3*`
- Updates them to remove the asterisk: `BIF FTD1` → `BIF FTD1`, `BIF FTD3*` → `BIF FTD3`
- Returns a summary of updated records

## Deployment Status

✅ Code changes committed and pushed
- Commit: `2b1f1a33`
- Branch: `feature/comprehensive-build-algorithm`
- File: `DFP-NEO-V2-fresh/server.js`

⏳ Waiting for Railway deployment
- Railway will automatically deploy the new code
- Check Railway dashboard for deployment status

## How to Execute the Fix

Once Railway has deployed the new code:

1. **Wait for deployment to complete** (usually 1-2 minutes)
2. **Call the API endpoint**:
   ```bash
   curl -X POST https://your-railway-app-url.railway.app/api/fix-pt051-scores
   ```
   
   Or use the Railway console:
   ```bash
   curl -X POST http://localhost:3000/api/fix-pt051-scores
   ```

3. **Expected Response**:
   ```json
   {
     "success": true,
     "updatedCount": <number>,
     "totalScores": <number>,
     "details": [
       "Updated score for <trainee name>: BIF FTD1* → BIF FTD1",
       "Updated score for <trainee name>: BIF FTD3* → BIF FTD3",
       ...
     ]
   }
   ```

## Verification

After executing the fix:

1. **Refresh the application** (Ctrl+F5 or Cmd+Shift+R)
2. **Check Performance History table**:
   - Should show `BIF FTD1` and `BIF FTD3` (no asterisks)
   - No duplicate entries
3. **Verify Individual LMP**:
   - Still shows correct completion status
   - Event titles without asterisks

## Complete Fix Summary

| Component | Status | Details |
|-----------|--------|---------|
| mockData.ts | ✅ Fixed | Event titles: `BIF FTD1`, `BIF FTD3` |
| server.js (LMP Sync) | ✅ Fixed | Normalizes asterisks when syncing |
| server.js (fix-bif-ftd-dependencies) | ✅ Fixed | Removes asterisks from completedEventIds |
| App.tsx | ✅ Fixed | Normalizes asterisks when loading |
| server.js (fix-pt051-scores) | ✅ Created | Removes asterisks from Score records |
| IndividualLMP table | ✅ Fixed | No asterisks in completedEventIds |
| PT-051 Score records | ⏳ Pending | Waiting for API execution |
| Railway deployment | ⏳ In Progress | New code being deployed |

## Why This Fix is Needed

The LMP sync endpoint normalizes asterisks when building the Individual LMP, so that table is correct. However, the Performance History table displays raw PT-051 Score records, which still contain the asterisks. This new endpoint fixes those Score records directly, ensuring consistency across all displays.